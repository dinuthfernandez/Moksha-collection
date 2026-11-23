import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.routers import products
from app.services.product_visibility import is_storefront_product


class ProductQuery:
    def __init__(self, rows):
        self.rows = rows
        self.start = 0
        self.end = 0

    def select(self, *args, **kwargs):
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if row.get(field, True if field == "category_hierarchy_valid" else None) == value]
        return self

    def gt(self, field, value):
        self.rows = [row for row in self.rows if row[field] > value]
        return self

    def lte(self, field, value):
        self.rows = [row for row in self.rows if row[field] <= value]
        return self

    def gte(self, field, value):
        self.rows = [row for row in self.rows if row[field] >= value]
        return self

    def or_(self, expression):
        if expression.startswith("zoho_sku.is.null,"):
            self.rows = [row for row in self.rows if is_storefront_product(row.get("zoho_sku"))]
            return self
        token = expression.split(".ilike.%", 1)[1].split("%", 1)[0].lower()
        fields = ("name", "description", "color", "subcategory_name", "category_slug", "product_code", "zoho_sku")
        self.rows = [row for row in self.rows if any(token in str(row.get(field) or "").lower() for field in fields)]
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, start, end):
        self.start, self.end = start, end
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows[self.start:self.end + 1], count=len(self.rows))


class ProductSearchGroupingTests(unittest.TestCase):
    def setUp(self):
        self.rows = []
        for design in range(26):
            for variant in range(9):
                self.rows.append({
                    "id": f"{design}-{variant}",
                    "slug": f"{design}-{variant}",
                    "name": "3 piece set",
                    "website_serial": f"design-{design}",
                    "is_active": True,
                    "is_primary_variant": variant == 0,
                    "stock_quantity": 0 if design == 25 else 1,
                    "price": 7 if design == 0 and variant == 3 else 5,
                    "zoho_sku": "special-sku" if design == 0 and variant == 3 else None,
                })
        self.rows.extend([
            {"id": "single-a", "slug": "single-a", "name": "3 piece set", "website_serial": None, "is_active": True, "is_primary_variant": True, "stock_quantity": 1, "price": 5},
            {"id": "single-b", "slug": "single-b", "name": "3 piece set", "website_serial": "", "is_active": True, "is_primary_variant": True, "stock_quantity": 1, "price": 5},
            {"id": "out-of-stock-duplicate", "slug": "out-of-stock-duplicate", "name": "3 piece set", "website_serial": "design-0", "is_active": True, "is_primary_variant": False, "stock_quantity": 0, "price": 5},
        ])
        database = SimpleNamespace(table=lambda name: ProductQuery(self.rows))
        db_patch = patch.object(products, "get_supabase", return_value=database)
        cache_patch = patch.object(products, "cached", side_effect=lambda key, ttl, loader: loader())
        db_patch.start()
        cache_patch.start()
        self.addCleanup(db_patch.stop)
        self.addCleanup(cache_patch.stop)

    def search(self, query, page=1, page_size=24, min_price=None):
        return products.list_products(
            category=None, category_slug=None, active_only=True, page=page,
            page_size=page_size, q=query, min_price=min_price, max_price=None,
            clearance=False, discounted=False,
        )

    def test_grouping_precedes_pagination_across_batches_and_stock_states(self):
        first = self.search("3 piece set")
        second = self.search("3 piece set", page=2)
        self.assertEqual((first.total, first.total_pages, len(first.items)), (28, 2, 24))
        self.assertEqual((second.total, second.total_pages, len(second.items)), (28, 2, 4))
        items = first.items + second.items
        keys = [("serial", item.website_serial) if item.website_serial else ("id", item.id) for item in items]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(items[-1].website_serial, "design-25")

    def test_matching_non_primary_sku_still_finds_design(self):
        result = self.search("special-sku")
        self.assertEqual(result.total, 1)
        self.assertEqual(result.items[0].id, "0-3")

    def test_price_filter_uses_matching_variant(self):
        result = self.search("3 piece set", min_price=7)
        self.assertEqual(result.total, 1)
        self.assertEqual(result.items[0].id, "0-3")

    def test_internal_items_are_excluded_before_count_and_pagination(self):
        for sku in ("DELIVERY", "test-clip"):
            self.rows.append({
                "id": sku, "slug": sku, "name": "3 piece set", "zoho_sku": sku,
                "is_active": True, "is_primary_variant": True, "stock_quantity": 1, "price": 5,
            })
        result = self.search("3 piece set")
        self.assertEqual(result.total, 28)
        self.assertFalse(any(item.id in ("DELIVERY", "test-clip") for item in result.items))
        catalog = self.search(None)
        self.assertEqual(catalog.total, 28)
        self.assertFalse(any(item.id in ("DELIVERY", "test-clip") for item in catalog.items))

    def test_sub_subcategory_filter_groups_matching_nonprimary_variants_and_hides_invalid(self):
        self.rows = [
            {"id": "a", "slug": "a", "name": "Pant", "website_serial": "one", "category_slug": "clothing",
             "subcategory_slug": "pant", "sub_subcategory_slug": "flower", "is_active": True,
             "is_primary_variant": False, "category_hierarchy_valid": True, "stock_quantity": 1, "price": 5},
            {"id": "b", "slug": "b", "name": "Pant", "website_serial": "one", "category_slug": "clothing",
             "subcategory_slug": "pant", "sub_subcategory_slug": "flower", "is_active": True,
             "is_primary_variant": True, "category_hierarchy_valid": True, "stock_quantity": 0, "price": 5},
            {"id": "invalid", "slug": "invalid", "name": "Pant", "category_slug": "clothing",
             "subcategory_slug": "pant", "sub_subcategory_slug": "flower", "is_active": True,
             "is_primary_variant": True, "category_hierarchy_valid": False, "stock_quantity": 1, "price": 5},
        ]
        result = products.list_products(
            category="clothing", category_slug="pant", active_only=True, page=1, page_size=24,
            q=None, min_price=None, max_price=None, clearance=False, discounted=False,
            sub_subcategory_slug="flower",
        )
        self.assertEqual(result.total, 1)
        self.assertEqual(result.items[0].id, "a")

    def test_sub_subcategory_options_require_in_stock_visible_products_in_parent(self):
        self.rows = [
            {"id": "1", "category_slug": "clothing", "subcategory_slug": "pant", "sub_subcategory_name": "Flower",
             "sub_subcategory_slug": "flower", "is_active": True, "stock_quantity": 1},
            {"id": "2", "category_slug": "clothing", "subcategory_slug": "pant", "sub_subcategory_name": "Sold Out",
             "sub_subcategory_slug": "sold-out", "is_active": True, "stock_quantity": 0},
            {"id": "3", "category_slug": "accessories", "subcategory_slug": "pant", "sub_subcategory_name": "Wrong Parent",
             "sub_subcategory_slug": "wrong-parent", "is_active": True, "stock_quantity": 1},
            {"id": "4", "category_slug": "clothing", "subcategory_slug": "pant", "sub_subcategory_name": "Invalid",
             "sub_subcategory_slug": "invalid", "is_active": True, "stock_quantity": 1, "category_hierarchy_valid": False},
        ]
        self.assertEqual(products.list_sub_subcategories("clothing", "pant"), [{"name": "Flower", "slug": "flower"}])

    def test_all_in_subcategory_includes_nonprimary_variant_from_that_subcategory(self):
        self.rows = [
            {"id": "primary", "slug": "primary", "name": "Set", "website_serial": "one",
             "category_slug": "clothing", "subcategory_slug": "top", "is_active": True,
             "is_primary_variant": True, "stock_quantity": 1, "price": 5},
            {"id": "pant", "slug": "pant", "name": "Pant", "website_serial": "one",
             "category_slug": "clothing", "subcategory_slug": "pant", "sub_subcategory_slug": "flower",
             "is_active": True, "is_primary_variant": False, "stock_quantity": 1, "price": 5},
        ]
        result = products.list_products(
            category="clothing", category_slug="pant", active_only=True, page=1, page_size=24,
            q=None, min_price=None, max_price=None, clearance=False, discounted=False,
        )
        self.assertEqual(result.total, 1)
        self.assertEqual(result.items[0].id, "pant")


if __name__ == "__main__":
    unittest.main()
