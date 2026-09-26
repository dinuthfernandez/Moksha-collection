from fastapi import APIRouter

from ..database import get_supabase
from ..schemas import PublicCouponOut
from ..services.coupons import get_current_coupons

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.get("", response_model=list[PublicCouponOut])
def list_active_coupons():
    return get_current_coupons(get_supabase())
