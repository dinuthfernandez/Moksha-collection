import asyncio
import json
import logging
import re
import threading
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError
from uuid import uuid4

from ..config import get_settings
from ..database import get_supabase
from .cache import invalidate_catalog
from .product_images import store_product_image

logger = logging.getLogger(__name__)

_ZOHO_RETRIES = 8
_ZOHO_RETRY_STATUSES = {429, 500, 502, 503, 504}
_LIGHT_SYNC_FIELDS = ("name", "description", "zoho_sku", "stock_quantity", "category_slug", "subcategory_name", "subcategory_slug")
_WRITE_WORKERS = 6

WEBSITE_CONTACT_NAME = "Online Customer"
_ADJUSTMENT_DEFAULTS_TTL_SECONDS = 300
_adjustment_defaults_lock = threading.Lock()
_adjustment_defaults_by_org: dict[str, tuple[float, dict[str, str]]] = {}


def build_online_customer_contact_name(customer_name: str) -> str:
    first_name = (customer_name or "").strip().split(" ")[0] or "Guest"
    return f"{WEBSITE_CONTACT_NAME} ({first_name})"


class ZohoInventoryClient:
    """Small Zoho Inventory client that refreshes the OAuth token once and reuses it."""

    def __init__(self, client_id: str, client_secret: str, refresh_token: str, organization_id: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.organization_id = organization_id
        self.access_token: str | None = None
        self.token_expires_at = 0.0

    def _refresh_access_token(self) -> str:
        payload = parse.urlencode(
            {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
            }
        ).encode("utf-8")

        req = request.Request(
            "https://accounts.zoho.com/oauth/v2/token",
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )

        response_body = ""
        for attempt in range(_ZOHO_RETRIES):
            try:
                with request.urlopen(req, timeout=30) as response:
                    response_body = response.read().decode("utf-8")
                break
            except Exception as exc:  # pragma: no cover - surfaced to caller
                if attempt == _ZOHO_RETRIES - 1:
                    raise RuntimeError(f"Zoho token refresh failed: {exc}") from exc
                time.sleep(2 ** (attempt + 1))

        data = json.loads(response_body)
        access_token = data.get("access_token")
        if not access_token:
            raise RuntimeError(f"Zoho token response missing access_token: {response_body}")

        self.access_token = access_token
        expires_in = int(data.get("expires_in", 3600))
        self.token_expires_at = time.time() + max(expires_in - 30, 30)
        return access_token

    def get_access_token(self) -> str:
        if not self.access_token or time.time() >= self.token_expires_at:
            return self._refresh_access_token()
        return self.access_token

    def _request_json(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        method: str = "GET",
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        token = self.get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        base_url = "https://www.zohoapis.com/inventory/v1"
        url = path if path.startswith("http") else f"{base_url}{path}"
        if params:
            url = f"{url}?{parse.urlencode(params, doseq=True)}"

        data = json.dumps(json_body).encode("utf-8") if json_body is not None else None
        req = request.Request(url, data=data, headers=headers, method=method)
        # Only reads are retried; retrying a write could create duplicate invoices/adjustments.
        attempts = _ZOHO_RETRIES if method == "GET" else 1
        body = ""
        for attempt in range(attempts):
            delay = min(30, 2 ** (attempt + 1))
            try:
                with request.urlopen(req, timeout=60) as response:
                    body = response.read().decode("utf-8")
                break
            except HTTPError as exc:  # pragma: no cover - surfaced to caller
                if exc.code in _ZOHO_RETRY_STATUSES and attempt < attempts - 1:
                    time.sleep(delay)
                    continue
                error_body = exc.read().decode("utf-8") if exc.fp else ""
                raise RuntimeError(f"Zoho API request failed for {path}: {exc} — {error_body[:500]}") from exc
            except Exception as exc:  # pragma: no cover - surfaced to caller
                if attempt < attempts - 1:
                    time.sleep(delay)
                    continue
                raise RuntimeError(f"Zoho API request failed for {path}: {exc}") from exc

        if not body:
            return {}

        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid Zoho API JSON for {path}: {body[:500]}") from exc

    def fetch_all_items(self) -> list[dict[str, Any]]:
        """Fetches the full inventory in paginated batches. This is the single hourly inventory sync."""
        page = 1
        page_size = 200
        items: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        while True:
            result = self._request_json(
                "/items",
                {
                    "organization_id": self.organization_id,
                    "page": page,
                    "per_page": page_size,
                    "filter_by": "Status.All",
                },
            )

            batch = result.get("items") or result.get("data") or []
            if not batch:
                break

            for entry in batch:
                entry_id = str(entry.get("item_id") or "")
                if entry_id and entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)
                items.append(entry)

            has_more = (result.get("page_context") or {}).get("has_more_page")
            if has_more is False or (has_more is None and len(batch) < page_size):
                break

            page += 1

        return items

    def fetch_item(self, zoho_item_id: str) -> dict[str, Any] | None:
        """Fetches one item's full detail. Returns None only when Zoho confirms it no longer exists."""
        try:
            result = self._request_json(f"/items/{zoho_item_id}", {"organization_id": self.organization_id})
        except RuntimeError as exc:
            if "HTTP Error 404" in str(exc):
                return None
            raise
        return result.get("item") or None

    def download_item_image(self, zoho_item_id: str) -> bytes | None:
        """Downloads the raw image attached to a Zoho item, or None if it has none."""
        url = (
            f"https://www.zohoapis.com/inventory/v1/items/{zoho_item_id}/image"
            f"?{parse.urlencode({'organization_id': self.organization_id})}"
        )
        req = request.Request(
            url, headers={"Authorization": f"Zoho-oauthtoken {self.get_access_token()}"}, method="GET"
        )
        try:
            with request.urlopen(req, timeout=60) as response:
                data = response.read()
        except HTTPError as exc:
            if exc.code in (400, 404):
                return None
            raise RuntimeError(f"Zoho image download failed for {zoho_item_id}: {exc}") from exc
        return data or None

    def validate_connection(self) -> None:
        result = self._request_json(
            "/items",
            {"organization_id": self.organization_id, "page": 1, "per_page": 1},
        )
        if result.get("code") not in (0, "0"):
            raise RuntimeError("Zoho Inventory connection check failed")

    def adjust_stock(self, zoho_item_id: str, delta_quantity: int) -> None:
        """Create a Zoho Inventory quantity adjustment for a website stock change."""
        if not zoho_item_id or not delta_quantity:
            return

        defaults = self._get_inventory_adjustment_defaults()
        item = self._request_json(
            f"/items/{zoho_item_id}",
            {"organization_id": self.organization_id},
        ).get("item") or {}
        line_item = {
            "item_id": zoho_item_id,
            "name": item.get("name") or item.get("item_name") or "Website product",
            "quantity_adjusted": delta_quantity,
            "adjustment_account_id": defaults["adjustment_account_id"],
        }
        if item.get("unit"):
            line_item["unit"] = item["unit"]

        result = self._request_json(
            "/inventoryadjustments",
            {"organization_id": self.organization_id},
            method="POST",
            json_body={
                "date": datetime.now(timezone.utc).date().isoformat(),
                "reason": defaults["reason"],
                "reason_id": defaults["reason_id"],
                "adjustment_type": "quantity",
                "adjustment_account_id": defaults["adjustment_account_id"],
                "description": "Website cart stock reservation or release",
                "reference_number": f"WEB-{uuid4().hex[:16].upper()}",
                "line_items": [line_item],
            },
        )
        if result.get("code") not in (0, "0") or not result.get("inventory_adjustment"):
            raise RuntimeError(f"Zoho inventory adjustment failed: {result.get('message', 'unknown error')}")

    def _get_inventory_adjustment_defaults(self) -> dict[str, str]:
        now = time.monotonic()
        with _adjustment_defaults_lock:
            cached = _adjustment_defaults_by_org.get(self.organization_id)
            if cached and now - cached[0] < _ADJUSTMENT_DEFAULTS_TTL_SECONDS:
                return cached[1]

            summaries = self._request_json(
                "/inventoryadjustments",
                {"organization_id": self.organization_id, "page": 1, "per_page": 1},
            ).get("inventory_adjustments") or []
            if not summaries or not summaries[0].get("inventory_adjustment_id"):
                raise RuntimeError("Zoho has no previous inventory adjustment to supply its adjustment reason and account")

            adjustment = self._request_json(
                f"/inventoryadjustments/{summaries[0]['inventory_adjustment_id']}",
                {"organization_id": self.organization_id},
            ).get("inventory_adjustment") or {}
            line_items = adjustment.get("line_items") or []
            adjustment_account_id = adjustment.get("adjustment_account_id") or (
                line_items[0].get("adjustment_account_id") if line_items else None
            )
            reason_id = adjustment.get("reason_id")
            reason = adjustment.get("reason")
            if not adjustment_account_id or not reason_id or not reason:
                raise RuntimeError("Zoho's previous inventory adjustment is missing its reason or adjustment account")

            defaults = {
                "adjustment_account_id": str(adjustment_account_id),
                "reason_id": str(reason_id),
                "reason": str(reason),
            }
            _adjustment_defaults_by_org[self.organization_id] = (now, defaults)
            return defaults

    def find_contact_id_by_name(self, contact_name: str) -> str | None:
        """Looks up an existing Zoho contact by its exact display name."""
        result = self._request_json(
            "/contacts",
            {"organization_id": self.organization_id, "contact_name": contact_name},
        )
        contacts = result.get("contacts") or []
        for contact in contacts:
            if contact.get("contact_name") == contact_name:
                return str(contact.get("contact_id"))
        return None

    def create_contact(self, contact_name: str) -> str:
        """Creates a Zoho contact with the given display name."""
        result = self._request_json(
            "/contacts",
            {"organization_id": self.organization_id},
            method="POST",
            json_body={"contact_name": contact_name, "contact_type": "customer"},
        )
        contact = result.get("contact") or {}
        contact_id = contact.get("contact_id")
        if not contact_id:
            raise RuntimeError(f"Zoho contact creation did not return a contact_id: {result}")
        return str(contact_id)

    def get_or_create_contact_id(self, contact_name: str) -> str:
        return self.find_contact_id_by_name(contact_name) or self.create_contact(contact_name)

    def void_invoice(self, invoice_id: str) -> None:
        self._request_json(
            f"/invoices/{invoice_id}/status/void",
            {"organization_id": self.organization_id},
            method="POST",
        )

    def create_invoice(
        self,
        contact_id: str,
        line_items: list[dict[str, Any]],
        customer_name: str,
        phone: str,
        email: str | None,
        address: str | None,
        city: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        """Creates a detailed Zoho Inventory invoice for a real website order, with one line
        item per ordered product (referencing the Zoho item_id, quantity and rate)."""
        notes_parts = [f"Website order for {customer_name} (phone: {phone})"]
        if email:
            notes_parts.append(f"Email: {email}")
        if address:
            notes_parts.append(f"Address: {address}")
        if city:
            notes_parts.append(f"City: {city}")
        if notes:
            notes_parts.append(f"Notes: {notes}")

        payload = {
            "customer_id": contact_id,
            "line_items": line_items,
            "notes": " | ".join(notes_parts),
        }
        result = self._request_json(
            "/invoices",
            {"organization_id": self.organization_id},
            method="POST",
            json_body=payload,
        )
        invoice = result.get("invoice")
        if not invoice:
            raise RuntimeError(f"Zoho invoice creation failed: {result}")
        return invoice


def validate_zoho_inventory_connection() -> None:
    settings = get_settings()
    if not all(
        [
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        ]
    ):
        raise RuntimeError("Zoho Inventory credentials are not configured")

    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )
    client.validate_connection()


def _slugify(value: str, fallback: str) -> str:
    safe = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    safe = "-".join(part for part in safe.split("-") if part)
    return safe or fallback


def _to_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _to_int(value: Any) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _extract_image_url(item: dict[str, Any]) -> str | None:
    for key in ("image_url", "image", "product_image", "item_image"):
        url = item.get(key)
        if isinstance(url, str) and url:
            return url

    media = item.get("media") or item.get("images") or []
    if isinstance(media, list):
        for entry in media:
            if isinstance(entry, dict):
                for key in ("url", "image_url", "download_url"):
                    url = entry.get(key)
                    if isinstance(url, str) and url:
                        return url
    return None


def _extract_sku(item: dict[str, Any]) -> str | None:
    for key in ("sku", "item_code", "product_code", "code"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _extract_stock(item: dict[str, Any]) -> int:
    for key in ("stock_on_hand", "available_stock", "actual_available_stock", "quantity", "stock"):
        value = item.get(key)
        if value not in (None, ""):
            return _to_int(value)
    return 0


def _extract_price(item: dict[str, Any]) -> float:
    for key in ("selling_price", "rate", "unit_price", "sales_rate", "price"):
        value = item.get(key)
        if value not in (None, ""):
            return _to_float(value)
    return 0.0


def _extract_name(item: dict[str, Any]) -> str:
    for key in ("name", "item_name", "product_name"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return "Unnamed Product"


def _extract_description(item: dict[str, Any]) -> str | None:
    for key in ("description", "item_description", "product_description"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _extract_item_id(item: dict[str, Any]) -> str | None:
    for key in ("item_id", "id", "itemId", "product_id"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _is_online_store_enabled(item: dict[str, Any]) -> bool:
    # Zoho's native `show_in_storefront` flag belongs to Zoho's own storefront/
    # commerce module (not our custom site) and is effectively unset for almost
    # every item here, even after items were marked "Show in Online Store" in
    # our workflow. Our storefront instead treats any non-archived Zoho item
    # (status == "active") as eligible to sync/display.
    return item.get("status") == "active"


def _extract_brand(item: dict[str, Any]) -> str | None:
    for key in ("brand", "manufacturer"):
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def _extract_dimension(item: dict[str, Any], key: str) -> float | None:
    value = item.get(key)
    if value in (None, ""):
        return None
    parsed = _to_float(value)
    return parsed if parsed else None


def _extract_weight(item: dict[str, Any]) -> float | None:
    value = item.get("weight")
    if value in (None, ""):
        return None
    parsed = _to_float(value)
    return parsed if parsed else None


def _extract_category_slug(item: dict[str, Any]) -> str | None:
    catalog_keys = (
        "cf_catalog",
        "cf_catalog_unformatted",
        "cf_catalog_formatted",
        "cf_product_category",
        "cf_product_category_unformatted",
        "cf_product_category_formatted",
        "catalog",
        "category_slug",
    )
    values = [item.get(key) for key in catalog_keys]
    custom_field_hash = item.get("custom_field_hash")
    if isinstance(custom_field_hash, dict):
        values.extend(custom_field_hash.get(key) for key in catalog_keys)

    custom_fields = item.get("custom_fields")
    if isinstance(custom_fields, list):
        values.extend(
            field.get("value")
            for field in custom_fields
            if isinstance(field, dict)
            and str(field.get("label") or "").strip().casefold() in {"catalog", "product category"}
        )

    for value in values:
        if isinstance(value, dict):
            value = value.get("value") or value.get("name") or value.get("label")
        normalized = str(value or "").strip().casefold()
        if normalized in {"clothing", "accessories"}:
            return normalized
    return None


def _extract_custom_field(item: dict[str, Any], api_name: str, label: str) -> str | None:
    """Reads a Zoho custom field (e.g. cf_product_sub_category, cf_color, cf_size,
    cf_website_serial) off a raw item, trying the flat keys first (how Zoho's
    /items list endpoint returns them) and falling back to the custom_fields /
    custom_field_hash shapes some endpoints use."""
    keys = (api_name, f"{api_name}_formatted", f"{api_name}_unformatted")
    values = [item.get(key) for key in keys]

    custom_field_hash = item.get("custom_field_hash")
    if isinstance(custom_field_hash, dict):
        values.extend(custom_field_hash.get(key) for key in keys)

    custom_fields = item.get("custom_fields")
    if isinstance(custom_fields, list):
        values.extend(
            field.get("value")
            for field in custom_fields
            if isinstance(field, dict) and str(field.get("label") or "").strip().casefold() == label.casefold()
        )

    for value in values:
        if isinstance(value, dict):
            value = value.get("value") or value.get("name") or value.get("label")
        if value not in (None, ""):
            return str(value).strip()
    return None


def _extract_subcategory_name(item: dict[str, Any]) -> str | None:
    return _extract_custom_field(item, "cf_product_sub_category", "Product Sub Category")


def _extract_color(item: dict[str, Any]) -> str | None:
    return _extract_custom_field(item, "cf_color", "Color")


def _extract_size(item: dict[str, Any]) -> str | None:
    return _extract_custom_field(item, "cf_size", "Size")


def _extract_kids_size(item: dict[str, Any]) -> str | None:
    return _extract_custom_field(item, "cf_kids_size", "Kids size")


def _extract_website_serial(item: dict[str, Any]) -> str | None:
    return _extract_custom_field(item, "cf_website_serial", "Website Serial")


# Smallest-to-largest rank used to pick the single "primary" listing card out of a
# group of same-design (same website_serial) variants. Unknown/kids sizes sort last
# within their own bucket so they never accidentally outrank a recognized adult size.
_SIZE_RANK = {
    "xs": 0,
    "s": 1,
    "m": 2,
    "l": 3,
    "xl": 4,
    "xxl": 5,
    "2xl": 5,
    "xxxl": 6,
    "3xl": 6,
    "4xl": 7,
    "5xl": 8,
}


def _size_sort_key(size: str | None) -> tuple[int, int, str]:
    normalized = (size or "").strip().lower().replace(" ", "")
    if normalized in _SIZE_RANK:
        return (0, _SIZE_RANK[normalized], normalized)
    # Kids sizes are usually numeric age ranges (e.g. "2-3", "4-5") — sort numerically.
    leading_digits = re.match(r"^(\d+)", normalized)
    if leading_digits:
        return (1, int(leading_digits.group(1)), normalized)
    return (2, 0, normalized)


def _mark_primary_variants(records: list[dict[str, Any]]) -> None:
    """Mutates `records` in place, setting is_primary_variant so that exactly one
    row per non-empty website_serial group is the primary (smallest size, then
    color name, then SKU, as tie-breakers). Rows without a website_serial are
    always their own primary (singleton)."""
    groups: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        record["is_primary_variant"] = True
        serial = record.get("website_serial")
        if serial not in (None, ""):
            groups.setdefault(serial, []).append(record)

    for serial, group in groups.items():
        if len(group) < 2:
            continue
        group.sort(
            key=lambda r: (
                _size_sort_key(r.get("size")),
                (r.get("color") or "").strip().lower(),
                (r.get("zoho_sku") or "").strip().lower(),
            )
        )
        for record in group[1:]:
            record["is_primary_variant"] = False


async def sync_products_to_supabase(full: bool = False) -> int:
    """Light sync by default: only name, SKU, description and stock are refreshed for existing
    products (and only rows that actually changed are written). New products are inserted in full."""
    settings = get_settings()
    if not all(
        [
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        ]
    ):
        return 0

    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )

    items = await asyncio.to_thread(client.fetch_all_items)
    if not items:
        return 0

    # All blocking Supabase I/O runs in a worker thread so the sync never
    # stalls the asyncio event loop (and therefore never blocks other API requests).
    return await asyncio.to_thread(_write_products_to_supabase, items, False, not full)


ALLOWED_SUBCATEGORIES: dict[str, dict[str, str]] = {
    "clothing": {
        "kurti": "Kurti",
        "top": "Top",
        "co-ord-set": "Co-ord Set",
        "3-piece-set": "3 Piece Set",
        "frock": "Frock",
        "set-mundu": "Set Mundu",
        "pavada": "Pavada",
        "pavada-blouse": "Pavada Blouse",
        "dupatta": "Dupatta",
        "2-piece-set": "2 Piece Set",
        "dress-material": "Dress Material",
        "dhavani-set": "Dhavani Set",
        "blouse": "Blouse",
        "kaftan": "Kaftan",
        "short-top": "Short Top",
        "pant": "Pant",
        "skirt-top": "Skirt & Top",
    },
    "saree": {"saree": "Saree", "set-saree": "Set Saree"},
    "accessories": {
        "bindi": "Bindi",
        "earrings": "Earrings",
        "necklace": "Necklace",
        "bangles": "Bangles",
        "hair-clip": "Hair Clip",
        "glass-bangles": "Glass Bangles",
        "tic-tac": "Tic Tac",
        "bracelets": "Bracelets",
        "eye-liner": "Eye Liner",
        "ear-chain": "Ear Chain",
        "safety-pin": "Safety Pin",
        "nose-pin": "Nose Pin",
        "ear-supporters": "Ear Supporters",
        "anklets": "Anklets",
        "hip-chain": "Hip Chain",
        "nettichutti": "Nettichutti",
        "sticker": "Sticker",
        "saree-pin": "Saree Pin",
    },
}
OTHERS_SUBCATEGORY: dict[str, tuple[str, str]] = {
    "clothing": ("Others", "others"),
    "accessories": ("Others", "accessories-others"),
    "saree": ("Others", "saree-others"),
}
SAREE_SUBCATEGORY_SLUGS = set(ALLOWED_SUBCATEGORIES["saree"])
_SUBCATEGORY_ALIASES = {
    "2-pcs-set": "2-piece-set",
    "3-pcs-set": "3-piece-set",
    "coord-set": "co-ord-set",
    "co-ord-sets": "co-ord-set",
    "fork": "frock",
    "pattupavada": "pavada-blouse",
    "pavadai": "pavada",
    "pavada-blouses": "pavada-blouse",
    "set-mund": "set-mundu",
    "duppatta": "dupatta",
    "pants": "pant",
    "skirts-top": "skirt-top",
    "hair-clips": "hair-clip",
    "earring": "earrings",
    "bangle": "bangles",
    "anklet": "anklets",
    "mala": "necklace",
    "malas": "necklace",
    "necklaces": "necklace",
}

_CATEGORY_IMAGES: dict[str, str] = {
    **{
        slug: f"/assets/category-tiles/{slug}.{ext}"
        for slug, ext in {
            "kurti": "jpg", "top": "jpg", "saree": "jpg", "co-ord-set": "jpg", "3-piece-set": "jpg",
            "frock": "jpg", "set-mundu": "jpg", "pavada": "jpg", "pavada-blouse": "jpg", "set-saree": "jpg", "dupatta": "jpeg",
            "2-piece-set": "jpg", "dress-material": "jpg", "dhavani-set": "jpeg", "blouse": "jpg",
            "kaftan": "jpg", "short-top": "jpg", "pant": "jpg", "skirt-top": "jpg",
            "bindi": "jpg", "earrings": "jpg", "necklace": "jpg", "bangles": "jpg", "hair-clip": "jpg",
            "glass-bangles": "jpg", "tic-tac": "jpg", "bracelets": "jpg", "eye-liner": "jpg",
            "ear-chain": "jpg", "safety-pin": "jpg", "nose-pin": "jpg", "ear-supporters": "jpg",
            "anklets": "jpg", "hip-chain": "jpg", "nettichutti": "jpg", "sticker": "jpg", "saree-pin": "jpg",
        }.items()
    },
    "others": "/assets/category-tiles/others.jpeg",
    "accessories-others": "/assets/category-tiles/accessories-others.jpg",
    "saree-others": "/assets/category-tiles/saree-others.jpg",
}
_CATEGORY_DISPLAY_ORDER = (
    ("clothing", "kurti"),
    ("clothing", "top"),
    ("saree", "saree"),
    ("clothing", "co-ord-set"),
    ("clothing", "3-piece-set"),
    ("clothing", "frock"),
    ("clothing", "set-mundu"),
    ("clothing", "pavada"),
    ("clothing", "pavada-blouse"),
    ("saree", "set-saree"),
    ("clothing", "dupatta"),
    ("clothing", "2-piece-set"),
    ("clothing", "dress-material"),
    ("clothing", "dhavani-set"),
    ("clothing", "blouse"),
    ("clothing", "kaftan"),
    ("clothing", "short-top"),
    ("clothing", "pant"),
    ("clothing", "skirt-top"),
    ("accessories", "bindi"),
    ("accessories", "earrings"),
    ("accessories", "necklace"),
    ("accessories", "bangles"),
    ("accessories", "hair-clip"),
    ("accessories", "glass-bangles"),
    ("accessories", "tic-tac"),
    ("accessories", "bracelets"),
    ("accessories", "eye-liner"),
    ("accessories", "ear-chain"),
    ("accessories", "safety-pin"),
    ("accessories", "nose-pin"),
    ("accessories", "ear-supporters"),
    ("accessories", "anklets"),
    ("accessories", "hip-chain"),
    ("accessories", "nettichutti"),
    ("accessories", "sticker"),
    ("accessories", "saree-pin"),
    ("clothing", "others"),
    ("saree", "saree-others"),
    ("accessories", "accessories-others"),
)


def _normalize_subcategory(category_slug: str | None, name: str | None) -> tuple[str | None, str | None]:
    """Keep every listed subcategory; route unknown Zoho values to that section's Others."""
    if category_slug not in ALLOWED_SUBCATEGORIES:
        return name, (_slugify(name, "") if name else None)
    slug = _slugify(name, "") if name else ""
    slug = _SUBCATEGORY_ALIASES.get(slug, slug)
    allowed = ALLOWED_SUBCATEGORIES[category_slug]
    if slug in allowed:
        return allowed[slug], slug
    return OTHERS_SUBCATEGORY[category_slug]


def _sync_subcategories_to_categories(supabase: Any, subcategories_seen: dict[tuple[str, str], str]) -> None:
    """Ensure every supported subcategory and its fallback exists in the categories table."""
    desired: dict[tuple[str, str], str] = {}
    for category_type, slug in _CATEGORY_DISPLAY_ORDER:
        if slug == OTHERS_SUBCATEGORY.get(category_type, (None, None))[1]:
            desired[(category_type, slug)] = OTHERS_SUBCATEGORY[category_type][0]
        else:
            desired[(category_type, slug)] = ALLOWED_SUBCATEGORIES[category_type][slug]

    existing = supabase.table("categories").select("id,name,slug,type,image_url,display_order,is_active").execute()
    existing_rows = existing.data or []

    existing_by_slug = {row["slug"]: row for row in existing_rows if row.get("slug")}
    new_rows: list[dict[str, Any]] = []
    for order, ((category_type, slug), name) in enumerate(desired.items(), start=1):
        image_url = _CATEGORY_IMAGES.get(slug)
        row = existing_by_slug.get(slug)
        if row is None:
            new_rows.append(
                {
                    "name": name,
                    "slug": slug,
                    "type": category_type,
                    "image_url": image_url,
                    "display_order": order,
                    "is_active": True,
                }
            )
            continue

        updates: dict[str, Any] = {
            "name": name,
            "type": category_type,
            "display_order": order,
            "is_active": True,
            "image_url": image_url,
        }
        supabase.table("categories").update(updates).eq("id", row["id"]).execute()

    desired_slugs = {slug for _, slug in desired}
    for row in existing_rows:
        if row.get("slug") not in desired_slugs and row.get("is_active", True):
            supabase.table("categories").update({"is_active": False}).eq("id", row["id"]).execute()

    for start in range(0, len(new_rows), 100):
        supabase.table("categories").insert(new_rows[start : start + 100]).execute()


def _resolve_product_image(
    client: ZohoInventoryClient | None, item: dict[str, Any], item_id: str, existing_row: dict[str, Any] | None
) -> dict[str, Any]:
    """Returns image_url/image_source_id for a record. Zoho images are downloaded, compressed to
    <= 300 KB and stored in Supabase Storage; an unchanged image is never re-downloaded."""
    document_id = str(item.get("image_document_id") or "").strip()
    if not document_id:
        return {"image_url": _extract_image_url(item), "image_source_id": None}

    if existing_row and existing_row.get("image_url") and existing_row.get("image_source_id") == document_id:
        return {"image_url": existing_row["image_url"], "image_source_id": document_id}

    fallback = {
        "image_url": (existing_row or {}).get("image_url"),
        "image_source_id": (existing_row or {}).get("image_source_id"),
    }
    if client is None:
        return fallback
    try:
        data = client.download_item_image(item_id)
        if not data:
            return fallback
        return {"image_url": store_product_image(item_id, data), "image_source_id": document_id}
    except Exception:
        logger.exception("Could not sync image for Zoho item %s", item_id)
        return fallback


def _same_value(old: Any, new: Any) -> bool:
    if old in (None, "") and new in (None, ""):
        return True
    if isinstance(old, (int, float)) or isinstance(new, (int, float)):
        try:
            return abs(float(old) - float(new)) < 1e-9
        except (TypeError, ValueError):
            return False
    return old == new


def _changed_fields(row: dict[str, Any], record: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in record.items()
        if key != "last_synced_at" and not _same_value(row.get(key), value)
    }


def _with_retry(action: Any, attempts: int = 3) -> Any:
    for attempt in range(attempts):
        try:
            return action()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(1 + attempt)


def _apply_updates(supabase: Any, updates: list[tuple[str, dict[str, Any]]]) -> None:
    """Writes per-row updates concurrently; each row only carries the fields that changed."""
    if not updates:
        return

    def write(update: tuple[str, dict[str, Any]]) -> None:
        row_id, fields = update
        _with_retry(lambda: supabase.table("products").update(fields).eq("id", row_id).execute())

    with ThreadPoolExecutor(max_workers=_WRITE_WORKERS) as pool:
        list(pool.map(write, updates))


def _load_products(supabase: Any, columns: str = "*") -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        batch = supabase.table("products").select(columns).range(offset, offset + page_size - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
        offset += page_size


def _light_record(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": _extract_name(item),
        "description": _extract_description(item),
        "zoho_sku": _extract_sku(item),
        "stock_quantity": _extract_stock(item),
    }


def _category_fields(item: dict[str, Any], subcategories_seen: dict[tuple[str, str], str]) -> dict[str, Any]:
    category_slug = _extract_category_slug(item)
    subcategory_name = _extract_subcategory_name(item)
    raw_sub_slug = _slugify(subcategory_name, "") if subcategory_name else ""
    if _SUBCATEGORY_ALIASES.get(raw_sub_slug, raw_sub_slug) in SAREE_SUBCATEGORY_SLUGS:
        category_slug = "saree"
    subcategory_name, subcategory_slug = _normalize_subcategory(category_slug, subcategory_name)
    if category_slug and subcategory_name and subcategory_slug:
        subcategories_seen[(category_slug, subcategory_slug)] = subcategory_name
    return {
        "category_slug": category_slug,
        "subcategory_name": subcategory_name,
        "subcategory_slug": subcategory_slug,
    }


def _full_record(
    item: dict[str, Any],
    item_id: str,
    slug: str,
    image: dict[str, Any],
    subcategories_seen: dict[tuple[str, str], str],
) -> dict[str, Any]:
    return {
        "zoho_item_id": item_id,
        "slug": slug,
        "price": _extract_price(item),
        "compare_at_price": _extract_price(item),
        **_category_fields(item, subcategories_seen),
        "website_serial": _extract_website_serial(item),
        "color": _extract_color(item),
        "size": _extract_size(item),
        "kids_size": _extract_kids_size(item),
        "image_url": image["image_url"],
        "image_source_id": image["image_source_id"],
        "brand": _extract_brand(item),
        "length": _extract_dimension(item, "length"),
        "width": _extract_dimension(item, "width"),
        "height": _extract_dimension(item, "height"),
        "weight": _extract_weight(item),
        "dimension_unit": item.get("dimension_unit") or None,
        "weight_unit": item.get("weight_unit") or None,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        **_light_record(item),
    }


def _primary_variant_updates(
    rows: list[dict[str, Any]], new_records: list[dict[str, Any]]
) -> list[tuple[str, dict[str, Any]]]:
    """Re-ranks design variants after new products arrive; returns only rows whose primary flag flips."""
    stubs = [
        {
            "id": row["id"],
            "website_serial": row.get("website_serial"),
            "size": row.get("size"),
            "color": row.get("color"),
            "zoho_sku": row.get("zoho_sku"),
            "_was": row.get("is_primary_variant"),
        }
        for row in rows
        if row.get("is_active") and row.get("website_serial")
    ]
    _mark_primary_variants(stubs + new_records)
    return [
        (stub["id"], {"is_primary_variant": stub["is_primary_variant"]})
        for stub in stubs
        if stub["_was"] != stub["is_primary_variant"]
    ]


def _write_products_to_supabase(items: list[dict[str, Any]], partial: bool = False, light: bool = False) -> int:
    """Writes Zoho items to Supabase.

    light=True refreshes only name/SKU/description/stock on existing products (new products are inserted
    in full). Either way only rows whose values actually changed are written, concurrently, and inserts
    are batched. partial=True means `items` is a subset, so nothing is deactivated or deleted."""
    supabase = get_supabase()
    settings = get_settings()
    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )

    existing_rows = _load_products(supabase)
    existing_map = {row.get("zoho_item_id"): row for row in existing_rows if row.get("zoho_item_id")}
    used_slugs = {row.get("slug") for row in existing_rows if row.get("slug")}

    items = list(items)
    zoho_item_ids = {_extract_item_id(item) for item in items}
    zoho_item_ids.discard(None)

    # Zoho's paginated list can silently omit items, so anything we hold that is missing from it is
    # checked directly: still there -> processed normally, confirmed gone (404) -> removable.
    deleted_item_ids: list[str] = []
    if not partial:
        for missing_id in [i for i in existing_map if i not in zoho_item_ids]:
            try:
                found = client.fetch_item(missing_id)
            except Exception:
                logger.warning("Could not verify Zoho item %s; leaving it untouched", missing_id)
                zoho_item_ids.add(missing_id)
                continue
            if found:
                items.append(found)
                zoho_item_ids.add(missing_id)
            else:
                deleted_item_ids.append(missing_id)

    online_items = [item for item in items if _is_online_store_enabled(item)]
    online_item_ids = {_extract_item_id(item) for item in online_items}
    online_item_ids.discard(None)

    now = datetime.now(timezone.utc).isoformat()
    subcategories_seen: dict[tuple[str, str], str] = {}  # (type, slug) -> name
    updates: list[tuple[str, dict[str, Any]]] = []
    new_records: list[dict[str, Any]] = []
    existing_records: list[tuple[dict[str, Any], dict[str, Any]]] = []
    processed = 0
    category_changed = False
    for item in online_items:
        item_id = _extract_item_id(item)
        if not item_id:
            continue
        processed += 1
        row = existing_map.get(item_id)

        if row is not None and light:
            record = {**_light_record(item), **_category_fields(item, subcategories_seen)}
            if not row.get("is_active"):
                record["is_active"] = True
            changed = _changed_fields(row, record)
            if changed:
                updates.append((row["id"], {**changed, "last_synced_at": now}))
                if "subcategory_slug" in changed or "category_slug" in changed:
                    category_changed = True
            continue

        if row is not None:
            slug = row["slug"]
        else:
            base_slug = _slugify(_extract_name(item), item_id)
            slug = base_slug
            suffix = 2
            while slug in used_slugs:
                slug = f"{base_slug}-{suffix}"
                suffix += 1
            used_slugs.add(slug)

        image = _resolve_product_image(client, item, item_id, row)
        record = _full_record(item, item_id, slug, image, subcategories_seen)
        if row is None:
            new_records.append(record)
        else:
            existing_records.append((row, record))

    if not light:
        _mark_primary_variants([record for _, record in existing_records] + new_records)
        for row, record in existing_records:
            changed = _changed_fields(row, record)
            if changed:
                updates.append((row["id"], {**changed, "last_synced_at": now}))
    elif new_records:
        updates.extend(_primary_variant_updates(existing_rows, new_records))

    _apply_updates(supabase, updates)
    for start in range(0, len(new_records), 100):
        batch = new_records[start : start + 100]
        _with_retry(lambda: supabase.table("products").insert(batch).execute())

    if not light or new_records or category_changed:
        _sync_subcategories_to_categories(supabase, subcategories_seen)

    # Keep Zoho items that are still present but not online; physically remove confirmed-deleted items.
    disabled_item_ids = [
        zoho_item_id
        for zoho_item_id, row in existing_map.items()
        if zoho_item_id in zoho_item_ids and zoho_item_id not in online_item_ids and row.get("is_active")
    ]
    if partial:
        disabled_item_ids = []
        deleted_item_ids = []

    # Safety net: a partial/odd Zoho response must never wipe out the catalogue.
    removal_count = len(disabled_item_ids) + len(deleted_item_ids)
    if existing_map and removal_count > 20 and removal_count > len(existing_map) * 0.3:
        logger.warning(
            "Zoho sync skipped deactivating/deleting %s of %s products (suspicious response)",
            removal_count,
            len(existing_map),
        )
        disabled_item_ids = []
        deleted_item_ids = []

    for start in range(0, len(disabled_item_ids), 100):
        item_id_batch = disabled_item_ids[start : start + 100]
        supabase.table("products").update({"is_active": False}).in_("zoho_item_id", item_id_batch).execute()
    for start in range(0, len(deleted_item_ids), 100):
        item_id_batch = deleted_item_ids[start : start + 100]
        supabase.table("products").delete().in_("zoho_item_id", item_id_batch).execute()

    logger.info(
        "Zoho %s sync: %s online items, %s inserted, %s updated, %s deactivated, %s deleted",
        "light" if light else "full",
        processed,
        len(new_records),
        len(updates),
        len(disabled_item_ids),
        len(deleted_item_ids),
    )
    if updates or new_records or disabled_item_ids or deleted_item_ids:
        invalidate_catalog()
    return processed


_REFRESH_PREVIEW_FIELDS = (
    "name", "description", "zoho_sku", "stock_quantity", "price", "category_slug", "subcategory_name",
    "color", "size", "kids_size", "website_serial", "image_url", "is_active",
)


def refresh_product_from_zoho(sku: str) -> dict[str, Any]:
    """Re-fetches one product from Zoho (all fields, image forced) and overwrites its Supabase row.
    Raises LookupError when the SKU is unknown here or in Zoho, RuntimeError when Zoho cannot be reached."""
    supabase = get_supabase()
    settings = get_settings()
    if not all([settings.zoho_client_id, settings.zoho_client_secret, settings.zoho_refresh_token, settings.zoho_organization_id]):
        raise RuntimeError("Zoho Inventory credentials are not configured")

    rows = supabase.table("products").select("*").eq("zoho_sku", sku).limit(2).execute().data or []
    if not rows:
        raise LookupError(f"No product with SKU {sku} in the database")
    row = rows[0]

    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )
    item_id = row.get("zoho_item_id")
    item = client.fetch_item(item_id) if item_id else None
    if item is None:
        listing = client._request_json("/items", {"organization_id": client.organization_id, "sku": sku}).get("items") or []
        match = next((entry for entry in listing if entry.get("sku") == sku), None)
        item = client.fetch_item(match["item_id"]) if match else None
    if item is None:
        raise LookupError(f"SKU {sku} was not found in Zoho Inventory")
    item_id = _extract_item_id(item) or item_id

    image = {"image_url": row.get("image_url"), "image_source_id": row.get("image_source_id")}
    image_refreshed = False
    data = client.download_item_image(item_id)
    if data:
        document_id = str(item.get("image_document_id") or "").strip()
        image = {"image_url": store_product_image(item_id, data), "image_source_id": document_id or None}
        image_refreshed = True

    record = _full_record(item, item_id, row["slug"], image, {})
    record["is_active"] = _is_online_store_enabled(item)

    old_serial = row.get("website_serial")
    serials = {s for s in (old_serial, record.get("website_serial")) if s}
    sibling_rows = (
        supabase.table("products").select("*").in_("website_serial", list(serials)).neq("id", row["id"]).execute().data or []
        if serials
        else []
    )
    group = [dict(r) for r in sibling_rows if r.get("is_active")] + [record]
    _mark_primary_variants(group)

    changed = _changed_fields(row, record)
    _with_retry(lambda: supabase.table("products").update(record).eq("id", row["id"]).execute())
    flips = [
        (sibling["id"], {"is_primary_variant": flagged["is_primary_variant"]})
        for sibling, flagged in zip([r for r in sibling_rows if r.get("is_active")], group)
        if sibling.get("is_primary_variant") != flagged["is_primary_variant"]
    ]
    _apply_updates(supabase, flips)
    invalidate_catalog()

    updated = {"id": row["id"], **{key: record.get(key) for key in _REFRESH_PREVIEW_FIELDS}}
    return {
        "sku": sku,
        "changed_fields": sorted(changed),
        "image_refreshed": image_refreshed,
        "product": updated,
    }


async def sync_loop() -> None:
    settings = get_settings()
    interval_seconds = settings.zoho_inventory_sync_interval_seconds
    while True:
        try:
            await sync_products_to_supabase()
        except Exception:
            logger.exception("Zoho inventory sync failed")
        await asyncio.sleep(interval_seconds)


def create_invoice_for_order(
    customer_name: str,
    phone: str,
    email: str | None,
    address: str | None,
    city: str | None,
    notes: str | None,
    line_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Creates a real, detailed Zoho Inventory invoice for a website order. Runs
    synchronously — callers on the async request path should wrap this in asyncio.to_thread."""
    settings = get_settings()
    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )
    contact_name = build_online_customer_contact_name(customer_name)
    contact_id = client.get_or_create_contact_id(contact_name)
    return client.create_invoice(
        contact_id=contact_id,
        line_items=line_items,
        customer_name=customer_name,
        phone=phone,
        email=email,
        address=address,
        city=city,
        notes=notes,
    )
