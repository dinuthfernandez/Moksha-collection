import hashlib
import secrets
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_supabase
from ..deps import get_current_admin
from ..schemas import (
    AdminCustomerDetailOut,
    AdminCustomerOut,
    AdminSettingsIn,
    AdminSettingsOut,
    CampaignIn,
    CampaignOut,
    CouponIn,
    CouponOut,
    CouponIn,
    CouponOut,
    DashboardStatsOut,
    DeliveryRateIn,
    DeliveryRateOut,
    OrderDetailOut,
    OrderStatusUpdateIn,
    RiderLinkOut,
    ReturnOrderOut,
)
from ..services.email import send_campaign_email, send_sales_email
from ..services.email_templates import render_order_completed_email
from ..services.order_inventory import restock_order_items

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@router.get("/dashboard", response_model=DashboardStatsOut)
def dashboard_stats():
    supabase = get_supabase()

    customers_result = supabase.table("customers").select("id", count="exact").execute()
    orders_result = supabase.table("orders").select("id", count="exact").execute()
    returns_result = supabase.table("orders").select("id", count="exact").neq("return_status", "none").execute()
    delivered_result = supabase.table("orders").select("subtotal_amount,discount_amount").eq("status", "delivered").execute()

    # Profit estimate = total item price customers paid on delivered orders, excluding delivery charges.
    profit_estimate = sum(
        max(float(row.get("subtotal_amount") or 0) - float(row.get("discount_amount") or 0), 0)
        for row in (delivered_result.data or [])
    )

    return {
        "total_customers": customers_result.count or 0,
        "total_orders": orders_result.count or 0,
        "total_returns": returns_result.count or 0,
        "profit_estimate": round(profit_estimate, 3),
    }


# ---------------------------------------------------------------------------
# Settings (IBAN, WhatsApp number, return window)
# ---------------------------------------------------------------------------
@router.get("/settings", response_model=AdminSettingsOut)
def get_settings_row():
    supabase = get_supabase()
    result = supabase.table("admin_settings").select("*").eq("id", True).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Admin settings row is missing — run the SQL migrations")
    return result.data[0]


@router.put("/settings", response_model=AdminSettingsOut)
def update_settings_row(payload: AdminSettingsIn):
    supabase = get_supabase()
    result = (
        supabase.table("admin_settings")
        .update(
            {
                "iban_number": payload.iban_number,
                "whatsapp_number": payload.whatsapp_number,
                "return_window_days": payload.return_window_days,
                "updated_at": "now()",
            }
        )
        .eq("id", True)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not update settings")
    return result.data[0]


# ---------------------------------------------------------------------------
# Delivery rates
# ---------------------------------------------------------------------------
@router.get("/delivery-rates", response_model=list[DeliveryRateOut])
def list_delivery_rates():
    supabase = get_supabase()
    result = supabase.table("delivery_rates").select(
        "delivery_type,rate_bhd,description,delivery_days_from,delivery_days_to,free_delivery_over_bhd"
    ).execute()
    return result.data or []


@router.put("/delivery-rates/{delivery_type}", response_model=DeliveryRateOut)
def update_delivery_rate(delivery_type: Literal["bahrain", "gcc", "international"], payload: DeliveryRateIn):
    supabase = get_supabase()
    result = (
        supabase.table("delivery_rates")
        .update(
            {
                "rate_bhd": payload.rate_bhd,
                "description": payload.description,
                "delivery_days_from": payload.delivery_days_from,
                "delivery_days_to": payload.delivery_days_to,
                "free_delivery_over_bhd": payload.free_delivery_over_bhd,
                "updated_at": "now()",
            }
        )
        .eq("delivery_type", delivery_type)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Delivery type not found")
    return result.data[0]


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------
@router.get("/coupons", response_model=list[CouponOut])
def list_coupons():
    supabase = get_supabase()
    result = supabase.table("coupons").select("*").order("minimum_cart_amount").execute()
    return result.data or []


@router.post("/coupons", response_model=CouponOut, status_code=201)
def create_coupon(payload: CouponIn):
    supabase = get_supabase()
    result = supabase.table("coupons").insert(payload.model_dump(mode="json")).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not create coupon")
    return result.data[0]


@router.put("/coupons/{coupon_id}", response_model=CouponOut)
def update_coupon(coupon_id: str, payload: CouponIn):
    supabase = get_supabase()
    result = (
        supabase.table("coupons")
        .update({**payload.model_dump(mode="json"), "updated_at": "now()"})
        .eq("id", coupon_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return result.data[0]


@router.delete("/coupons/{coupon_id}", status_code=204)
def delete_coupon(coupon_id: str):
    supabase = get_supabase()
    result = supabase.table("coupons").delete().eq("id", coupon_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Coupon not found")


# ---------------------------------------------------------------------------
# Orders management
# ---------------------------------------------------------------------------
def _load_order_detail(supabase, order: dict) -> dict:
    items_result = supabase.table("order_items").select("*").eq("order_id", order["id"]).execute()
    return {**order, "items": items_result.data or []}


@router.get("/orders", response_model=list[OrderDetailOut])
def list_orders(
    status: Optional[Literal["pending", "accepted", "shipped", "delivered", "cancelled"]] = Query(default=None),
):
    supabase = get_supabase()
    query = supabase.table("orders").select("*")
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).execute()
    return [_load_order_detail(supabase, order) for order in (result.data or [])]


@router.post("/orders/{order_id}/delivery-link", response_model=RiderLinkOut)
def create_delivery_link(order_id: str):
    supabase = get_supabase()
    order_result = supabase.table("orders").select("id,status").eq("id", order_id).limit(1).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")
    if order_result.data[0].get("status") != "shipped":
        raise HTTPException(status_code=409, detail="A rider link is available only for shipped orders")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    supabase.table("order_delivery_tokens").insert({"order_id": order_id, "token_hash": token_hash}).execute()
    return {"token": token}


@router.put("/orders/{order_id}/status", response_model=OrderDetailOut)
def update_order_status(order_id: str, payload: OrderStatusUpdateIn):
    supabase = get_supabase()
    existing = supabase.table("orders").select("*").eq("id", order_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = existing.data[0]

    allowed_transitions = {
        "pending": {"accepted", "cancelled"},
        "accepted": {"shipped", "cancelled"},
        "shipped": {"delivered"},
    }
    if payload.status not in allowed_transitions.get(order.get("status"), set()):
        raise HTTPException(status_code=409, detail=f"Order cannot move from {order.get('status')} to {payload.status}")

    updates: dict = {"status": payload.status, "updated_at": "now()"}
    if payload.status == "cancelled":
        updates["cancel_reason"] = payload.cancel_reason or "Cancelled by admin"
        updates["cancelled_by"] = "admin"

    result = supabase.table("orders").update(updates).eq("id", order_id).eq("status", order["status"]).execute()
    if not result.data:
        raise HTTPException(status_code=409, detail="Order status changed. Refresh and try again")
    if payload.status == "cancelled":
        restock_order_items(supabase, order_id)
    updated_order = _load_order_detail(supabase, result.data[0])

    if payload.status == "delivered" and updated_order.get("email"):
        try:
            subject, html, text = render_order_completed_email(updated_order)
            send_sales_email(updated_order["email"], subject, html, text)
        except Exception:
            # sales@ is not provisioned yet in most environments — this is best-effort only.
            pass

    return updated_order


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------
@router.get("/returns", response_model=list[ReturnOrderOut])
def list_returns():
    supabase = get_supabase()
    result = supabase.table("orders").select("*").eq("return_status", "requested").order("return_requested_at", desc=True).execute()

    orders = []
    for order in result.data or []:
        detail = _load_order_detail(supabase, order)
        customer_id = order.get("customer_id")
        if customer_id:
            customer_result = (
                supabase.table("customers")
                .select("first_name,last_name,email,phone_country_code,phone")
                .eq("id", customer_id)
                .limit(1)
                .execute()
            )
            if customer_result.data:
                customer = customer_result.data[0]
                detail["customer_first_name"] = customer.get("first_name")
                detail["customer_last_name"] = customer.get("last_name")
                detail["customer_account_email"] = customer.get("email")
                detail["customer_account_phone_country_code"] = customer.get("phone_country_code")
                detail["customer_account_phone"] = customer.get("phone")
        orders.append(detail)

    return orders


@router.put("/returns/{order_id}/complete", response_model=OrderDetailOut)
def complete_return(order_id: str):
    supabase = get_supabase()
    existing = supabase.table("orders").select("*").eq("id", order_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Order not found")
    if existing.data[0].get("return_status") != "requested":
        raise HTTPException(status_code=400, detail="This order has no pending return request")

    # Completing a return means the item is physically back — restock it, locally and in Zoho.
    restock_order_items(supabase, order_id)

    result = (
        supabase.table("orders")
        .update({"return_status": "completed", "return_completed_at": "now()"})
        .eq("id", order_id)
        .execute()
    )
    return _load_order_detail(supabase, result.data[0])


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@router.get("/customers", response_model=list[AdminCustomerOut])
def list_customers(search: Optional[str] = Query(default=None, max_length=200)):
    supabase = get_supabase()
    query = supabase.table("customers").select(
        "id,email,first_name,last_name,phone_country_code,phone,country_name,is_active,is_banned,created_at"
    )
    if search:
        like = f"%{search}%"
        query = query.or_(f"email.ilike.{like},first_name.ilike.{like},last_name.ilike.{like},phone.ilike.{like}")
    result = query.order("created_at", desc=True).execute()
    return result.data or []


@router.get("/customers/{customer_id}", response_model=AdminCustomerDetailOut)
def get_customer_detail(customer_id: str):
    supabase = get_supabase()
    customer_result = supabase.table("customers").select("*").eq("id", customer_id).limit(1).execute()
    if not customer_result.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer = customer_result.data[0]

    addresses_result = supabase.table("customer_addresses").select("*").eq("customer_id", customer_id).execute()
    orders_result = supabase.table("orders").select("*").eq("customer_id", customer_id).order("created_at", desc=True).execute()
    orders = [_load_order_detail(supabase, order) for order in (orders_result.data or [])]

    return {**customer, "addresses": addresses_result.data or [], "orders": orders}


@router.put("/customers/{customer_id}/ban", response_model=AdminCustomerOut)
def set_customer_ban(customer_id: str, is_banned: bool = Query(...)):
    supabase = get_supabase()
    result = supabase.table("customers").update({"is_banned": is_banned}).eq("id", customer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return result.data[0]


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------
@router.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns():
    supabase = get_supabase()
    result = supabase.table("campaigns").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("/campaigns", response_model=CampaignOut, status_code=201)
def send_campaign(payload: CampaignIn):
    supabase = get_supabase()
    customers_result = supabase.table("customers").select("email").eq("is_banned", False).execute()
    emails = [row["email"] for row in (customers_result.data or []) if row.get("email")]

    sent_count = 0
    for email in emails:
        try:
            send_campaign_email(email, payload.subject, payload.body)
            sent_count += 1
        except Exception:
            # Keep sending to the rest of the list even if one recipient fails.
            continue

    result = (
        supabase.table("campaigns")
        .insert({"subject": payload.subject, "body": payload.body, "recipient_count": sent_count})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not log the campaign")
    return result.data[0]
