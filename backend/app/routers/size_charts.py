from fastapi import APIRouter

from ..database import get_supabase
from ..schemas import SizeChartOut

router = APIRouter(prefix="/size-charts", tags=["size-charts"])


@router.get("", response_model=list[SizeChartOut])
def list_size_charts():
    supabase = get_supabase()
    result = supabase.table("size_charts").select("*").order("display_order").execute()
    return result.data
