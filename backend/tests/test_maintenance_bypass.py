import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from app import database, deps, security

with patch.object(database, "get_supabase") as startup_supabase:
    startup_supabase.return_value.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    from app.main import _maintenance_events, app
    from app.services import superadmin_state as state


class MaintenanceBypassTests(unittest.TestCase):
    def setUp(self):
        settings = SimpleNamespace(
            jwt_secret_key="test-key-that-is-at-least-32-bytes-long",
            jwt_algorithm="HS256",
            superadmin_jwt_expires_minutes=60,
            superadmin_password="configured",
        )
        patches = [
            patch.object(security, "get_settings", return_value=settings),
            patch.object(deps, "get_settings", return_value=settings),
            patch.object(state, "_maintenance", {"enabled": True, "message": "", "eta": "", "since": None}),
            patch.object(state, "_bypass", {"hash": ""}),
            patch.object(database, "get_supabase"),
            patch.object(state.STATE_FILE.__class__, "write_text"),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        self.admin = TestClient(app)
        self.first = TestClient(app)
        self.second = TestClient(app)
        self.headers = {"Authorization": f"Bearer {security.create_superadmin_token()}"}

    def save_password(self, password):
        return self.admin.post("/api/superadmin/bypass-password", headers=self.headers, json={"password": password})

    def test_password_change_invalidates_all_previous_bypasses(self):
        self.assertEqual(self.save_password("first-password").status_code, 200)
        for client in (self.first, self.second):
            self.assertEqual(client.post("/api/maintenance/bypass", json={"password": "first-password"}).status_code, 200)
            self.assertTrue(client.get("/api/maintenance").json()["bypass"])
            self.assertEqual(client.get("/api/auth/me").status_code, 401)

        self.assertEqual(self.save_password("second-password").status_code, 200)
        for client in (self.first, self.second):
            status = client.get("/api/maintenance")
            self.assertFalse(status.json()["bypass"])
            self.assertEqual(status.headers["cache-control"], "no-store")
            self.assertEqual(client.get("/api/auth/me").status_code, 503)
            self.assertEqual(client.post("/api/maintenance/bypass", json={"password": "first-password"}).status_code, 401)
            self.assertEqual(client.post("/api/maintenance/bypass", json={"password": "second-password"}).status_code, 200)
            self.assertTrue(client.get("/api/maintenance").json()["bypass"])

        self.assertEqual(self.save_password("").status_code, 200)
        self.assertFalse(self.first.get("/api/maintenance").json()["bypass"])
        self.assertEqual(self.second.get("/api/auth/me").status_code, 503)

    def test_failed_password_save_preserves_previous_password(self):
        self.assertEqual(self.save_password("first-password").status_code, 200)
        with patch.object(database, "get_supabase", side_effect=RuntimeError("database unavailable")):
            self.assertEqual(self.save_password("second-password").status_code, 503)
        self.assertTrue(state.verify_bypass_password("first-password"))
        self.assertFalse(state.verify_bypass_password("second-password"))

    def test_event_stream_reports_password_change_without_revealing_it(self):
        async def run():
            request = Mock()
            request.is_disconnected = AsyncMock(side_effect=[False, False, True])
            with patch("app.main.asyncio.sleep", new_callable=AsyncMock):
                stream = _maintenance_events(request)
                self.assertEqual(await anext(stream), "event: change\ndata: refresh\n\n")
                state.set_bypass_password("new-password")
                self.assertEqual(await anext(stream), "event: change\ndata: refresh\n\n")
                with self.assertRaises(StopAsyncIteration):
                    await anext(stream)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
