import unittest
from types import SimpleNamespace

from app.routers.products import _search_tokens
from app.services.zoho_inventory import (
    ALLOWED_SUBCATEGORIES,
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
    def test_zoho_pavada_values_keep_the_requested_category_name(self):
        self.assertEqual(
            _normalize_subcategory("clothing", "Pavada"),
            ("Pavada", "pavada"),
        )
        self.assertEqual(
            _normalize_subcategory("clothing", "Pattupavada"),
            ("Pavada", "pavada"),
        )

    def test_legacy_supabase_category_is_renamed_without_losing_tile_fields(self):
        categories = [
            {
                "id": "pavada-id",
                "name": "Pattupavada",
                "slug": "pattupavada",
                "type": "clothing",
                "image_url": "https://example.com/pavada.jpg",
                "display_order": 7,
                "is_active": True,
            }
        ]

        _sync_subcategories_to_categories(FakeSupabase(categories), {})

        renamed = next(row for row in categories if row["id"] == "pavada-id")
        self.assertEqual(renamed["name"], "Pavada")
        self.assertEqual(renamed["slug"], "pavada")
        self.assertEqual(renamed["image_url"], "https://example.com/pavada.jpg")
        self.assertTrue(renamed["is_active"])

    def test_searching_legacy_name_targets_renamed_category(self):
        self.assertEqual(_search_tokens("pavada"), ["pavada"])
        self.assertEqual(_search_tokens("pattupavada"), ["pavada"])

    def test_all_image_subcategories_are_supported(self):
        image_categories = {
            "clothing": {
                "Kurti", "Top", "Saree", "Co-ord Set", "3 Piece Set", "Frock", "Set Mundu",
                "Pavada", "Pavada Blouse", "Set Saree", "Dupatta", "2 Piece Set", "Dress Material",
                "Dhavani Set", "Blouse", "Kaftan", "Short Top", "Pant", "Skirt & Top",
            },
            "accessories": {
                "Bindi", "Earrings", "Necklace", "Bangles", "Hair Clip", "Glass Bangles", "Tic Tac",
                "Bracelets", "Mala", "Eye Liner", "Ear Chain", "Safety Pin", "Nose Pin",
                "Ear Supporters", "Anklets", "Hip Chain", "Nettichutti", "Sticker", "Saree Pin",
            },
        }
        clothing = set(ALLOWED_SUBCATEGORIES["clothing"].values()) | set(ALLOWED_SUBCATEGORIES["saree"].values())
        self.assertEqual(clothing, image_categories["clothing"])
        self.assertEqual(set(ALLOWED_SUBCATEGORIES["accessories"].values()), image_categories["accessories"])

    def test_mismatched_zoho_subcategories_only_go_to_others(self):
        self.assertEqual(
            _normalize_subcategory("clothing", "Unexpected Clothing Group"),
            ("Others", "others"),
        )
        self.assertEqual(
            _normalize_subcategory("accessories", "Unexpected Accessory Group"),
            ("Others", "accessories-others"),
        )

    def test_sync_inserts_every_image_category_and_keeps_stale_rows_inactive(self):
        stale = {
            "id": "studs-id",
            "name": "Studs",
            "slug": "studs",
            "type": "accessories",
            "image_url": "/assets/category-tiles/studs.jpg",
            "display_order": 5,
            "is_active": True,
        }
        categories = [stale]
        _sync_subcategories_to_categories(FakeSupabase(categories), {})

        self.assertFalse(stale["is_active"])
        for slug in ("kurti", "pavada", "co-ord-set", "bindi", "hair-clip", "accessories-others"):
            self.assertTrue(any(row["slug"] == slug and row["is_active"] for row in categories))
        self.assertTrue(any(row["slug"] == "kurti" and row["image_url"] for row in categories))
        self.assertEqual(sum(row["type"] == "accessories" and row["is_active"] for row in categories), 20)
        self.assertEqual(
            sum(row["type"] in {"clothing", "saree"} and row["is_active"] for row in categories),
            21,
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
