import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.deps import get_current_admin
from app.routers import home_test_visibility


class HomeTestVisibilityTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(home_test_visibility.router)
        self.app = app
        self.client = TestClient(app)
        self.db = Mock()
        self.query = self.db.table.return_value
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        self.patch = patch.object(home_test_visibility, "get_supabase", return_value=self.db)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.values = {"under_5": False, "clearance": True, "discounts": False}

    def test_defaults_and_no_store(self):
        response = self.client.get("/home-test-visibility")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"under_5": True, "clearance": True, "discounts": True})
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_admin_auth_required(self):
        response = self.client.put("/admin/home-test-visibility", json=self.values)
        self.assertEqual(response.status_code, 401)
        self.query.upsert.assert_not_called()

    def test_save_and_read_settings(self):
        self.app.dependency_overrides[get_current_admin] = lambda: True
        response = self.client.put("/admin/home-test-visibility", json=self.values)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), self.values)
        self.query.upsert.assert_called_once_with({"key": home_test_visibility.KEY, "value": self.values})
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"value": self.values}]
        self.assertEqual(self.client.get("/home-test-visibility").json(), self.values)

    def test_rejects_partial_and_invalid_settings(self):
        self.app.dependency_overrides[get_current_admin] = lambda: True
        for values in ({"under_5": True}, {**self.values, "discounts": "false"}, {**self.values, "other": True}):
            self.assertEqual(self.client.put("/admin/home-test-visibility", json=values).status_code, 422)
        self.query.upsert.assert_not_called()

    def test_invalid_stored_settings_are_reported(self):
        self.query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"value": {"under_5": "no"}}]
        self.assertEqual(self.client.get("/home-test-visibility").status_code, 503)


if __name__ == "__main__":
    unittest.main()
