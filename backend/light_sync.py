import asyncio
import logging

from app.config import get_settings
from app.services import zoho_inventory


def main() -> None:
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("app.services.zoho_inventory").setLevel(logging.INFO)

    settings = get_settings()
    if not all(
        (
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        )
    ):
        raise SystemExit("Missing Zoho Inventory credentials. Check the service environment settings.")

    print("Starting one-time Zoho light sync...", flush=True)
    zoho_inventory.set_progress_callback(
        lambda percent, message: print(f"{percent:.0f}% {message}", flush=True)
    )
    try:
        count = asyncio.run(zoho_inventory.sync_products_to_supabase())
    finally:
        zoho_inventory.set_progress_callback(None)

    print(f"Sync finished. Online products processed: {count}", flush=True)
    if count == 0:
        print("No products were processed; check the Zoho inventory and logs.", flush=True)


if __name__ == "__main__":
    main()
