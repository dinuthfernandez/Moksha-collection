import logging
from datetime import datetime, timezone

from ..config import get_settings
from .cache import invalidate_catalog
from .zoho_inventory import ZohoInventoryClient

logger = logging.getLogger(__name__)


def load_order_items(supabase, order_id: str) -> list[dict]:
    """Order items with the product's current size/color attached for display."""
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute().data or []
    product_ids = list({item["product_id"] for item in items if item.get("product_id")})
    attributes: dict[str, dict] = {}
    if product_ids:
        products = supabase.table("products").select("id,size,color,product_code").in_("id", product_ids).execute().data or []
        attributes = {product["id"]: product for product in products}
    return [
        {
            **item,
            "size": attributes.get(item.get("product_id"), {}).get("size"),
            "color": attributes.get(item.get("product_id"), {}).get("color"),
            "product_code": attributes.get(item.get("product_id"), {}).get("product_code"),
        }
        for item in items
    ]


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
        invalidate_catalog()

        if zoho_client and product.get("zoho_item_id"):
            try:
                zoho_client.adjust_stock(product["zoho_item_id"], quantity)
            except Exception:
                logger.exception("Zoho restock failed for order %s item %s", order_id, product_id)

    if zoho_client:
        _void_order_invoice(supabase, zoho_client, order_id)


def _void_order_invoice(supabase, zoho_client: ZohoInventoryClient, order_id: str) -> None:
    """Mark the order's Zoho invoice as void once; failures never block the restock."""
    try:
        order = supabase.table("orders").select("zoho_invoice_id").eq("id", order_id).limit(1).execute().data
        invoice_id = order[0].get("zoho_invoice_id") if order else None
        if not invoice_id:
            return
        try:
            voided = (
                supabase.table("orders").select("zoho_invoice_voided_at").eq("id", order_id).limit(1).execute().data
            )
            if voided and voided[0].get("zoho_invoice_voided_at"):
                return
        except Exception:
            pass  # column not created yet; fall through and void
        zoho_client.void_invoice(invoice_id)
        try:
            supabase.table("orders").update({"zoho_invoice_voided_at": datetime.now(timezone.utc).isoformat()}).eq(
                "id", order_id
            ).execute()
        except Exception:
            logger.warning("Could not record invoice void time for order %s", order_id)
    except Exception:
        logger.exception("Zoho invoice void failed for order %s", order_id)