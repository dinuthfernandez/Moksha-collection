import json
import logging
from datetime import datetime
from urllib import request

from ..config import get_settings
from .zoho_inventory import ZohoInventoryClient

logger = logging.getLogger(__name__)

_client: ZohoInventoryClient | None = None


def _token() -> str:
    # Reuse the Zoho OAuth client (it caches and refreshes the access token).
    global _client
    settings = get_settings()
    if _client is None:
        _client = ZohoInventoryClient(
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        )
    return _client.get_access_token()


def _money(value) -> str:
    return f"{float(value or 0):.3f}"


def invoice_url(invoice_id: str | None) -> str:
    settings = get_settings()
    if not invoice_id:
        return ""
    return settings.zoho_invoice_url_template.format(org=settings.zoho_organization_id, id=invoice_id)


def push_online_order(order: dict, items: list[dict], invoice_id: str | None, invoice_number: str | None) -> None:
    """Sends a website order to the Creator Online Orders form. Never raises."""
    settings = get_settings()
    if not (settings.zoho_creator_owner and settings.zoho_creator_app and settings.zoho_creator_orders_form):
        return
    try:
        summary = "; ".join(
            f"{i.get('product_name') or i.get('product_id')} x{i['quantity']} @ {_money(i['price'])}" for i in items
        )
        created = order.get("created_at") or datetime.now().isoformat()
        data = {
            "Order_Number": str(order["id"]),
            "Order_Date": str(created)[:16].replace("T", " "),
            "Customer_Name": order.get("customer_name") or "",
            "Phone": order.get("phone") or "",
            "Email": order.get("email") or "",
            "Address": order.get("address") or "",
            "City": order.get("city") or "",
            "Items_Summary": summary[:255],
            "Items_Count": str(sum(int(i["quantity"]) for i in items)),
            "Subtotal": _money(order.get("subtotal_amount")),
            "Discount": _money(order.get("discount_amount")),
            "Delivery_Fee": _money(order.get("delivery_charge")),
            "Total": _money(order.get("total_amount")),
            "Currency": "BHD",
            "Payment_Method": "Online",
            "Payment_Status": "Pending",
            "Books_Invoice_ID": invoice_id or "",
            "Books_Invoice_URL": invoice_url(invoice_id),
            "Notes": (order.get("notes") or "")[:255],
        }
        url = (
            f"{settings.zoho_creator_api_url}/data/{settings.zoho_creator_owner}/"
            f"{settings.zoho_creator_app}/form/{settings.zoho_creator_orders_form}"
        )
        req = request.Request(
            url,
            data=json.dumps({"data": data}).encode("utf-8"),
            headers={"Authorization": f"Zoho-oauthtoken {_token()}", "Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if body.get("code") != 3000:
            logger.error("Creator rejected order %s: %s", order["id"], body)
    except Exception:
        logger.exception("Could not push order %s to Zoho Creator", order.get("id"))
