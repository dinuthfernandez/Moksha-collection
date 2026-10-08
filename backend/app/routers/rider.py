import hashlib
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..schemas import RiderOrderOut, RiderOrderUpdateIn
from ..services.email import send_sales_email
from ..services.email_templates import render_order_completed_email
from ..services.order_inventory import restock_order_items

router = APIRouter(prefix="/delivery", tags=["delivery rider"])


def _get_order_for_token(token: str) -> dict:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    supabase = get_supabase()
    token_result = (
        supabase.table("order_delivery_tokens")
        .select("order_id")
        .eq("token_hash", token_hash)
        .limit(1)
        .execute()
    )
    if not token_result.data:
        raise HTTPException(status_code=404, detail="Delivery link not found")

    order_result = (
        supabase.table("orders")
        .select("id,customer_name,phone,address,city,email,status,cancel_reason,delivery_attempt_at,delivery_attempt_note,expected_delivery_date")
        .eq("id", token_result.data[0]["order_id"])
        .limit(1)
        .execute()
    )
    if not order_result.data or order_result.data[0].get("status") != "shipped":
        raise HTTPException(status_code=404, detail="Delivery link not found")
    return order_result.data[0]


@router.get("/{token}", response_model=RiderOrderOut)
def get_rider_order(token: str):
    order = _get_order_for_token(token)
    return {key: value for key, value in order.items() if key != "email"}


@router.put("/{token}", response_model=RiderOrderOut)
def update_rider_order(token: str, payload: RiderOrderUpdateIn):
    order = _get_order_for_token(token)
    if order["status"] != "shipped":
        raise HTTPException(status_code=409, detail="This delivery is no longer active")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.action == "attempt_failed":
        if payload.expected_delivery_date is None or payload.expected_delivery_date <= date.today():
            raise HTTPException(status_code=422, detail="Choose a new delivery date in the future")
        note = payload.note.strip() if payload.note else ""
        updates.update(
            {
                "delivery_attempt_at": datetime.now(timezone.utc).isoformat(),
                "delivery_attempt_note": f"Delivery attempt failed: {note}" if note else "Delivery attempt failed",
                "expected_delivery_date": payload.expected_delivery_date.isoformat(),
            }
        )
    elif payload.action == "delivered":
        updates["status"] = "delivered"
    else:
        cancellation_note = payload.note.strip() if payload.note else ""
        if len(cancellation_note) < 2:
            raise HTTPException(status_code=422, detail="Add a cancellation note for the admin")
        updates.update(
            {
                "status": "cancelled",
                "cancelled_by": "rider",
                "cancel_reason": cancellation_note,
            }
        )

    supabase = get_supabase()
    updated = supabase.table("orders").update(updates).eq("id", order["id"]).eq("status", "shipped").execute()
    if not updated.data:
        raise HTTPException(status_code=404, detail="Order not found")
    result = updated.data[0]

    if payload.action == "cancelled":
        restock_order_items(supabase, order["id"])

    if payload.action == "delivered" and order.get("email"):
        try:
            subject, html, text = render_order_completed_email(result)
            send_sales_email(order["email"], subject, html, text)
        except Exception:
            pass

    return {key: value for key, value in result.items() if key != "email"}