import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jwt
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import database, deps, security

with patch.object(database, "get_supabase") as startup_supabase:
    startup_supabase.return_value.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    from app.routers import superadmin


CUSTOMER_ID = "c207fe5a-904d-4c70-8b5a-4a56a9e31eb7"
PASSWORDS = {"password_1": "test-first-password", "password_2": "test-second-password"}


class ImpersonationTests(unittest.TestCase):
    def setUp(self):
        self.settings = SimpleNamespace(
            superadmin_password="configured",
            impersonation_password_1=PASSWORDS["password_1"],
            impersonation_password_2=PASSWORDS["password_2"],
            superadmin_jwt_expires_minutes=60,
            jwt_expires_minutes=60,
            jwt_secret_key="test-key-that-is-at-least-32-bytes-long",
            jwt_algorithm="HS256",
        )
        self.security_settings = patch.object(security, "get_settings", return_value=self.settings)
        self.deps_settings = patch.object(deps, "get_settings", return_value=self.settings)
        self.security_settings.start()
        self.deps_settings.start()
        self.router_settings = patch.object(superadmin, "get_settings", return_value=self.settings)
        self.router_settings.start()
        self.addCleanup(self.security_settings.stop)
        self.addCleanup(self.deps_settings.stop)
        self.addCleanup(self.router_settings.stop)
        superadmin.state.clear_impersonation_failures("testclient")
        self.addCleanup(superadmin.state.clear_impersonation_failures, "testclient")
        app = FastAPI()
        app.include_router(superadmin.router)
        self.client = TestClient(app)
        self.headers = {"Authorization": f"Bearer {security.create_superadmin_token()}"}
        self.db = Mock()
        self.query = self.db.table.return_value.select.return_value
        self.query.ilike.return_value = self.query
        self.query.limit.return_value = self.query
        self.query.eq.return_value = self.query
        self.query.execute.return_value.data = []
        self.db_patch = patch.object(superadmin, "get_supabase", return_value=self.db)
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)

    def test_endpoints_require_superadmin(self):
        self.assertEqual(self.client.get("/superadmin/customers/search?q=abc").status_code, 401)
        customer_token = security.create_access_token(CUSTOMER_ID)
        response = self.client.post(
            f"/superadmin/customers/{CUSTOMER_ID}/impersonate",
            headers={"Authorization": f"Bearer {customer_token}"},
            json=PASSWORDS,
        )
        self.assertEqual(response.status_code, 401)

    def test_search_deduplicates_and_omits_password_fields(self):
        customer = {"id": CUSTOMER_ID, "first_name": "Test", "last_name": "Person"}
        self.query.execute.return_value.data = [customer]
        response = self.client.get("/superadmin/customers/search?q=Test%20Person", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["customers"], [customer])
        self.assertNotIn("password_hash", self.db.table.return_value.select.call_args.args[0])
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(self.query.execute.call_count, 5)

    def test_impersonation_uses_customer_subject_and_short_expiry(self):
        self.query.execute.return_value.data = [{"id": CUSTOMER_ID, "is_active": True, "is_banned": False}]
        with patch.object(superadmin.state, "audit") as audit:
            response = self.client.post(f"/superadmin/customers/{CUSTOMER_ID}/impersonate", headers=self.headers, json=PASSWORDS)
        self.assertEqual(response.status_code, 200)
        token = response.json()["access_token"]
        self.assertEqual(security.decode_access_token(token), CUSTOMER_ID)
        self.assertEqual(security.impersonation_customer_id(token), CUSTOMER_ID)
        self.assertFalse(security.is_valid_superadmin_token(token))
        payload = jwt.decode(token, self.settings.jwt_secret_key, algorithms=["HS256"])
        self.assertLessEqual(payload["exp"] - int(datetime.now(timezone.utc).timestamp()), 1800)
        self.assertEqual(response.headers["cache-control"], "no-store")
        audit.assert_called_once()

    def test_expired_impersonation_token_is_rejected(self):
        token = jwt.encode(
            {"sub": CUSTOMER_ID, "role": "impersonation", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
            self.settings.jwt_secret_key, algorithm="HS256",
        )
        self.assertIsNone(security.decode_access_token(token))
        self.assertIsNone(security.impersonation_customer_id(token))

    def test_disabled_banned_and_missing_customers_rejected(self):
        for rows, expected in (([], 404), ([{"is_active": False}], 403), ([{"is_banned": True}], 403)):
            with self.subTest(rows=rows):
                self.query.execute.return_value.data = rows
                response = self.client.post(f"/superadmin/customers/{CUSTOMER_ID}/impersonate", headers=self.headers, json=PASSWORDS)
                self.assertEqual(response.status_code, expected)

    def test_invalid_customer_id_and_search_are_rejected(self):
        self.assertEqual(self.client.post("/superadmin/customers/not-uuid/impersonate", headers=self.headers, json=PASSWORDS).status_code, 422)
        self.assertEqual(self.client.get("/superadmin/customers/search?q=a%2Cb", headers=self.headers).status_code, 400)

    def test_customer_disabled_after_session_started_is_rejected(self):
        token = security.create_impersonation_token(CUSTOMER_ID)
        self.query.execute.return_value.data = [{"id": CUSTOMER_ID, "is_active": False, "is_banned": False}]
        with patch.object(deps, "get_supabase", return_value=self.db):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_customer(f"Bearer {token}"))
        self.assertEqual(error.exception.status_code, 403)

    def test_passwords_are_required_ordered_and_not_exposed_in_audit(self):
        url = f"/superadmin/customers/{CUSTOMER_ID}/impersonate"
        self.assertEqual(self.client.post(url, headers=self.headers, json={}).status_code, 422)
        with patch.object(superadmin.state, "audit") as audit:
            for passwords in (
                {"password_1": "wrong", "password_2": PASSWORDS["password_2"]},
                {"password_1": PASSWORDS["password_1"], "password_2": "wrong"},
                {"password_1": PASSWORDS["password_2"], "password_2": PASSWORDS["password_1"]},
            ):
                response = self.client.post(url, headers=self.headers, json=passwords)
                self.assertEqual(response.status_code, 403)
            self.db.table.assert_not_called()
            self.assertNotIn(PASSWORDS["password_1"], str(audit.call_args_list))
            self.assertNotIn(PASSWORDS["password_2"], str(audit.call_args_list))

    def test_missing_configuration_fails_closed(self):
        self.settings.impersonation_password_2 = ""
        response = self.client.post(f"/superadmin/customers/{CUSTOMER_ID}/impersonate", headers=self.headers, json=PASSWORDS)
        self.assertEqual(response.status_code, 503)
        self.db.table.assert_not_called()

    def test_attempts_are_locked_after_five_failures(self):
        url = f"/superadmin/customers/{CUSTOMER_ID}/impersonate"
        with patch.object(superadmin.state, "audit"):
            for _ in range(5):
                response = self.client.post(url, headers=self.headers, json={"password_1": "wrong", "password_2": "wrong"})
                self.assertEqual(response.status_code, 403)
            response = self.client.post(url, headers=self.headers, json=PASSWORDS)
        self.assertEqual(response.status_code, 429)
        self.db.table.assert_not_called()


if __name__ == "__main__":
    unittest.main()
