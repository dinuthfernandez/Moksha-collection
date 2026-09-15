from fastapi import APIRouter, Depends, HTTPException

from ..database import get_supabase
from ..deps import get_current_customer
from ..schemas import WishlistItemIn, WishlistItemOut

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=list[WishlistItemOut])
def list_wishlist(customer: dict = Depends(get_current_customer)):
    result = (
        get_supabase()
        .table("customer_wishlists")
        .select("*")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("", response_model=WishlistItemOut, status_code=201)
def add_to_wishlist(payload: WishlistItemIn, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    existing = (
        supabase.table("customer_wishlists")
        .select("*")
        .eq("customer_id", customer["id"])
        .eq("product_id", payload.product_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    result = (
        supabase.table("customer_wishlists")
        .insert({**payload.model_dump(), "customer_id": customer["id"]})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not save this item")
    return result.data[0]


@router.delete("/{product_id}", status_code=204)
def remove_from_wishlist(product_id: str, customer: dict = Depends(get_current_customer)):
    get_supabase().table("customer_wishlists").delete().eq("customer_id", customer["id"]).eq(
        "product_id", product_id
    ).execute()
