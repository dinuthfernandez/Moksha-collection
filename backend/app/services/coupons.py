from datetime import datetime, timezone
from typing import Any


def _as_utc(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def get_current_coupons(supabase) -> list[dict]:
    now = datetime.now(timezone.utc)
    result = supabase.table("coupons").select(
        "id,name,percentage,valid_from,valid_to,minimum_cart_amount,is_active"
    ).eq("is_active", True).execute()
    coupons = []
    for coupon in result.data or []:
        valid_from = _as_utc(coupon.get("valid_from"))
        valid_to = _as_utc(coupon.get("valid_to"))
        if valid_from and valid_to and valid_from <= now <= valid_to:
            coupons.append(coupon)
    return coupons


def select_coupon(coupons: list[dict], subtotal: float) -> dict | None:
    eligible = [
        coupon for coupon in coupons
        if float(coupon.get("minimum_cart_amount") or 0) <= subtotal
    ]
    if not eligible:
        return None
    return max(
        eligible,
        key=lambda coupon: (float(coupon.get("percentage") or 0), -float(coupon.get("minimum_cart_amount") or 0)),
    )


def calculate_coupon_discount(coupon: dict | None, subtotal: float) -> float:
    if not coupon or subtotal <= 0:
        return 0.0
    return round(subtotal * float(coupon["percentage"]) / 100, 3)
