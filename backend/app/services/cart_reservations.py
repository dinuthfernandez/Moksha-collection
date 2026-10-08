import asyncio
import logging

from ..config import get_settings
from ..database import get_supabase
from .cache import invalidate_catalog
from .zoho_inventory import ZohoInventoryClient

logger = logging.getLogger(__name__)


class ReservationError(RuntimeError):
    pass


def _zoho_client() -> ZohoInventoryClient:
    settings = get_settings()
    credentials = (
        settings.zoho_client_id,
        settings.zoho_client_secret,
        settings.zoho_refresh_token,
        settings.zoho_organization_id,
    )
    if not all(credentials):
        raise ReservationError("Inventory reservation is unavailable because Zoho is not configured")
    return ZohoInventoryClient(*credentials)


def set_cart_product_reservation(cart_id: str, product_id: str, quantity: int) -> dict:
    client = _zoho_client()
    supabase = get_supabase()
    result = supabase.rpc(
        "set_cart_stock_reservation",
        {
            "p_cart_id": cart_id,
            "p_product_id": product_id,
            "p_quantity": quantity,
            "p_expires_at": None,
        },
    ).execute()
    if not result.data:
        raise ReservationError("Could not reserve this product")
    invalidate_catalog()

    reservation = result.data[0]
    delta = int(reservation.get("delta_quantity") or 0)
    if delta:
        try:
            client.adjust_stock(str(reservation["zoho_item_id"]), -delta)
        except Exception as exc:
            try:
                supabase.rpc(
                    "set_cart_stock_reservation",
                    {
                        "p_cart_id": cart_id,
                        "p_product_id": product_id,
                        "p_quantity": int(reservation.get("previous_quantity") or 0),
                        "p_expires_at": reservation.get("previous_expires_at"),
                    },
                ).execute()
            except Exception:
                logger.exception("Failed to roll back Supabase cart reservation after Zoho adjustment failure")
            raise ReservationError("Zoho Inventory could not reserve this product") from exc

    return {
        "product_id": product_id,
        "quantity": int(reservation.get("reserved_quantity") or 0),
        "expires_at": reservation.get("expires_at"),
        "stock_quantity": int(reservation.get("stock_quantity") or 0),
    }


def release_expired_cart_reservations() -> int:
    supabase = get_supabase()
    result = supabase.rpc("claim_expired_cart_stock_reservations", {"p_limit": 100}).execute()
    reservations = result.data or []
    if not reservations:
        return 0

    client = _zoho_client()
    released = 0
    for reservation in reservations:
        cart_id = str(reservation["cart_id"])
        product_id = str(reservation["product_id"])
        expires_at = reservation["expires_at"]
        try:
            client.adjust_stock(str(reservation["zoho_item_id"]), int(reservation["quantity"]))
        except Exception:
            logger.exception("Zoho failed to release an expired cart stock reservation")
            try:
                supabase.rpc(
                    "unclaim_expired_cart_stock_reservation",
                    {"p_cart_id": cart_id, "p_product_id": product_id, "p_expires_at": expires_at},
                ).execute()
            except Exception:
                logger.exception("Failed to return expired reservation to the retry queue")
            continue

        try:
            completed = supabase.rpc(
                "complete_expired_cart_stock_reservation",
                {"p_cart_id": cart_id, "p_product_id": product_id, "p_expires_at": expires_at},
            ).execute()
            if completed.data is True or completed.data == [True]:
                released += 1
        except Exception:
            logger.exception("Zoho stock was released but Supabase reservation completion failed")
    invalidate_catalog()
    return released


async def cart_reservation_expiry_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(release_expired_cart_reservations)
        except Exception:
            logger.exception("Cart reservation expiry worker failed")
        await asyncio.sleep(30)