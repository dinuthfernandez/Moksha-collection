from fastapi import APIRouter

from ..database import get_supabase
from ..schemas import AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementOut])
def list_announcements():
    supabase = get_supabase()
    result = (
        supabase.table("announcements")
        .select("*")
        .eq("is_active", True)
        .order("display_order")
        .execute()
    )
    return result.data
