from typing import Literal, Optional

from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..schemas import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(type: Optional[Literal["clothing", "accessories"]] = None):
    """Subcategories under one or all of the top-level sections."""
    supabase = get_supabase()
    query = supabase.table("categories").select("*").eq("is_active", True)
    if type:
        query = query.eq("type", type)
    result = query.order("display_order").execute()
    return result.data


@router.get("/{slug}", response_model=CategoryOut)
def get_category(slug: str):
    supabase = get_supabase()
    result = supabase.table("categories").select("*").eq("slug", slug).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return result.data[0]
