import asyncio
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ..config import get_settings
from ..database import get_supabase
from ..deps import get_current_superadmin
from ..security import create_superadmin_token
from ..services import superadmin_state as state
from ..services.cache import invalidate_catalog

import hmac

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHELL_TIMEOUT_SECONDS = 120
SHELL_OUTPUT_LIMIT = 100_000
CWD_MARKER = "__MOKSHA_CWD__"
_shell_cwd = {"path": str(PROJECT_ROOT)}

VIEWABLE_TABLES = {"orders", "order_items", "customers", "products", "categories", "campaigns", "coupons", "cart_reservations"}
SENSITIVE_COLUMNS = {"password_hash", "code_hash"}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class MaintenanceIn(BaseModel):
    enabled: bool
    message: str = Field(default="", max_length=500)
    eta: str = Field(default="", max_length=100)


class BypassPasswordIn(BaseModel):
    password: str = Field(default="", max_length=200)

    @field_validator("password")
    @classmethod
    def _min_len(cls, value: str) -> str:
        if value and len(value) < 8:
            raise ValueError("Use at least 8 characters (or leave empty to remove).")
        return value


class ShellIn(BaseModel):
    command: str = Field(min_length=1, max_length=5000)


@router.post("/login")
async def superadmin_login(payload: LoginIn, request: Request):
    settings = get_settings()
    if not settings.superadmin_password:
        raise HTTPException(status_code=404, detail="Not found")

    ip = _client_ip(request)
    remaining = state.lock_remaining(ip)
    if remaining:
        state.audit("login_blocked", ip)
        raise HTTPException(status_code=429, detail=f"Locked. Try again in {remaining // 60 + 1} minute(s).")

    if not hmac.compare_digest(payload.password.encode("utf-8"), settings.superadmin_password.encode("utf-8")):
        state.register_failure(ip)
        state.audit("login_failed", ip)
        await asyncio.sleep(1.5)
        raise HTTPException(status_code=401, detail="Access denied")

    state.register_success(ip)
    state.audit("login_ok", ip)
    return {"access_token": create_superadmin_token(), "shell_enabled": settings.superadmin_shell_enabled}


protected = APIRouter(dependencies=[Depends(get_current_superadmin)])


@protected.get("/overview")
def overview():
    supabase = get_supabase()
    settings = get_settings()

    def count(table: str, **filters) -> int:
        try:
            query = supabase.table(table).select("id", count="exact").limit(1)
            for key, value in filters.items():
                query = query.eq(key, value)
            return query.execute().count or 0
        except Exception:
            return -1

    return {
        "maintenance": state.get_maintenance(),
        "has_bypass_password": state.has_bypass_password(),
        "uptime_seconds": int(time.time() - state.STARTED_AT),
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "shell_enabled": settings.superadmin_shell_enabled,
        "zoho_configured": all([settings.zoho_client_id, settings.zoho_refresh_token, settings.zoho_organization_id]),
        "counts": {
            "customers": count("customers"),
            "orders": count("orders"),
            "products": count("products"),
            "active_products": count("products", is_active=True),
            "campaigns": count("campaigns"),
        },
    }


@protected.post("/maintenance")
def set_maintenance(payload: MaintenanceIn, request: Request):
    result = state.set_maintenance(payload.enabled, payload.message, payload.eta)
    state.audit("maintenance_on" if payload.enabled else "maintenance_off", _client_ip(request), payload.message)
    return result


@protected.post("/bypass-password")
def set_bypass_password(payload: BypassPasswordIn, request: Request):
    state.set_bypass_password(payload.password)
    state.audit("bypass_password_set" if payload.password else "bypass_password_removed", _client_ip(request))
    return {"has_bypass_password": state.has_bypass_password()}


@protected.post("/actions/{action}")
async def run_action(action: Literal["clear-cache", "zoho-sync"], request: Request):
    ip = _client_ip(request)
    state.audit(f"action_{action}", ip)
    if action == "clear-cache":
        invalidate_catalog()
        return {"message": "Catalog cache cleared."}
    from ..services.zoho_inventory import sync_products_to_supabase

    try:
        total = await sync_products_to_supabase()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Zoho sync failed: {exc}") from exc
    return {"message": f"Zoho sync finished: {total} item(s) processed."}


@protected.get("/logs")
def logs(limit: int = 200):
    return {"lines": state.recent_logs(max(1, min(limit, 400)))}


@protected.get("/audit")
def audit_trail():
    return {"entries": state.audit_entries()}


@protected.get("/tables/{table}")
def view_table(table: str, limit: int = 50):
    if table not in VIEWABLE_TABLES:
        raise HTTPException(status_code=404, detail="Unknown table")
    rows = (
        get_supabase().table(table).select("*").order("created_at", desc=True).limit(max(1, min(limit, 200))).execute().data
        or []
    )
    return {"rows": [{k: v for k, v in row.items() if k not in SENSITIVE_COLUMNS} for row in rows]}


@protected.post("/shell")
def run_shell(payload: ShellIn, request: Request):
    settings = get_settings()
    if not settings.superadmin_shell_enabled:
        raise HTTPException(status_code=403, detail="Shell is disabled. Set SUPERADMIN_SHELL_ENABLED=true in the server environment.")

    ip = _client_ip(request)
    state.audit("shell", ip, payload.command)

    if os.name == "nt":
        script = f'{payload.command}\nWrite-Output "{CWD_MARKER}$((Get-Location).Path)"'
        args = ["powershell", "-NoProfile", "-NonInteractive", "-Command", script]
    else:
        script = f'{payload.command}\necho "{CWD_MARKER}$(pwd)"'
        args = ["bash", "-c", script]

    started = time.time()
    try:
        proc = subprocess.run(
            args, cwd=_shell_cwd["path"], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=SHELL_TIMEOUT_SECONDS, stdin=subprocess.DEVNULL,
        )
        stdout, stderr, code = proc.stdout or "", proc.stderr or "", proc.returncode
    except subprocess.TimeoutExpired as exc:
        stdout = (exc.stdout.decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else exc.stdout) or ""
        stderr = f"Timed out after {SHELL_TIMEOUT_SECONDS}s"
        code = -1

    lines = stdout.splitlines()
    kept = []
    for line in lines:
        if line.startswith(CWD_MARKER):
            new_cwd = line[len(CWD_MARKER):].strip()
            if new_cwd and Path(new_cwd).is_dir():
                _shell_cwd["path"] = new_cwd
        else:
            kept.append(line)

    return {
        "stdout": "\n".join(kept)[:SHELL_OUTPUT_LIMIT],
        "stderr": stderr[:SHELL_OUTPUT_LIMIT],
        "exit_code": code,
        "cwd": _shell_cwd["path"],
        "seconds": round(time.time() - started, 2),
    }


router.include_router(protected)
