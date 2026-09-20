from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from ..database import get_supabase
from ..schemas import ProductListOut, ProductOut, ProductStockAdjustIn
from ..services.zoho_inventory import ZohoInventoryClient
from ..config import get_settings

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListOut)
def list_products(
    category: Optional[Literal["clothing", "accessories"]] = None,
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=200),
):
    supabase = get_supabase()
    query = supabase.table("products").select("*", count="exact")
    if active_only:
        query = query.eq("is_active", True).gt("stock_quantity", 0)
    if category:
        query = query.eq("category_slug", category)

    start = (page - 1) * page_size
    end = start + page_size - 1
    result = query.order("created_at", desc=True).range(start, end).execute()

    total = result.count or 0
    total_pages = max((total + page_size - 1) // page_size, 1)
    return ProductListOut(items=result.data, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str):
    supabase = get_supabase()
    result = supabase.table("products").select("*").eq("slug", slug).limit(1).execute()
    # Out-of-stock products are treated the same as not-found so they never surface on the storefront.
    if not result.data or (result.data[0].get("stock_quantity") or 0) <= 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return result.data[0]


@router.post("/sync")
async def trigger_sync():
    settings = get_settings()
    if not all(
        [
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        ]
    ):
        raise HTTPException(status_code=400, detail="Zoho Inventory credentials are not configured")

    from ..services.zoho_inventory import sync_products_to_supabase

    synced = await sync_products_to_supabase()
    return {"status": "ok", "synced": synced}


@router.post("/stock-adjust")
def adjust_stock(payload: ProductStockAdjustIn):
    settings = get_settings()
    if not all(
        [
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        ]
    ):
        raise HTTPException(status_code=400, detail="Zoho Inventory credentials are not configured")

    supabase = get_supabase()
    product = supabase.table("products").select("zoho_item_id,stock_quantity").eq("id", payload.product_id).limit(1).execute()
    if not product.data:
        raise HTTPException(status_code=404, detail="Product not found")

    row = product.data[0]
    zoho_item_id = row.get("zoho_item_id")
    if not zoho_item_id:
        raise HTTPException(status_code=400, detail="This product is not synced from Zoho Inventory")

    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )
    client.adjust_stock(zoho_item_id, -payload.quantity)

    new_stock = max((row.get("stock_quantity") or 0) - payload.quantity, 0)
    supabase.table("products").update({"stock_quantity": new_stock}).eq("id", payload.product_id).execute()
    return {"status": "ok", "product_id": payload.product_id, "new_stock": new_stock}
