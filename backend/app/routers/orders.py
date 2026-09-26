import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..database import get_supabase
from ..deps import get_current_customer, get_optional_customer
from ..schemas import OrderDetailOut, OrderIn, OrderOut
from ..services.email import send_sales_email
from ..services.email_templates import render_order_placed_email
from ..services.zoho_inventory import create_invoice_for_order
from ..services.coupons import calculate_coupon_discount, get_current_coupons, select_coupon

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_delivery_charge(supabase, delivery_type: str, subtotal_amount: float) -> float:
    result = (
        supabase.table("delivery_rates")
        .select("rate_bhd,free_delivery_over_bhd")
        .eq("delivery_type", delivery_type)
        .limit(1)
        .execute()
    )
    if not result.data:
        return 0.0
    rate = result.data[0]
    threshold = rate.get("free_delivery_over_bhd")
    if threshold is not None and subtotal_amount >= float(threshold):
        return 0.0
    return float(rate.get("rate_bhd") or 0)


def _get_return_window_days(supabase) -> int:
    result = supabase.table("admin_settings").select("return_window_days").eq("id", True).limit(1).execute()
    if not result.data:
        return 7
    return int(result.data[0].get("return_window_days") or 7)


@router.post("", response_model=OrderOut, status_code=201)
async def create_order(payload: OrderIn, customer: dict | None = Depends(get_optional_customer)):
    supabase = get_supabase()

    product_ids = [item.product_id for item in payload.items]
    products_result = supabase.table("products").select("*").in_("id", product_ids).execute()
    products_by_id = {row["id"]: row for row in (products_result.data or [])}

    missing = [pid for pid in product_ids if pid not in products_by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Product(s) not found: {', '.join(missing)}")

    subtotal_amount = 0.0
    order_items_records = []
    zoho_line_items = []
    for item in payload.items:
        product = products_by_id[item.product_id]
        if product.get("stock_quantity", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"'{product['name']}' does not have enough stock")

        price = float(product.get("price") or 0)
        subtotal_amount += price * item.quantity
        order_items_records.append(
            {
                "product_id": product["id"],
                "product_name": product.get("name"),
                "product_image_url": product.get("image_url"),
                "quantity": item.quantity,
                "price": price,
            }
        )
        if product.get("zoho_item_id"):
            zoho_line_items.append(
                {
                    "item_id": product["zoho_item_id"],
                    "name": product["name"],
                    "quantity": item.quantity,
                    "rate": price,
                }
            )

    coupon_schema_available = True
    try:
        active_coupons = get_current_coupons(supabase)
    except Exception:
        # Preserve checkout for existing deployments until the coupon migration is applied.
        active_coupons = []
        coupon_schema_available = False
    coupon = select_coupon(active_coupons, subtotal_amount)
    discount_amount = calculate_coupon_discount(coupon, subtotal_amount)
    discount_percentage = float(coupon["percentage"]) if coupon else 0.0
    delivery_charge = _get_delivery_charge(supabase, payload.delivery_type, subtotal_amount)
    total_amount = max(0.0, subtotal_amount - discount_amount) + delivery_charge

    if discount_percentage:
        for line_item in zoho_line_items:
            line_item["rate"] = round(float(line_item["rate"]) * (1 - discount_percentage / 100), 3)

    order_values = {
        "customer_id": customer["id"] if customer else None,
        "customer_name": payload.customer_name,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "city": payload.city,
        "notes": payload.notes,
        "delivery_type": payload.delivery_type,
        "delivery_charge": delivery_charge,
        "subtotal_amount": subtotal_amount,
        "total_amount": total_amount,
        "status": "pending",
    }
    if coupon_schema_available:
        order_values.update(
            {
                "discount_amount": discount_amount,
                "coupon_id": coupon["id"] if coupon else None,
                "coupon_name": coupon["name"] if coupon else None,
                "coupon_percentage": discount_percentage if coupon else None,
            }
        )

    order_result = supabase.table("orders").insert(order_values).execute()
    if not order_result.data:
        raise HTTPException(status_code=500, detail="Could not create the order")
    order = order_result.data[0]

    for record in order_items_records:
        supabase.table("order_items").insert({**record, "order_id": order["id"]}).execute()

    for item in payload.items:
        product = products_by_id[item.product_id]
        new_stock = max(product.get("stock_quantity", 0) - item.quantity, 0)
        supabase.table("products").update({"stock_quantity": new_stock}).eq("id", product["id"]).execute()

    zoho_invoice_id = None
    zoho_invoice_number = None
    settings = get_settings()
    zoho_configured = all(
        [settings.zoho_client_id, settings.zoho_client_secret, settings.zoho_refresh_token, settings.zoho_organization_id]
    )
    if zoho_configured and zoho_line_items:
        try:
            invoice = await asyncio.to_thread(
                create_invoice_for_order,
                payload.customer_name,
                payload.phone,
                payload.email,
                payload.address,
                payload.city,
                payload.notes,
                zoho_line_items,
            )
            zoho_invoice_id = invoice.get("invoice_id")
            zoho_invoice_number = invoice.get("invoice_number")
            supabase.table("orders").update(
                {"zoho_invoice_id": zoho_invoice_id, "zoho_invoice_number": zoho_invoice_number}
            ).eq("id", order["id"]).execute()
        except Exception as exc:
            # The order itself still succeeds even if the Zoho invoice call fails —
            # inventory sync and manual invoicing can be retried separately.
            supabase.table("orders").update({"notes": f"{payload.notes or ''} | Zoho invoice failed: {exc}"}).eq(
                "id", order["id"]
            ).execute()

    if payload.email:
        try:
            subject, html, text = render_order_placed_email({**order, "items": order_items_records})
            send_sales_email(payload.email, subject, html, text)
        except Exception:
            # sales@ is not provisioned yet in most environments — this is best-effort only.
            pass

    return {
        "id": order["id"],
        "total_amount": total_amount,
        "subtotal_amount": subtotal_amount,
        "delivery_charge": delivery_charge,
        "discount_amount": discount_amount,
        "coupon_name": coupon["name"] if coupon else None,
        "coupon_percentage": discount_percentage if coupon else None,
        "delivery_type": payload.delivery_type,
        "status": order["status"],
        "zoho_invoice_id": zoho_invoice_id,
        "zoho_invoice_number": zoho_invoice_number,
        "created_at": order.get("created_at"),
    }


def _load_order_detail(supabase, order: dict) -> dict:
    items_result = supabase.table("order_items").select("*").eq("order_id", order["id"]).execute()
    return {**order, "items": items_result.data or []}


@router.get("/mine", response_model=list[OrderDetailOut])
def list_my_orders(customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = (
        supabase.table("orders")
        .select("*")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return [_load_order_detail(supabase, order) for order in (result.data or [])]


@router.post("/{order_id}/return", response_model=OrderDetailOut)
def request_return(order_id: str, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = supabase.table("orders").select("*").eq("id", order_id).eq("customer_id", customer["id"]).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data[0]
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")
    if order.get("return_status") != "none":
        raise HTTPException(status_code=400, detail="A return has already been requested for this order")

    window_days = _get_return_window_days(supabase)
    delivered_at_raw = order.get("updated_at") or order.get("created_at")
    try:
        delivered_at = datetime.fromisoformat(delivered_at_raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        delivered_at = datetime.now(timezone.utc)
    if (datetime.now(timezone.utc) - delivered_at).days > window_days:
        raise HTTPException(status_code=400, detail=f"Return window of {window_days} days has expired")

    update_result = (
        supabase.table("orders")
        .update({"return_status": "requested", "return_requested_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", order_id)
        .execute()
    )
    return _load_order_detail(supabase, update_result.data[0])

