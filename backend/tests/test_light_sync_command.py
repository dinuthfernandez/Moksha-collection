import io
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import light_sync


class LightSyncCommandTests(unittest.TestCase):
    def setUp(self):
        self.settings = SimpleNamespace(
            zoho_client_id="client",
            zoho_client_secret="secret",
            zoho_refresh_token="token",
            zoho_organization_id="org",
        )

    def test_runs_light_sync_once_and_reports_count(self):
        sync = AsyncMock(return_value=12)
        output = io.StringIO()
        with (
            patch.object(light_sync, "get_settings", return_value=self.settings),
            patch.object(light_sync.zoho_inventory, "sync_products_to_supabase", sync),
            patch.object(light_sync.zoho_inventory, "set_progress_callback") as callback,
            redirect_stdout(output),
        ):
            light_sync.main()
        sync.assert_awaited_once_with()
        self.assertIn("Online products processed: 12", output.getvalue())
        self.assertIsNone(callback.call_args.args[0])

    def test_missing_credentials_exits_without_syncing(self):
        self.settings.zoho_refresh_token = ""
        sync = AsyncMock()
        with (
            patch.object(light_sync, "get_settings", return_value=self.settings),
            patch.object(light_sync.zoho_inventory, "sync_products_to_supabase", sync),
            self.assertRaisesRegex(SystemExit, "Missing Zoho Inventory credentials"),
        ):
            light_sync.main()
        sync.assert_not_awaited()

    def test_sync_failure_propagates_and_clears_callback(self):
        sync = AsyncMock(side_effect=RuntimeError("sync failed"))
        with (
            patch.object(light_sync, "get_settings", return_value=self.settings),
            patch.object(light_sync.zoho_inventory, "sync_products_to_supabase", sync),
            patch.object(light_sync.zoho_inventory, "set_progress_callback") as callback,
            redirect_stdout(io.StringIO()),
            self.assertRaisesRegex(RuntimeError, "sync failed"),
        ):
            light_sync.main()
        self.assertIsNone(callback.call_args.args[0])

    def test_zero_products_is_reported(self):
        with (
            patch.object(light_sync, "get_settings", return_value=self.settings),
            patch.object(light_sync.zoho_inventory, "sync_products_to_supabase", AsyncMock(return_value=0)),
            redirect_stdout(io.StringIO()) as output,
        ):
            light_sync.main()
        self.assertIn("No products were processed", output.getvalue())


if __name__ == "__main__":
    unittest.main()
