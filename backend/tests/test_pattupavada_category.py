import unittest
from types import SimpleNamespace

from app.routers.products import _search_tokens
from app.services.zoho_inventory import (
    _normalize_subcategory,
    _sync_subcategories_to_categories,
)


class FakeCategoryQuery:
    def __init__(self, rows):
        self.rows = rows
        self.operation = "select"
        self.payload = None
        self.filters = []

    def select(self, *_columns):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def in_(self, key, values):
        self.filters.append((key, set(values)))
        return self

    def execute(self):
        if self.operation == "select":
            return SimpleNamespace(data=[dict(row) for row in self.rows])
        if self.operation == "update":
            for row in self.rows:
                if all(row.get(key) == value for key, value in self.filters):
                    row.update(self.payload)
        elif self.operation == "insert":
            self.rows.extend(self.payload)
        elif self.operation == "delete":
            key, values = self.filters[0]
            self.rows[:] = [row for row in self.rows if row.get(key) not in values]
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, categories):
        self.categories = categories

    def table(self, name):
        if name != "categories":
            raise AssertionError(f"Unexpected table: {name}")
        return FakeCategoryQuery(self.categories)


class PattupavadaCategoryTests(unittest.TestCase):
    def test_zoho_pavada_values_normalize_to_pattupavada(self):
        self.assertEqual(
            _normalize_subcategory("clothing", "Pavada"),
            ("Pattupavada", "pattupavada"),
        )
        self.assertEqual(
            _normalize_subcategory("clothing", "Pattupavada"),
            ("Pattupavada", "pattupavada"),
        )

    def test_legacy_supabase_category_is_renamed_without_losing_tile_fields(self):
        categories = [
            {
                "id": "pavada-id",
                "name": "Pavada",
                "slug": "pavada",
                "type": "clothing",
                "image_url": "https://example.com/pavada.jpg",
                "display_order": 7,
            }
        ]

        _sync_subcategories_to_categories(FakeSupabase(categories), {})

        renamed = next(row for row in categories if row["id"] == "pavada-id")
        self.assertEqual(renamed["name"], "Pattupavada")
        self.assertEqual(renamed["slug"], "pattupavada")
        self.assertEqual(renamed["image_url"], "https://example.com/pavada.jpg")
        self.assertEqual(renamed["display_order"], 7)
        self.assertFalse(any(row["slug"] == "pavada" for row in categories))

    def test_searching_legacy_name_targets_renamed_category(self):
        self.assertEqual(_search_tokens("pavada"), ["pattupavada"])

    def test_dhavani_set_is_an_allowed_clothing_subcategory(self):
        self.assertEqual(
            _normalize_subcategory("clothing", "Dhavani Set"),
            ("Dhavani Set", "dhavani-set"),
        )

    def test_large_images_are_compressed_to_300kb_or_less(self):
        import io
        import os

        from PIL import Image

        from app.services.product_images import MAX_IMAGE_BYTES, compress_image

        noisy = Image.frombytes("RGB", (2000, 2000), os.urandom(2000 * 2000 * 3))
        buffer = io.BytesIO()
        noisy.save(buffer, "PNG")
        compressed = compress_image(buffer.getvalue())
        self.assertLessEqual(len(compressed), MAX_IMAGE_BYTES)
        self.assertEqual(Image.open(io.BytesIO(compressed)).format, "JPEG")


if __name__ == "__main__":
    unittest.main()
