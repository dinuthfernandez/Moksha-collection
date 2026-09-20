from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..schemas import AdminLoginIn, AdminTokenOut
from ..security import create_admin_token

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/login", response_model=AdminTokenOut)
def admin_login(payload: AdminLoginIn):
    settings = get_settings()
    if payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Incorrect admin password")
    return {"access_token": create_admin_token()}
