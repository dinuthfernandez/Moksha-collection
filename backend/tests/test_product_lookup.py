import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import products


class ProductLookupTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(products.router, prefix="/api")
        self.client = TestClient(app)
        self.db = MagicMock()
        self.query = self.db.table.return_value.select.return_value.eq.return_value
        self.record = {
            "id": "c1be5a0e-bb4f-4efb-96f1-5d177fa93801",
            "name": "Test dress",
            "slug": "test-dress",
            "is_active": True,
            "price": 5,
            "stock_quantity": 1,
        }
        self.query.limit.return_value.execute.return_value.data = [self.record]
        self.db_patch = patch.object(products, "get_supabase", return_value=self.db)
        self.cache_patch = patch.object(products, "cached", side_effect=lambda key, ttl, loader: loader())
        self.db_patch.start()
        self.cache_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.addCleanup(self.cache_patch.stop)

    def test_lookup_by_id_and_slug(self):
        for path, field, value in [
            (f"/api/products/by-id/{self.record['id']}", "id", self.record["id"]),
            ("/api/products/test-dress", "slug", "test-dress"),
        ]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["slug"], "test-dress")
                self.db.table.return_value.select.return_value.eq.assert_called_with(field, value)

    def test_unavailable_and_invalid_ids(self):
        self.query.limit.return_value.execute.return_value.data = []
        self.assertEqual(self.client.get(f"/api/products/by-id/{self.record['id']}").status_code, 404)
        self.assertEqual(self.client.get("/api/products/by-id/not-a-uuid").status_code, 422)
        self.query.limit.return_value.execute.return_value.data = [{**self.record, "is_active": False}]
        self.assertEqual(self.client.get(f"/api/products/by-id/{self.record['id']}").status_code, 404)


if __name__ == "__main__":
    unittest.main()
