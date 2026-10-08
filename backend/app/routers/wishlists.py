from fastapi import APIRouter, Depends, HTTPException

from ..database import get_supabase
from ..deps import get_current_customer
from ..schemas import WishlistItemIn, WishlistItemOut

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=list[WishlistItemOut])
def list_wishlist(customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = (
        supabase.table("customer_wishlists")
        .select("*")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []
    product_ids = [row["product_id"] for row in rows if row.get("product_id")]
    live: dict = {}
    if product_ids:
        products = (
            supabase.table("products")
            .select("id,slug,size,color,price,image_url,stock_quantity")
            .in_("id", product_ids)
            .execute()
            .data
            or []
        )
        live = {product["id"]: product for product in products}
    enriched = []
    for row in rows:
        product = live.get(row.get("product_id"))
        if product:
            row = {
                **row,
                "size": product.get("size"),
                "color": product.get("color"),
                "stock_quantity": product.get("stock_quantity"),
                "product_slug": product.get("slug") or row.get("product_slug"),
                "price": product.get("price") if product.get("price") is not None else row.get("price"),
                "image_url": product.get("image_url") or row.get("image_url"),
            }
        enriched.append(row)
    return enriched


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
