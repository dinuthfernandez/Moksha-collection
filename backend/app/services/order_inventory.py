import logging
from datetime import datetime, timezone

from ..config import get_settings
from .cache import invalidate_catalog
from .variant_labels import display_size
from .zoho_inventory import ZohoInventoryClient

logger = logging.getLogger(__name__)


def load_order_items(supabase, order_id: str) -> list[dict]:
    """Order items with the product's current size/color attached for display."""
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute().data or []
    product_ids = list({item["product_id"] for item in items if item.get("product_id")})
    attributes: dict[str, dict] = {}
    if product_ids:
        products = supabase.table("products").        select("id,size,kids_size,color,product_code").in_("id", product_ids).execute().data or []
        attributes = {product["id"]: product for product in products}
    return [
        {
            **item,
                    "size": display_size(attributes.get(item.get("product_id"), {}).get("size"), attributes.get(item.get("product_id"), {}).get("kids_size")),
            "color": attributes.get(item.get("product_id"), {}).get("color"),
            "product_code": attributes.get(item.get("product_id"), {}).get("product_code"),
        }
        for item in items
    ]


def _zoho_client():
    settings = get_settings()
    if not all([settings.zoho_client_id, settings.zoho_client_secret, settings.zoho_refresh_token, settings.zoho_organization_id]):
        return None
    return ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )


def _restock_items(supabase, zoho_client, order_id: str, items: list[dict]) -> None:
    for item in items:
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


def restock_order_items(supabase, order_id: str) -> None:
    """Restore quantities for an order cancelled before shipment."""
    items_result = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    zoho_client = _zoho_client()
    _restock_items(supabase, zoho_client, order_id, items_result.data or [])
    if zoho_client:
        _void_order_invoice(supabase, zoho_client, order_id)


def refresh_order_return_status(supabase, order_id: str) -> dict:
    """Derives the order-level return status from its items and stores it."""
    items = supabase.table("order_items").select("return_status,return_requested_at,return_completed_at").eq("order_id", order_id).execute().data or []
    statuses = {item.get("return_status") or "none" for item in items}
    if "requested" in statuses:
        status = "requested"
    elif "completed" in statuses:
        status = "completed"
    else:
        status = "none"
    requested = [i["return_requested_at"] for i in items if i.get("return_requested_at")]
    completed = [i["return_completed_at"] for i in items if i.get("return_completed_at")]
    updates = {
        "return_status": status,
        "return_requested_at": min(requested) if requested else None,
        "return_completed_at": max(completed) if completed and status == "completed" else None,
    }
    result = supabase.table("orders").update(updates).eq("id", order_id).execute()
    return result.data[0] if result.data else {}


def complete_item_returns(supabase, order_id: str, item_ids: list[str] | None = None) -> int:
    """Marks requested item returns as completed and restocks exactly those items (local + Zoho).

    Items are claimed atomically first so a double click can never restock twice.
    Returns how many items were completed.
    """
    query = (
        supabase.table("order_items")
        .update({"return_status": "completed", "return_completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("order_id", order_id)
        .eq("return_status", "requested")
    )
    if item_ids is not None:
        query = query.in_("id", item_ids)
    claimed = query.execute().data or []
    if not claimed:
        return 0

    try:
        zoho_client = _zoho_client()
        _restock_items(supabase, zoho_client, order_id, claimed)
    except Exception:
        supabase.table("order_items").update({"return_status": "requested", "return_completed_at": None}).in_(
            "id", [item["id"] for item in claimed]
        ).execute()
        refresh_order_return_status(supabase, order_id)
        raise

    refresh_order_return_status(supabase, order_id)
    remaining = supabase.table("order_items").select("return_status").eq("order_id", order_id).execute().data or []
    if zoho_client and remaining and all(row.get("return_status") == "completed" for row in remaining):
        _void_order_invoice(supabase, zoho_client, order_id)
    return len(claimed)


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