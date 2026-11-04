import base64
import binascii
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from ..database import get_supabase
from ..deps import get_current_admin
from ..services.cache import cached, invalidate_catalog
from ..services.product_images import compress_image

logger = logging.getLogger(__name__)

BANNER_BUCKET = "home-banners"
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_BANNER_BYTES = 600 * 1024
MAX_BANNER_DIMENSION = 2400
_MIGRATION_HINT = "Banners are not set up yet — run backend/sql/026_home_banners.sql in the Supabase SQL editor"

public_router = APIRouter(prefix="/banners", tags=["banners"])
admin_router = APIRouter(
    prefix="/admin/banners", tags=["admin"], dependencies=[Depends(get_current_admin)]
)


def _load_settings(supabase) -> dict:
    rows = supabase.table("banner_settings").select("*").eq("id", True).limit(1).execute().data
    return rows[0] if rows else {"section_enabled": True, "interval_seconds": 5}


@public_router.get("")
def get_public_banners():
    def load():
        supabase = get_supabase()
        try:
            settings = _load_settings(supabase)
            if not settings.get("section_enabled", True):
                return {"enabled": False, "interval_seconds": 5, "banners": []}
            rows = (
                supabase.table("home_banners").select("id,image_url")
                .eq("is_active", True).order("display_order").order("created_at").execute().data
                or []
            )
        except APIError:
            return {"enabled": False, "interval_seconds": 5, "banners": []}
        return {
            "enabled": bool(rows),
            "interval_seconds": settings.get("interval_seconds") or 5,
            "banners": rows,
        }

    return cached("banners:public", 30, load)


def _invalidate() -> None:
    invalidate_catalog()


def _admin_payload(supabase) -> dict:
    try:
        settings = _load_settings(supabase)
        rows = (
            supabase.table("home_banners").select("*")
            .order("display_order").order("created_at").execute().data or []
        )
    except APIError as exc:
        raise HTTPException(status_code=503, detail=_MIGRATION_HINT) from exc
    return {
        "section_enabled": bool(settings.get("section_enabled", True)),
        "interval_seconds": settings.get("interval_seconds") or 5,
        "banners": rows,
    }


@admin_router.get("")
def list_banners():
    return _admin_payload(get_supabase())


class BannerSettingsIn(BaseModel):
    section_enabled: bool
    interval_seconds: int = Field(default=5, ge=2, le=30)


@admin_router.put("/settings")
def update_settings(payload: BannerSettingsIn):
    supabase = get_supabase()
    try:
        supabase.table("banner_settings").upsert(
            {"id": True, **payload.model_dump()}
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=503, detail=_MIGRATION_HINT) from exc
    _invalidate()
    return _admin_payload(supabase)


class BannerUploadIn(BaseModel):
    data_url: str


@admin_router.post("", status_code=201)
def upload_banner(payload: BannerUploadIn):
    raw = payload.data_url.split(",", 1)[-1]
    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid image data") from exc
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 12 MB)")
    try:
        compressed = compress_image(data, MAX_BANNER_BYTES, MAX_BANNER_DIMENSION)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="That file is not a valid image") from exc

    supabase = get_supabase()
    try:
        last = supabase.table("home_banners").select("display_order").order("display_order", desc=True).limit(1).execute().data
    except APIError as exc:
        raise HTTPException(status_code=503, detail=_MIGRATION_HINT) from exc
    next_order = (last[0]["display_order"] + 1) if last else 0

    if BANNER_BUCKET not in {b.name for b in supabase.storage.list_buckets()}:
        supabase.storage.create_bucket(BANNER_BUCKET, options={"public": True})
    path = f"{uuid.uuid4().hex}.jpg"
    supabase.storage.from_(BANNER_BUCKET).upload(
        path, compressed, {"content-type": "image/jpeg", "cache-control": "31536000"}
    )
    url = supabase.storage.from_(BANNER_BUCKET).get_public_url(path).rstrip("?")
    supabase.table("home_banners").insert(
        {"image_url": url, "storage_path": path, "display_order": next_order}
    ).execute()
    _invalidate()
    return _admin_payload(supabase)


class BannerUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


@admin_router.put("/{banner_id}")
def update_banner(banner_id: str, payload: BannerUpdateIn):
    changes = payload.model_dump(exclude_none=True)
    supabase = get_supabase()
    if changes:
        supabase.table("home_banners").update(changes).eq("id", banner_id).execute()
        _invalidate()
    return _admin_payload(supabase)


class ReorderIn(BaseModel):
    ids: list[str]


@admin_router.put("/order/save")
def reorder(payload: ReorderIn):
    supabase = get_supabase()
    for position, banner_id in enumerate(payload.ids):
        supabase.table("home_banners").update({"display_order": position}).eq("id", banner_id).execute()
    _invalidate()
    return _admin_payload(supabase)


@admin_router.delete("/{banner_id}")
def delete_banner(banner_id: str):
    supabase = get_supabase()
    rows = supabase.table("home_banners").select("storage_path").eq("id", banner_id).limit(1).execute().data
    if rows:
        try:
            supabase.storage.from_(BANNER_BUCKET).remove([rows[0]["storage_path"]])
        except Exception:
            logger.warning("Could not remove banner file %s", rows[0]["storage_path"])
        supabase.table("home_banners").delete().eq("id", banner_id).execute()
        _invalidate()
    return _admin_payload(supabase)
