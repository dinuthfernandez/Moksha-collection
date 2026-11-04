from typing import Literal, Optional

from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..schemas import CategoryOut
from ..services.cache import cached

router = APIRouter(prefix="/categories", tags=["categories"])
_LEGACY_CATEGORY_SLUGS = {"pattupavada": "pavada-blouse"}


@router.get("", response_model=list[CategoryOut])
def list_categories(type: Optional[Literal["clothing", "accessories", "saree"]] = None):
    """Subcategories under one or all of the top-level sections."""
    supabase = get_supabase()
    def load():
        query = supabase.table("categories").select("*").eq("is_active", True)
        if type:
            query = query.eq("type", type)
        rows = query.order("display_order").execute().data or []
        if type == "saree":
            live = _saree_slugs_with_products(supabase)
            rows = [row for row in rows if row["slug"] in live]
        return rows

    return cached(f"categories:{type}", 300, load)


def _saree_slugs_with_products(supabase) -> set[str]:
    """Saree sub-categories are only listed while at least one live product sits under them."""
    slugs: set[str] = set()
    offset = 0
    while True:
        batch = (
            supabase.table("products")
            .select("subcategory_slug")
            .eq("is_active", True)
            .eq("category_slug", "saree")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        slugs.update(row["subcategory_slug"] for row in batch if row.get("subcategory_slug"))
        if len(batch) < 1000:
            return slugs
        offset += 1000


@router.get("/{slug}", response_model=CategoryOut)
def get_category(slug: str):
    slug = _LEGACY_CATEGORY_SLUGS.get(slug, slug)

    def load():
        result = get_supabase().table("categories").select("*").eq("slug", slug).limit(1).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Category not found")
        return result.data[0]

    return cached(f"category:{slug}", 300, load)
