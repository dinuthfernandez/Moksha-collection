from typing import Literal

from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..schemas import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(type: Literal["clothing", "accessories"]):
    """Subcategories under one of the two fixed top-level sections."""
    supabase = get_supabase()
    result = (
        supabase.table("categories")
        .select("*")
        .eq("type", type)
        .eq("is_active", True)
        .order("display_order")
        .execute()
    )
    return result.data


@router.get("/{slug}", response_model=CategoryOut)
def get_category(slug: str):
    supabase = get_supabase()
    result = supabase.table("categories").select("*").eq("slug", slug).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return result.data[0]
