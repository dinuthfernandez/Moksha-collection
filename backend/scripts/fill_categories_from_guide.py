"""
Fills Product Category / Product Sub Category in Zoho_Items_Export.xlsx.

Approach
--------
1. Fetch the live dropdown options for the "Product Category" and
   "Product Sub Category" custom fields from Zoho Inventory (so we only ever
   write values that actually exist as selectable options in Zoho).
2. Read the guide file ("Stock Categories List ... .xlsx") to build a
   Code -> (Category, Sub Category) lookup (used only as a fallback for the
   generic "OTHER ITEMS" Zoho item-group, whose SKUs carry a short code like
   MC-HRC-... instead of a descriptive group name).
3. For every Zoho item, the *item group name* (e.g. "KURTI", "Bindi",
   "CO ORD SET") is the primary, high-confidence signal and is matched
   (case/spacing/punctuation-insensitive, with known typo variants) directly
   against the guide's category names.
4. Items that cannot be confidently matched (no safe guide/dropdown match)
   are left blank and flagged in a "Needs Review" column instead of being
   guessed, and are also printed to the console.

Usage:
    .venv\\Scripts\\python.exe scripts\\fill_categories_from_guide.py
"""
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openpyxl import load_workbook
from openpyxl.styles import PatternFill

from app.config import get_settings
from app.services.zoho_inventory import ZohoInventoryClient

GUIDE_PATH = Path(r"C:\Users\Asus\Desktop\Stock Categories List 051026 R1.xlsx")
EXPORT_PATH = Path(r"C:\Users\Asus\Desktop\Moksha collection\Zoho_Items_Export.xlsx")

# Known group-name variants (typos / alternate spellings seen in real Zoho
# data) mapped to the exact guide category name they represent.
CLOTHING_ALIASES = {
    "KURTI": "Kurti",
    "KURTHI": "Kurti",
    "TOP": "Top",
    "SAREE": "Saree",
    "CO ORD SET": "Co-ord Set",
    "CORD SET": "Co-ord Set",
    "3 PIECE SET": "3 Piece Set",
    "FROCK": "Frock",
    "SET MUNDU": "Set Mundu",
    "SET MUND": "Set Mundu",
    "PAVADA": "Pavada",
    "PAVADA BLOUSE": "Pavada Blouse",
    "SET SAREE": "Set Saree",
    "DUPPATTA": "Dupatta",
    "DUPATTA": "Dupatta",
    "2 PIECE SET": "2 Piece Set",
    "MATERIAL": "Dress Material",
    "DRESS MATERIAL": "Dress Material",
    "DHAVANI SET": "Dhavani Set",
    "BLOUSE": "Blouse",
    "KAFTAN": "Kaftan",
    "SHORT TOP": "Short Top",
    "PANT": "Pant",
    "SKIRT & TOP": "Skirt & Top",
}
ACCESSORIES_ALIASES = {
    "BINDI": "Bindi",
    "EARRINGS": "Earrings",
    "EARRING": "Earrings",
    "NECKLACE": "Necklace",
    "BANGLE": "Bangles",
    "BANGLES": "Bangles",
    "350 GLASBANGLES": "Glass Bangles",
    "GLASS BANGLES": "Glass Bangles",
    "TIC TAC": "Tic Tac",
    "BRACELETS": "Bracelets",
    "MALA": "Mala",
    "EYE LINER": "Eye Liner",
    "EAR CHAIN": "Ear Chain",
    "SAFETY PIN": "Safety Pin",
    "NOSE PIN": "Nose Pin",
    "ANKLETS": "Anklets",
    "SAREE PIN": "Saree Pin",
}
# Group name that is a generic catch-all bucket; resolved via SKU code instead.
CATCH_ALL_GROUP = "OTHER ITEMS"
# Group names with no safe mapping to any of the 38 guide sub-categories.
KNOWN_UNRESOLVABLE_GROUPS = {"TEST"}


def normalize(value: str) -> str:
    value = (value or "").upper()
    value = re.sub(r"[^A-Z0-9& ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def load_guide_code_maps(guide_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Returns (clothing_code -> sub_category, accessories_code -> sub_category)."""
    workbook = load_workbook(guide_path, data_only=True)
    sheet = workbook["Categories"]
    clothing_codes: dict[str, str] = {}
    accessories_codes: dict[str, str] = {}
    for row in sheet.iter_rows(min_row=4, values_only=True):
        if row[1] and row[2]:
            clothing_codes[normalize(str(row[2]))] = str(row[1]).strip()
        if row[4] and row[5]:
            accessories_codes[normalize(str(row[5]))] = str(row[4]).strip()
    return clothing_codes, accessories_codes


def fetch_valid_dropdown_values(client: ZohoInventoryClient, organization_id: str) -> tuple[set[str], set[str]]:
    meta = client._request_json("/settings/customfields", {"organization_id": organization_id, "entity": "item"})
    item_fields = meta.get("customfields", {}).get("item", [])
    categories: set[str] = set()
    sub_categories: set[str] = set()
    for field in item_fields:
        if field.get("api_name") == "cf_product_category":
            categories = {v.get("name") for v in field.get("values", []) if v.get("is_active")}
        elif field.get("api_name") == "cf_product_sub_category":
            sub_categories = {v.get("name") for v in field.get("values", []) if v.get("is_active")}
    return categories, sub_categories


def resolve_other_items_code(
    sku: str, description: str, clothing_codes: dict[str, str], accessories_codes: dict[str, str]
) -> tuple[str, str] | None:
    parts = (sku or "").split("-")
    code = normalize(parts[1]) if len(parts) > 1 else ""
    in_clothing = code in clothing_codes
    in_accessories = code in accessories_codes

    if in_clothing and in_accessories:
        # Known ambiguous code (e.g. "ST" = Short Top vs Sticker): disambiguate via description.
        desc_norm = normalize(description)
        if accessories_codes[code].upper() in desc_norm:
            return "Accessories", accessories_codes[code]
        if clothing_codes[code].upper() in desc_norm:
            return "Clothing", clothing_codes[code]
        return None
    if in_accessories:
        return "Accessories", accessories_codes[code]
    if in_clothing:
        return "Clothing", clothing_codes[code]
    return None


def main() -> None:
    settings = get_settings()
    client = ZohoInventoryClient(
        client_id=settings.zoho_client_id,
        client_secret=settings.zoho_client_secret,
        refresh_token=settings.zoho_refresh_token,
        organization_id=settings.zoho_organization_id,
    )

    print("Fetching live Product Category / Product Sub Category dropdown options from Zoho...")
    valid_categories, valid_sub_categories = fetch_valid_dropdown_values(client, settings.zoho_organization_id)
    print(f"  Valid categories: {sorted(valid_categories)}")
    print(f"  Valid sub-categories ({len(valid_sub_categories)}): {sorted(valid_sub_categories)}")

    print("Reading guide file for SKU-code fallback mapping (OTHER ITEMS bucket)...")
    clothing_codes, accessories_codes = load_guide_code_maps(GUIDE_PATH)

    print("Fetching full item list from Zoho Inventory...")
    items = client.fetch_all_items()
    print(f"Found {len(items)} items.")

    # Items in the catch-all bucket need their description to resolve ambiguous codes.
    catch_all_ids = [it["item_id"] for it in items if normalize(it.get("item_name") or "") == CATCH_ALL_GROUP]
    descriptions: dict[str, str] = {}
    print(f"Fetching descriptions for {len(catch_all_ids)} 'OTHER ITEMS' entries...")
    for idx, item_id in enumerate(catch_all_ids, start=1):
        detail = client._request_json("/items/" + item_id, {"organization_id": settings.zoho_organization_id})
        descriptions[item_id] = (detail.get("item", detail)).get("description") or ""
        if idx % 25 == 0:
            print(f"  {idx}/{len(catch_all_ids)}")

    by_sku: dict[str, dict[str, str]] = {}
    unresolved: list[dict[str, str]] = []

    for item in items:
        sku = item.get("sku") or ""
        group_norm = normalize(item.get("item_name") or "")

        category = ""
        sub_category = ""

        if group_norm in CLOTHING_ALIASES:
            category, sub_category = "Clothing", CLOTHING_ALIASES[group_norm]
        elif group_norm in ACCESSORIES_ALIASES:
            category, sub_category = "Accessories", ACCESSORIES_ALIASES[group_norm]
        elif group_norm == CATCH_ALL_GROUP:
            resolved = resolve_other_items_code(
                sku, descriptions.get(item.get("item_id", ""), ""), clothing_codes, accessories_codes
            )
            if resolved:
                category, sub_category = resolved

        if category and sub_category:
            if category not in valid_categories or sub_category not in valid_sub_categories:
                unresolved.append({"sku": sku, "item_name": item.get("item_name") or "", "reason": "resolved value not in live Zoho dropdown"})
                category, sub_category = "", ""
        else:
            unresolved.append({"sku": sku, "item_name": item.get("item_name") or "", "reason": "no confident mapping"})

        by_sku[sku] = {"category": category, "sub_category": sub_category}

    print(f"\nResolved {sum(1 for v in by_sku.values() if v['category'])} / {len(items)} items.")
    if unresolved:
        print(f"{len(unresolved)} item(s) left blank (need manual review):")
        for u in unresolved:
            print(f"  - SKU={u['sku']!r} group={u['item_name']!r} ({u['reason']})")

    print("\nUpdating Excel file...")
    workbook = load_workbook(EXPORT_PATH)
    sheet = workbook["Zoho Items"]

    headers = [cell.value for cell in sheet[1]]
    sku_col = headers.index("SKU") + 1
    category_col = headers.index("Product Category") + 1
    sub_category_col = headers.index("Product Sub Category") + 1
    review_col = len(headers) + 1
    if "Needs Review" not in headers:
        sheet.cell(row=1, column=review_col, value="Needs Review")

    flag_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

    updated = 0
    still_unresolved = 0
    for row_idx in range(2, sheet.max_row + 1):
        sku_value = sheet.cell(row=row_idx, column=sku_col).value or ""
        mapping = by_sku.get(sku_value)
        if mapping is None:
            continue
        if mapping["category"] and mapping["sub_category"]:
            sheet.cell(row=row_idx, column=category_col, value=mapping["category"])
            sheet.cell(row=row_idx, column=sub_category_col, value=mapping["sub_category"])
            sheet.cell(row=row_idx, column=review_col, value=None)
            updated += 1
        else:
            sheet.cell(row=row_idx, column=review_col, value="Yes - no confident category match")
            sheet.cell(row=row_idx, column=review_col).fill = flag_fill
            still_unresolved += 1

    sheet.column_dimensions[sheet.cell(row=1, column=review_col).column_letter].width = 28

    workbook.save(EXPORT_PATH)
    print(f"Updated {updated} rows with Product Category / Sub Category.")
    print(f"{still_unresolved} rows flagged in 'Needs Review' column.")
    print(f"Saved: {EXPORT_PATH}")


if __name__ == "__main__":
    main()
