import asyncio
import json
import logging
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError
from uuid import uuid4

from ..config import get_settings
from ..database import get_supabase
from .cache import invalidate_catalog

logger = logging.getLogger(__name__)

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

        try:
            with request.urlopen(req, timeout=30) as response:
                response_body = response.read().decode("utf-8")
        except Exception as exc:  # pragma: no cover - surfaced to caller
            raise RuntimeError(f"Zoho token refresh failed: {exc}") from exc

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
        try:
            with request.urlopen(req, timeout=30) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:  # pragma: no cover - surfaced to caller
            error_body = exc.read().decode("utf-8") if exc.fp else ""
            raise RuntimeError(f"Zoho API request failed for {path}: {exc} — {error_body[:500]}") from exc
        except Exception as exc:  # pragma: no cover - surfaced to caller
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

            items.extend(batch)

            if len(batch) < page_size:
                break

            page += 1

        return items

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


async def sync_products_to_supabase() -> int:
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
    return await asyncio.to_thread(_write_products_to_supabase, items)


def _sync_subcategories_to_categories(supabase: Any, subcategories_seen: dict[tuple[str, str], str]) -> None:
    """Auto-populates the `categories` table (the "Shop by Category" tiles) from the
    distinct (Product Category, Product Sub Category) pairs actually present on
    synced items. Never overwrites an existing row's image_url/display_order, and
    never deletes rows (so a manually curated tile image always survives a resync)."""
    if not subcategories_seen:
        return

    existing = supabase.table("categories").select("slug").execute()
    existing_slugs = {row["slug"] for row in (existing.data or [])}

    new_rows = [
        {"name": name, "slug": slug, "type": category_type, "is_active": True}
        for (category_type, slug), name in subcategories_seen.items()
        if slug not in existing_slugs
    ]
    for start in range(0, len(new_rows), 100):
        supabase.table("categories").insert(new_rows[start : start + 100]).execute()


def _write_products_to_supabase(items: list[dict[str, Any]]) -> int:
    supabase = get_supabase()

    existing_rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        batch = (
            supabase.table("products")
            .select("id,zoho_item_id,slug,is_active")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = batch.data or []
        existing_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    existing_map = {row.get("zoho_item_id"): row for row in existing_rows if row.get("zoho_item_id")}
    existing_slug_map = {row.get("slug"): row for row in existing_rows if row.get("slug")}
    used_slugs = set(existing_slug_map.keys())
    zoho_item_ids = {_extract_item_id(item) for item in items}
    zoho_item_ids.discard(None)
    online_items = [item for item in items if _is_online_store_enabled(item)]
    online_item_ids = {_extract_item_id(item) for item in online_items}
    online_item_ids.discard(None)

    records: list[dict[str, Any]] = []
    subcategories_seen: dict[tuple[str, str], str] = {}  # (type, slug) -> name
    for item in online_items:
        item_id = _extract_item_id(item)
        if not item_id:
            continue

        existing_row = existing_map.get(item_id)
        # Keep the slug this row already owns; only mint a new one for genuinely new products.
        if existing_row and existing_row.get("slug"):
            slug = existing_row["slug"]
        else:
            base_slug = _slugify(_extract_name(item), item_id)
            slug = base_slug
            suffix = 2
            while slug in used_slugs:
                slug = f"{base_slug}-{suffix}"
                suffix += 1
        used_slugs.add(slug)

        category_slug = _extract_category_slug(item)
        subcategory_name = _extract_subcategory_name(item)
        subcategory_slug = _slugify(subcategory_name, "") if subcategory_name else None
        if category_slug and subcategory_name and subcategory_slug:
            subcategories_seen[(category_slug, subcategory_slug)] = subcategory_name

        record = {
            "zoho_item_id": item_id,
            "name": _extract_name(item),
            "slug": slug,
            "description": _extract_description(item),
            "price": _extract_price(item),
            "compare_at_price": _extract_price(item),
            "category_slug": category_slug,
            "subcategory_name": subcategory_name,
            "subcategory_slug": subcategory_slug,
            "website_serial": _extract_website_serial(item),
            "color": _extract_color(item),
            "size": _extract_size(item),
            "stock_quantity": _extract_stock(item),
            "image_url": _extract_image_url(item),
            "zoho_sku": _extract_sku(item),
            "brand": _extract_brand(item),
            "length": _extract_dimension(item, "length"),
            "width": _extract_dimension(item, "width"),
            "height": _extract_dimension(item, "height"),
            "weight": _extract_weight(item),
            "dimension_unit": item.get("dimension_unit") or None,
            "weight_unit": item.get("weight_unit") or None,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
        }
        record["_item_id"] = item_id
        records.append(record)

    _mark_primary_variants(records)

    synced_count = 0
    for record in records:
        item_id = record.pop("_item_id")
        slug = record["slug"]
        if item_id in existing_map:
            supabase.table("products").update(record).eq("zoho_item_id", item_id).execute()
        elif slug in existing_slug_map:
            supabase.table("products").update(record).eq("slug", slug).execute()
        else:
            supabase.table("products").insert(record).execute()
        synced_count += 1

    _sync_subcategories_to_categories(supabase, subcategories_seen)

    # Keep Zoho items that are still present but not online; physically remove deleted items.
    disabled_item_ids = [
        zoho_item_id
        for zoho_item_id, row in existing_map.items()
        if zoho_item_id in zoho_item_ids and zoho_item_id not in online_item_ids and row.get("is_active")
    ]
    deleted_item_ids = [zoho_item_id for zoho_item_id in existing_map if zoho_item_id not in zoho_item_ids]

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

    invalidate_catalog()
    return synced_count


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
