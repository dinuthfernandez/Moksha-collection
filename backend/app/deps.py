from fastapi import Header, HTTPException

from .config import get_settings
from .database import get_supabase
from .security import decode_access_token, is_valid_admin_token, is_valid_superadmin_token


async def get_current_superadmin(authorization: str | None = Header(default=None)) -> bool:
    """Super admin session; only exists when SUPERADMIN_PASSWORD is configured."""
    if not get_settings().superadmin_password:
        raise HTTPException(status_code=404, detail="Not found")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not is_valid_superadmin_token(authorization.split(" ", 1)[1].strip()):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return True


async def get_current_customer(authorization: str | None = Header(default=None)) -> dict:
    """Resolves the logged-in customer from the `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1].strip()
    customer_id = decode_access_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    supabase = get_supabase()
    result = supabase.table("customers").select("*").eq("id", customer_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    customer = result.data[0]
    if customer.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been banned")

    return customer


async def get_optional_customer(authorization: str | None = Header(default=None)) -> dict | None:
    """Like get_current_customer, but returns None instead of raising when logged out."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return await get_current_customer(authorization)
    except HTTPException:
        return None


async def get_current_admin(authorization: str | None = Header(default=None)) -> bool:
    """Resolves the single shared admin session from the `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1].strip()
    if not is_valid_admin_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")

    return True
