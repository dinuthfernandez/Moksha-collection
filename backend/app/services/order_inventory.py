from ..config import get_settings
from .zoho_inventory import ZohoInventoryClient


def restock_order_items(supabase, order_id: str) -> None:
    """Restore quantities for an order cancelled before shipment."""
    items_result = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    settings = get_settings()
    zoho_configured = all(
        [settings.zoho_client_id, settings.zoho_client_secret, settings.zoho_refresh_token, settings.zoho_organization_id]
    )
    zoho_client = (
        ZohoInventoryClient(
            client_id=settings.zoho_client_id,
            client_secret=settings.zoho_client_secret,
            refresh_token=settings.zoho_refresh_token,
            organization_id=settings.zoho_organization_id,
        )
        if zoho_configured
        else None
    )

    for item in items_result.data or []:
        product_id = item.get("product_id")
        if not product_id:
            continue
        product_result = (
            supabase.table("products")
            .select("stock_quantity,zoho_item_id")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not product_result.data:
            continue
        product = product_result.data[0]
        quantity = int(item.get("quantity") or 0)
        new_stock = (product.get("stock_quantity") or 0) + quantity
        supabase.table("products").update({"stock_quantity": new_stock}).eq("id", product_id).execute()

        if zoho_client and product.get("zoho_item_id"):
            try:
                zoho_client.adjust_stock(product["zoho_item_id"], quantity)
            except Exception:
                pass