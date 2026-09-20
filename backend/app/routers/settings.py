from fastapi import APIRouter

from ..database import get_supabase
from ..schemas import PublicSettingsOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=PublicSettingsOut)
def get_public_settings():
    """Storefront-facing settings used on the delivery/confirmation and payment pages."""
    supabase = get_supabase()

    settings_result = supabase.table("admin_settings").select("*").eq("id", True).limit(1).execute()
    settings_row = settings_result.data[0] if settings_result.data else {}

    rates_result = supabase.table("delivery_rates").select("delivery_type,rate_bhd,description").execute()

    return {
        "iban_number": settings_row.get("iban_number"),
        "whatsapp_number": settings_row.get("whatsapp_number"),
        "return_window_days": settings_row.get("return_window_days", 7),
        "delivery_rates": rates_result.data or [],
    }
