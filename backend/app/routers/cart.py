import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException

from ..schemas import CartReservationIn
from ..services.cart_reservations import ReservationError, set_cart_product_reservation

router = APIRouter(prefix="/cart", tags=["cart"])


@router.put("/reservations/{product_id}")
async def update_cart_reservation(product_id: UUID, payload: CartReservationIn):
    try:
        return await asyncio.to_thread(
            set_cart_product_reservation,
            str(payload.cart_id),
            str(product_id),
            payload.quantity,
        )
    except ReservationError as exc:
        message = str(exc)
        if "insufficient_stock" in message:
            raise HTTPException(status_code=409, detail="There is not enough stock for that quantity") from exc
        if "expired" in message:
            raise HTTPException(status_code=410, detail="This cart hold expired. Add the product again to reserve it") from exc
        raise HTTPException(status_code=503, detail=message) from exc
    except Exception as exc:
        message = str(exc)
        if "product_not_found" in message or "product_not_available" in message:
            raise HTTPException(status_code=409, detail="This product is no longer available") from exc
        if "insufficient_stock" in message:
            raise HTTPException(status_code=409, detail="There is not enough stock for that quantity") from exc
        if "expired" in message or "releasing" in message:
            raise HTTPException(status_code=410, detail="This cart hold expired. Add the product again to reserve it") from exc
        raise