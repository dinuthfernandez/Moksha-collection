import io
import logging
from typing import Any

from PIL import Image, ImageOps

from ..database import get_supabase

logger = logging.getLogger(__name__)

PRODUCT_IMAGE_BUCKET = "product-images"
MAX_IMAGE_BYTES = 300 * 1024
_MAX_DIMENSION = 1600
_MIN_DIMENSION = 400
_MIN_QUALITY = 40


def compress_image(data: bytes, max_bytes: int = MAX_IMAGE_BYTES) -> bytes:
    """Returns JPEG bytes no larger than `max_bytes` by lowering quality, then dimensions."""
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    if image.mode in ("RGBA", "LA", "P"):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")

    if max(image.size) > _MAX_DIMENSION:
        image.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION), Image.LANCZOS)

    best = b""
    while True:
        for quality in range(85, _MIN_QUALITY - 1, -5):
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
            best = buffer.getvalue()
            if len(best) <= max_bytes:
                return best
        width, height = image.size
        if max(width, height) <= _MIN_DIMENSION:
            return best
        image = image.resize((int(width * 0.85), int(height * 0.85)), Image.LANCZOS)


def _ensure_bucket(supabase: Any) -> None:
    existing = {bucket.name for bucket in supabase.storage.list_buckets()}
    if PRODUCT_IMAGE_BUCKET not in existing:
        supabase.storage.create_bucket(PRODUCT_IMAGE_BUCKET, options={"public": True})


def store_product_image(zoho_item_id: str, data: bytes) -> str:
    """Compresses an image to <= 300 KB and uploads it to Supabase Storage; returns its public URL."""
    compressed = compress_image(data)
    supabase = get_supabase()
    _ensure_bucket(supabase)
    path = f"{zoho_item_id}.jpg"
    supabase.storage.from_(PRODUCT_IMAGE_BUCKET).upload(
        path, compressed, {"content-type": "image/jpeg", "upsert": "true", "cache-control": "31536000"}
    )
    return supabase.storage.from_(PRODUCT_IMAGE_BUCKET).get_public_url(path).rstrip("?")
