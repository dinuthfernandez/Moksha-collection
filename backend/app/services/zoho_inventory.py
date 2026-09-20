import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError

from ..config import get_settings
from ..database import get_supabase

WEBSITE_CONTACT_NAME = "Online Customer"


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

    def adjust_stock(self, zoho_item_id: str, delta_quantity: int) -> None:
        """Reduce or increase Zoho Inventory stock for a specific item after a website order."""
        if not zoho_item_id:
            return

        payload = {
            "organization_id": self.organization_id,
            "item_id": zoho_item_id,
            "quantity": delta_quantity,
        }
        token = self.get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        }
        data = parse.urlencode(payload).encode("utf-8")
        req = request.Request(
            f"https://www.zohoapis.com/inventory/v1/items/{zoho_item_id}/stock",
            data=data,
            headers=headers,
            method="POST",
        )
        with request.urlopen(req, timeout=30):
            pass

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
    accessory_keywords = (
        "accessor",
        "jewel",
        "bag",
        "clutch",
        "belt",
        "earring",
        "ear chain",
        "ear cuff",
        "necklace",
        "pendant",
        "bangle",
        "bracelet",
        "anklet",
        "ring",
        "scarf",
        "stole",
        "hair",
        "sunglass",
        "watch",
        "brooch",
        "purse",
        "wallet",
        "cap",
        "hat",
    )
    for key in ("group_name", "category_slug", "category", "product_category", "item_group"):
        value = item.get(key)
        if isinstance(value, dict):
            value = value.get("name") or value.get("slug") or value.get("category")
        if value not in (None, ""):
            normalized = str(value).lower().strip()
            if any(keyword in normalized for keyword in accessory_keywords):
                return "accessories"
            return "clothing"
    return "clothing"


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


def _write_products_to_supabase(items: list[dict[str, Any]]) -> int:
    supabase = get_supabase()

    existing_rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        batch = (
            supabase.table("products")
            .select("id,zoho_item_id,slug")
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

    synced_count = 0
    for item in items:
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

        record = {
            "zoho_item_id": item_id,
            "name": _extract_name(item),
            "slug": slug,
            "description": _extract_description(item),
            "price": _extract_price(item),
            "compare_at_price": _extract_price(item),
            "category_slug": _extract_category_slug(item),
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

        if item_id in existing_map:
            supabase.table("products").update(record).eq("zoho_item_id", item_id).execute()
        elif slug in existing_slug_map:
            supabase.table("products").update(record).eq("slug", slug).execute()
        else:
            supabase.table("products").insert(record).execute()
        synced_count += 1

    # Items no longer returned by Zoho (deleted/archived there) are deactivated
    # so they disappear from the website without losing their historical row.
    seen_item_ids = {_extract_item_id(item) for item in items if _extract_item_id(item)}
    removed_item_ids = [
        zoho_item_id
        for zoho_item_id, row in existing_map.items()
        if zoho_item_id not in seen_item_ids and row.get("id")
    ]
    for zoho_item_id in removed_item_ids:
        supabase.table("products").update({"is_active": False}).eq("zoho_item_id", zoho_item_id).execute()

    return synced_count


async def sync_loop() -> None:
    settings = get_settings()
    interval_seconds = settings.zoho_inventory_sync_interval_seconds
    while True:
        try:
            await sync_products_to_supabase()
        except Exception:
            pass
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
