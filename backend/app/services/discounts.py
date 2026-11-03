"""Scheduled product discounts.

products.price always holds the Zoho price. A discount lives in discount_price/_starts_at/_ends_at and
is applied at read time, so it starts and ends exactly on schedule without any background job."""
from datetime import datetime, timezone
from typing import Any, Optional


def _parse(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def active_discount_price(row: dict, now: Optional[datetime] = None) -> Optional[float]:
    """The discount price if one is running right now and really lowers the price, else None."""
    raw = row.get("discount_price")
    starts, ends = _parse(row.get("discount_starts_at")), _parse(row.get("discount_ends_at"))
    if raw is None or starts is None or ends is None:
        return None
    now = now or datetime.now(timezone.utc)
    discount = float(raw)
    if not (starts <= now < ends) or discount <= 0 or discount >= float(row.get("price") or 0):
        return None
    return discount


def apply_discount(row: dict, now: Optional[datetime] = None) -> dict:
    """Copy of a product row with price swapped to the live discount and original_price set."""
    discount = active_discount_price(row, now)
    if discount is None:
        return {**row, "original_price": None}
    return {**row, "original_price": float(row["price"]), "price": discount, "is_on_sale": True}


def effective_price(row: dict) -> float:
    discount = active_discount_price(row)
    return discount if discount is not None else float(row.get("price") or 0)
