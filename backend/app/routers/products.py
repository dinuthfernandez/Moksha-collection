import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_supabase
from ..deps import get_current_admin
from ..schemas import ProductListOut, ProductOut, ProductStockAdjustIn
from ..services.cache import cached, invalidate_catalog
from ..services.zoho_inventory import ZohoInventoryClient
from ..config import get_settings

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListOut)
def list_products(
    category: Optional[Literal["clothing", "accessories"]] = None,
    category_slug: Optional[str] = Query(default=None, max_length=120),
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=200),
    q: Optional[str] = Query(default=None, max_length=120),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="Minimum price cannot exceed maximum price")

    supabase = get_supabase()
    query = supabase.table("products").select("*", count="exact")
    if active_only:
        query = query.eq("is_active", True).gt("stock_quantity", 0)
    if category:
        query = query.eq("category_slug", category)
    if category_slug:
        # `category_slug` here is actually a Zoho Product Sub Category slug
        # (e.g. "kurti", "earrings") — subcategory browsing pages pass it in.
        query = query.eq("subcategory_slug", category_slug)
    if not q:
        # Listing/grid views show one card per design: the primary (smallest
        # size) variant. A search query intentionally ignores this so every
        # matching variant is still findable by its own SKU/name.
        query = query.eq("is_primary_variant", True)
    if q:
        safe_term = re.sub(r"[^a-zA-Z0-9 _-]", "", q.strip())
        if safe_term:
            query = query.or_(
                f"name.ilike.%{safe_term}%,description.ilike.%{safe_term}%,"
                f"product_code.ilike.%{safe_term}%,zoho_sku.ilike.%{safe_term}%"
            )
    if min_price is not None:
        query = query.gte("price", min_price)
    if max_price is not None:
        query = query.lte("price", max_price)

    start = (page - 1) * page_size
    end = start + page_size - 1

    def load() -> ProductListOut:
        result = query.order("created_at", desc=True).range(start, end).execute()
        total = result.count or 0
        total_pages = max((total + page_size - 1) // page_size, 1)
        return ProductListOut(items=result.data, total=total, page=page, page_size=page_size, total_pages=total_pages)

    cache_key = f"products:{category}:{category_slug}:{active_only}:{page}:{page_size}:{q}:{min_price}:{max_price}"
    return cached(cache_key, 60, load)


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str):
    def load() -> dict:
        supabase = get_supabase()
        result = supabase.table("products").select("*").eq("slug", slug).limit(1).execute()
        # Out-of-stock products are treated the same as not-found so they never surface on the storefront.
        if not result.data or (result.data[0].get("stock_quantity") or 0) <= 0:
            raise HTTPException(status_code=404, detail="Product not found")
        product = dict(result.data[0])

        website_serial = product.get("website_serial")
        if website_serial:
            siblings = (
                supabase.table("products")
                .select("id,slug,name,color,size,image_url,price,stock_quantity,is_primary_variant")
                .eq("website_serial", website_serial)
                .eq("is_active", True)
                .gt("stock_quantity", 0)
                .execute()
            )
            product["variants"] = siblings.data or []
        else:
            product["variants"] = []
        return product

    return cached(f"product:{slug}", 60, load)


@router.post("/sync", dependencies=[Depends(get_current_admin)])
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
    invalidate_catalog()
    return {"status": "ok", "synced": synced}


@router.post("/stock-adjust", dependencies=[Depends(get_current_admin)])
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
    invalidate_catalog()
    return {"status": "ok", "product_id": payload.product_id, "new_stock": new_stock}
