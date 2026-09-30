from fastapi import APIRouter

from ..database import get_supabase
from ..schemas import AnalyticsVisitIn

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/visit", status_code=202)
def record_website_visit(payload: AnalyticsVisitIn):
    get_supabase().table("website_analytics_visits").upsert(
        {"visit_id": str(payload.visit_id), "source": payload.source},
        on_conflict="visit_id",
        ignore_duplicates=True,
    ).execute()
    return {"recorded": True}