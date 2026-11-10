import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services import product_images, zoho_inventory


class ZohoImageSyncTests(unittest.TestCase):
    def setUp(self):
        self.item = {
            "item_id": "item-1",
            "name": "Kurti",
            "sku": "SKU-1",
            "status": "active",
            "image_document_id": "image-1",
        }
        self.row = {
            "id": "row-1",
            "zoho_item_id": "item-1",
            "slug": "kurti",
            "is_active": True,
            "image_url": "https://example.test/old.jpg",
            "image_source_id": "image-1",
            **zoho_inventory._light_record(self.item),
            **zoho_inventory._category_fields(self.item, {}),
        }

    def run_light_sync(self, items, rows, client):
        supabase = Mock()
        settings = SimpleNamespace(
            zoho_client_id="client",
            zoho_client_secret="secret",
            zoho_refresh_token="token",
            zoho_organization_id="org",
        )
        with (
            patch.object(zoho_inventory, "get_supabase", return_value=supabase),
            patch.object(zoho_inventory, "get_settings", return_value=settings),
            patch.object(zoho_inventory, "ZohoInventoryClient", return_value=client),
            patch.object(zoho_inventory, "_load_products", return_value=rows),
            patch.object(zoho_inventory, "_is_online_store_enabled", return_value=True),
            patch.object(zoho_inventory, "_apply_updates") as updates,
            patch.object(zoho_inventory, "_sync_subcategories_to_categories"),
            patch.object(zoho_inventory, "invalidate_catalog") as invalidate,
            patch.object(zoho_inventory, "store_product_image", return_value="https://example.test/new.jpg") as store,
        ):
            zoho_inventory._write_products_to_supabase(items, partial=True, light=True)
            return updates.call_args.args[1], supabase, store, invalidate

    def test_existing_unchanged_image_is_not_downloaded_or_written(self):
        client = Mock()
        updates, _, store, invalidate = self.run_light_sync([self.item], [self.row], client)
        self.assertEqual(updates, [])
        client.download_item_image.assert_not_called()
        store.assert_not_called()
        invalidate.assert_not_called()

    def test_existing_changed_image_is_downloaded_and_updated(self):
        item = {**self.item, "image_document_id": "image-2"}
        client = Mock()
        client.download_item_image.return_value = b"new image"
        updates, _, store, invalidate = self.run_light_sync([item], [self.row], client)
        client.download_item_image.assert_called_once_with("item-1")
        store.assert_called_once_with("item-1", b"new image")
        self.assertEqual(updates[0][0], "row-1")
        self.assertEqual(updates[0][1]["image_url"], "https://example.test/new.jpg")
        self.assertEqual(updates[0][1]["image_source_id"], "image-2")
        self.assertNotIn("description", updates[0][1])
        invalidate.assert_called_once()

    def test_new_product_downloads_image(self):
        client = Mock()
        client.download_item_image.return_value = b"new image"
        _, supabase, store, _ = self.run_light_sync([self.item], [], client)
        client.download_item_image.assert_called_once_with("item-1")
        store.assert_called_once_with("item-1", b"new image")
        inserted = supabase.table.return_value.insert.call_args.args[0]
        self.assertEqual(inserted[0]["image_url"], "https://example.test/new.jpg")
        self.assertEqual(inserted[0]["image_source_id"], "image-1")

    def test_existing_product_without_stored_image_downloads_it(self):
        row = {**self.row, "image_url": None}
        client = Mock()
        client.download_item_image.return_value = b"new image"
        updates, _, store, _ = self.run_light_sync([self.item], [row], client)
        client.download_item_image.assert_called_once_with("item-1")
        store.assert_called_once_with("item-1", b"new image")
        self.assertEqual(updates[0][1]["image_url"], "https://example.test/new.jpg")

    def test_failed_or_unavailable_download_preserves_image_for_retry(self):
        item = {**self.item, "image_document_id": "image-2"}
        for response in (None, RuntimeError("download failed")):
            with self.subTest(response=response):
                client = Mock()
                if isinstance(response, Exception):
                    client.download_item_image.side_effect = response
                else:
                    client.download_item_image.return_value = response
                with self.assertLogs(zoho_inventory.logger, level="WARNING"):
                    updates, _, store, _ = self.run_light_sync([item], [self.row], client)
                self.assertEqual(updates, [])
                store.assert_not_called()

    def test_missing_metadata_preserves_existing_image(self):
        item = {key: value for key, value in self.item.items() if key != "image_document_id"}
        client = Mock()
        with self.assertLogs(zoho_inventory.logger, level="WARNING"):
            updates, _, store, _ = self.run_light_sync([item], [self.row], client)
        self.assertEqual(updates, [])
        client.download_item_image.assert_not_called()
        store.assert_not_called()

    def test_removed_zoho_image_clears_existing_image(self):
        item = {**self.item, "image_document_id": ""}
        client = Mock()
        updates, _, store, _ = self.run_light_sync([item], [self.row], client)
        self.assertIsNone(updates[0][1]["image_url"])
        self.assertIsNone(updates[0][1]["image_source_id"])
        client.download_item_image.assert_not_called()
        store.assert_not_called()

    def test_direct_image_url_without_document_id_is_updated(self):
        item = {**self.item, "image_document_id": "", "image_url": "https://example.test/direct.jpg"}
        client = Mock()
        updates, _, store, _ = self.run_light_sync([item], [self.row], client)
        self.assertEqual(updates[0][1]["image_url"], "https://example.test/direct.jpg")
        self.assertIsNone(updates[0][1]["image_source_id"])
        client.download_item_image.assert_not_called()
        store.assert_not_called()

    def test_image_urls_change_with_image_contents(self):
        supabase = Mock()
        bucket = supabase.storage.from_.return_value
        bucket.get_public_url.side_effect = lambda path: f"https://example.test/{path}"
        with (
            patch.object(product_images, "get_supabase", return_value=supabase),
            patch.object(product_images, "_ensure_bucket"),
            patch.object(product_images, "compress_image", side_effect=lambda data: data),
        ):
            first = product_images.store_product_image("item-1", b"one")
            same = product_images.store_product_image("item-1", b"one")
            changed = product_images.store_product_image("item-1", b"two")
        self.assertEqual(first, same)
        self.assertNotEqual(first, changed)


if __name__ == "__main__":
    unittest.main()
