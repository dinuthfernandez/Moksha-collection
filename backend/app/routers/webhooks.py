import hmac

from fastapi import APIRouter, Header, HTTPException

from ..config import get_settings
from ..database import get_supabase
from ..schemas import ZohoOfflineSaleIn

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
    return result.data