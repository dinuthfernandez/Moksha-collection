import hmac

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings
from ..database import get_supabase
from ..schemas import ZohoOfflineSaleIn
from ..services.cache import invalidate_catalog

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/zoho/offline-sale")
def notify_zoho_offline_sale(
    payload: ZohoOfflineSaleIn,
    webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
):
    expected_secret = get_settings().zoho_offline_sale_webhook_secret
    if not expected_secret:
        raise HTTPException(status_code=503, detail="Offline sale webhook is not configured")
    if not webhook_secret or not hmac.compare_digest(webhook_secret, expected_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    result = get_supabase().rpc(
        "apply_zoho_offline_sale",
        {
            "p_event_id": payload.invoice_id,
            "p_items": [
                {"item_id": line.item_id, "quantity": line.quantity_sold}
                for line in payload.line_items
            ],
        },
    ).execute()
    invalidate_catalog()
    return result.data


class CreatorPaymentConfirmedIn(BaseModel):
    order_number: str = Field(min_length=1, max_length=80)


@router.post("/creator/payment-confirmed")
def creator_payment_confirmed(
    payload: CreatorPaymentConfirmedIn,
    webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
):
    """Called by the Zoho Creator 'Confirm Payment' action: moves the order pending -> accepted."""
    expected_secret = get_settings().creator_webhook_secret
    if not expected_secret:
        raise HTTPException(status_code=503, detail="Creator webhook is not configured")
    if not webhook_secret or not hmac.compare_digest(webhook_secret, expected_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    supabase = get_supabase()
    found = supabase.table("orders").select("id,status").eq("id", payload.order_number.strip()).limit(1).execute()
    if not found.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = found.data[0]

    if order["status"] != "pending":
        if order["status"] == "cancelled":
            raise HTTPException(status_code=409, detail="Order was cancelled on the website")
        return {"order_id": order["id"], "status": order["status"], "changed": False}

    updated = (
        supabase.table("orders")
        .update({"status": "accepted", "updated_at": "now()"})
        .eq("id", order["id"])
        .eq("status", "pending")
        .execute()
    )
    return {"order_id": order["id"], "status": "accepted", "changed": bool(updated.data)}