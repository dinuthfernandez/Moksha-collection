import re
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError

from ..database import get_supabase
from ..deps import get_current_admin
from ..schemas import ProductListOut, ProductOut, ProductStockAdjustIn
from ..services.cache import cached, invalidate_catalog
from ..services.discounts import apply_discount
from ..services.zoho_inventory import ZohoInventoryClient
from ..config import get_settings

router = APIRouter(prefix="/products", tags=["products"])


def _with_discounts(result: ProductListOut) -> ProductListOut:
    """Cached lists hold Zoho prices; live discounts are applied per request so they start and end on time."""
    items = [ProductOut(**apply_discount(item.model_dump())) for item in result.items]
    return result.model_copy(update={"items": items})

# Common spellings shoppers use -> how products are actually named.
_SEARCH_ALIASES = {
    "sari": "saree", "sarees": "saree", "saris": "saree", "kurthi": "kurti", "kurta": "kurti", "kurtis": "kurti",
    "kaftans": "kaftan", "frocks": "frock", "dresses": "dress", "tops": "top", "pants": "pant", "bangle": "bangles",
    "earring": "earrings", "stud": "studs", "bracelet": "bracelets", "necklaces": "necklace", "mundu": "mundu",
    "pavada": "pavada", "pavadai": "pavada", "pattupavada": "pavada-blouse",
    "dupata": "dupatta", "duppatta": "dupatta",
}


def _search_tokens(q: str) -> list[str]:
    words = re.sub(r"[^a-zA-Z0-9 _-]", " ", q.lower()).split()
    return [_SEARCH_ALIASES.get(w, w) for w in words[:6]]


@router.get("/suggest")
def suggest_products(q: str = Query(min_length=1, max_length=60)):
    """Autocomplete: matching categories first, then distinct product names."""
    tokens = _search_tokens(q)
    if not tokens:
        return {"suggestions": []}
    key = "suggest:" + " ".join(tokens)

    def load():
        supabase = get_supabase()
        joined = " ".join(tokens)
        cats = [
            c for c in (supabase.table("categories").select("name,slug,type").eq("is_active", True).execute().data or [])
            if all(t in c["name"].lower() for t in tokens) or joined in c["name"].lower()
        ]
        out: list[dict] = [
            {"type": "category", "label": c["name"], "url": f"/{c['type']}/{c['slug']}"} for c in cats[:4]
        ]
        query = (
            supabase.table("products").select("name,slug,subcategory_name,price,image_url")
            .eq("is_active", True).eq("is_primary_variant", True)
            .order("has_image", desc=True)
        )
        for token in tokens:
            query = query.or_(f"name.ilike.%{token}%,subcategory_name.ilike.%{token}%,color.ilike.%{token}%")
        seen: set[str] = set()
        for row in (query.limit(40).execute().data or []):
            label = row["name"].strip().title()
            if label.lower() in seen:
                continue
            seen.add(label.lower())
            out.append({"type": "product", "label": label, "url": f"/product/{row['slug']}",
                        "image_url": row.get("image_url"), "price": row.get("price"), "category": row.get("subcategory_name")})
            if len(out) >= 8:
                break
        return {"suggestions": out}

    return cached(key, 120, load)


@router.get("/new-arrivals", response_model=ProductListOut)
def list_new_arrivals(
    category: Literal["clothing", "accessories", "saree"],
    limit: int = Query(default=8, ge=1, le=24),
):
    """The most recently added products of a category that have a photo.

    Products without a photo are skipped, so if only 7 of the latest 8 have one, the slot is
    filled by the next most recent product that does.

    `created_at` is stamped once, when the Zoho sync first inserts a product, and never changes on
    later syncs, so it marks when the item first appeared on the website."""

    def load() -> ProductListOut:
        res = (
            get_supabase().table("products").select("*")
            .eq("is_active", True).eq("is_primary_variant", True).eq("category_slug", category)
            .gt("stock_quantity", 0).eq("has_image", True)
            .order("created_at", desc=True).order("id", desc=True)
            .limit(limit).execute()
        )
        items = list(res.data or [])
        return ProductListOut(items=items, total=len(items), page=1, page_size=limit, total_pages=1)

    return _with_discounts(cached(f"new-arrivals:{category}:{limit}", 60, load))


@router.get("", response_model=ProductListOut)
def list_products(
    category: Optional[Literal["clothing", "accessories", "saree"]] = None,
    category_slug: Optional[str] = Query(default=None, max_length=120),
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=200),
    q: Optional[str] = Query(default=None, max_length=120),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    clearance: bool = Query(default=False),
    discounted: bool = Query(default=False),
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="Minimum price cannot exceed maximum price")

    supabase = get_supabase()

    def build(in_stock: bool):
        query = supabase.table("products").select("*", count="exact")
        query = query.gt("stock_quantity", 0) if in_stock else query.lte("stock_quantity", 0)
        if active_only:
            query = query.eq("is_active", True)
        if category:
            query = query.eq("category_slug", category)
        if category_slug:
            # `category_slug` here is actually a Zoho Product Sub Category slug
            # (e.g. "kurti", "earrings") — subcategory browsing pages pass it in.
            query = query.eq("subcategory_slug", {"pattupavada": "pavada-blouse"}.get(category_slug, category_slug))
        if not q:
            # Listing/grid views show one card per design: the primary (smallest
            # size) variant. A search query intentionally ignores this so every
            # matching variant is still findable by its own SKU/name.
            query = query.eq("is_primary_variant", True)
        if q:
            for token in _search_tokens(q):
                query = query.or_(
                    f"name.ilike.%{token}%,description.ilike.%{token}%,color.ilike.%{token}%,"
                    f"subcategory_name.ilike.%{token}%,category_slug.ilike.%{token}%,"
                    f"product_code.ilike.%{token}%,zoho_sku.ilike.%{token}%"
                )
        if clearance:
            query = query.eq("is_clearance", True)
        if discounted:
            now_iso = datetime.now(timezone.utc).isoformat()
            query = (
                query.not_.is_("discount_price", "null")
                .lte("discount_starts_at", now_iso).gt("discount_ends_at", now_iso)
            )
        if min_price is not None:
            query = query.gte("price", min_price)
        if max_price is not None:
            query = query.lte("price", max_price)
        return query.order("has_image", desc=True).order("created_at", desc=True)

    start = (page - 1) * page_size
    end = start + page_size - 1

    def fetch(in_stock: bool, a: int, b: int) -> tuple[list, int]:
        try:
            res = build(in_stock).range(a, b).execute()
            return list(res.data or []), res.count or 0
        except APIError:
            # Range starts beyond the last row: only the count is needed.
            res = build(in_stock).range(0, 0).execute()
            return [], res.count or 0

    def load() -> ProductListOut:
        # In-stock products first, out-of-stock last, with paging continuing across the boundary.
        items, in_total = fetch(True, start, end)
        out_start = max(0, start - in_total)
        out_items, out_total = fetch(False, out_start, out_start + max(page_size - len(items), 1) - 1)
        if len(items) < page_size:
            items += out_items
        total = in_total + out_total
        total_pages = max((total + page_size - 1) // page_size, 1)
        return ProductListOut(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)

    cache_key = f"products:{category}:{category_slug}:{active_only}:{page}:{page_size}:{q}:    {min_price}:{max_price}:{clearance}:{discounted}"
    return _with_discounts(cached(cache_key, 60, load))


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str):
    def load() -> dict:
        supabase = get_supabase()
        result = supabase.table("products").select("*").eq("slug", slug).limit(1).execute()
        if not result.data or not result.data[0].get("is_active"):
            raise HTTPException(status_code=404, detail="Product not found")
        product = dict(result.data[0])

        website_serial = product.get("website_serial")
        if website_serial:
            siblings = (
                supabase.table("products")
                .select("*")
                .eq("website_serial", website_serial)
                .eq("is_active", True)
                .execute()
            )
            product["variants"] = siblings.data or []
        else:
            product["variants"] = []
        return product

    product = dict(cached(f"product:{slug}", 60, load))
    product["variants"] = [apply_discount(v) for v in product.get("variants", [])]
    return apply_discount(product)


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

    synced = await sync_products_to_supabase(full=True)
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
