"""Push the enriched Category/Sub Category/Size/Color/Website Serial values
from Zoho_Items_Export.xlsx into live Zoho Inventory items via the API.

Only the 5 custom fields are touched (via a scoped `custom_fields` PUT body);
every other item attribute (stock, price, name, description, etc.) is left
completely untouched, as verified by Zoho's partial-update behavior.

Resumable: writes progress to _website_serial_push_progress.json so a re-run
skips SKUs already pushed successfully.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import openpyxl

from app.config import get_settings
from app.services.zoho_inventory import ZohoInventoryClient

EXCEL_PATH = r"C:\Users\Asus\Desktop\Moksha collection\Zoho_Items_Export.xlsx"
PROGRESS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_website_serial_push_progress.json")

# customfield_id for each dropdown/number field (fetched earlier from /settings/customfields)
FIELD_IDS = {
    "Product Category": "6877211000004416004",
    "Product Sub Category": "6877211000004416009",
    "Color": "6877211000005357007",
    "Size": "6877211000005357044",
    "Website Serial": "6877211000005477020",
}


def load_progress() -> dict:
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"done_skus": [], "failed": {}}


def save_progress(progress: dict) -> None:
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


def main() -> None:
    settings = get_settings()
    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )

    print("Fetching all live Zoho items to build SKU -> item_id map...")
    live_items = client.fetch_all_items()
    sku_to_item_id = {}
    for it in live_items:
        sku = it.get("sku")
        item_id = it.get("item_id")
        if sku and item_id:
            sku_to_item_id[sku.strip()] = item_id
    print(f"Live Zoho items: {len(live_items)}, unique SKUs: {len(sku_to_item_id)}")

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb.active
    headers = [c.value for c in ws[1]]
    col = {h: i for i, h in enumerate(headers)}

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        rows.append(row)
    print(f"Excel rows: {len(rows)}")

    progress = load_progress()
    done_skus = set(progress["done_skus"])
    failed = progress["failed"]

    not_found = []
    pushed = 0
    skipped_already_done = 0

    for idx, row in enumerate(rows, start=1):
        sku = row[col["SKU"]]
        if not sku:
            continue
        sku = str(sku).strip()

        if sku in done_skus:
            skipped_already_done += 1
            continue

        item_id = sku_to_item_id.get(sku)
        if not item_id:
            not_found.append(sku)
            continue

        category = row[col["Product Category"]]
        sub_category = row[col["Product Sub Category"]]
        size = row[col["Size"]] if "Size" in col else None
        color = row[col["Color"]] if "Color" in col else None
        website_serial = row[col["Website Serial"]] if "Website Serial" in col else None

        custom_fields = []
        if category:
            custom_fields.append({"customfield_id": FIELD_IDS["Product Category"], "value": str(category)})
        if sub_category:
            custom_fields.append({"customfield_id": FIELD_IDS["Product Sub Category"], "value": str(sub_category)})
        if size:
            custom_fields.append({"customfield_id": FIELD_IDS["Size"], "value": str(size)})
        if color:
            custom_fields.append({"customfield_id": FIELD_IDS["Color"], "value": str(color)})
        if website_serial not in (None, ""):
            # Website Serial is a Zoho "number" field; strip leading zeros/text padding.
            try:
                numeric_serial = int(str(website_serial).strip())
                custom_fields.append({"customfield_id": FIELD_IDS["Website Serial"], "value": numeric_serial})
            except ValueError:
                pass

        if not custom_fields:
            done_skus.add(sku)
            continue

        body = {"custom_fields": custom_fields}

        attempt = 0
        while attempt < 3:
            try:
                client._request_json(
                    f"/items/{item_id}",
                    {"organization_id": settings.zoho_organization_id},
                    method="PUT",
                    json_body=body,
                )
                done_skus.add(sku)
                failed.pop(sku, None)
                pushed += 1
                break
            except Exception as exc:  # noqa: BLE001
                attempt += 1
                if attempt >= 3:
                    failed[sku] = str(exc)[:300]
                else:
                    time.sleep(2 * attempt)

        # Zoho API rate limit friendliness + periodic progress save.
        time.sleep(0.35)
        if idx % 50 == 0:
            progress["done_skus"] = sorted(done_skus)
            progress["failed"] = failed
            save_progress(progress)
            print(f"  ...processed {idx}/{len(rows)} rows (pushed so far: {pushed})")

    progress["done_skus"] = sorted(done_skus)
    progress["failed"] = failed
    save_progress(progress)

    print("\n=== DONE ===")
    print(f"Pushed this run: {pushed}")
    print(f"Already done (skipped): {skipped_already_done}")
    print(f"Not found in live Zoho (SKU mismatch): {len(not_found)}")
    if not_found:
        print("  Sample not-found SKUs:", not_found[:10])
    print(f"Failed after retries: {len(failed)}")
    if failed:
        print("  Sample failures:", list(failed.items())[:5])


if __name__ == "__main__":
    main()
