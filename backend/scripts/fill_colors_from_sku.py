"""Add a Color column to Zoho_Items_Export.xlsx.

Fills color for every item, derived from SKU color-code tokens, mapped
to the exact live Zoho "Color" custom-field dropdown values (fetched and
confirmed against /settings/customfields, entity=item, api_name=cf_color).

Uses "Colour code Guide.xlsx" as the base code -> color-name reference,
extended with additional codes observed in real SKUs that were missing
or differently spelled in the guide (e.g. BLK, BLU, YLW, GLD, NVY, etc.).
Items whose SKU has no recognizable single color token (e.g. pearl
earrings, eyeliner, nose pins, multi-color combos) are left blank rather
than guessed.
"""
import re

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

EXCEL_PATH = r"C:\Users\Asus\Desktop\Moksha collection\Zoho_Items_Export.xlsx"
GUIDE_PATH = r"C:\Users\Asus\Desktop\Moksha collection\Colour code Guide.xlsx"

# Raw color name (as derived from guide/codes) -> exact live Zoho "Color" dropdown value.
RAWNAME_TO_ZOHO = {
    "BLACK": "Black",
    "GOLDEN": "Golden",
    "MAROON": "Maroon",
    "PINK": "Pink",
    "GREEN": "Green",
    "OXIDIZED": "Oxidized",
    "MIX COLOUR": "Mix Colour",
    "BLUE": "Blue",
    "RED": "Red",
    "WHITE": "White",
    "OFF WHITE": "Off White",
    "PURPLE": "Purple",
    "YELLOW": "Yellow",
    "ORANGE": "Orange",
    "NAVY BLUE": "Navy Blue",
    "DARK GREEN": "Dark Green",
    "GREY": "Gray",
    "BROWN": "Brown",
    "OLIVE GREEN": "Olive Green",
    "LAVENDER": "Lavender",
    "DARK BLUE": "Dark Blue",
    "ROSE PINK": "Rose Pink",
    "GRAPE": "Grape",
    "DARK PINK": "Dark Pink",
    "SILVER": "plain Silver",
    "INDIGO": "Indigo",
    # Ambiguous two-color combinations - no single Zoho value fits, left unmapped on purpose.
    # "PURPLE WHITE": None,
    # "RED WHITE": None,
}

# Extra codes observed in real SKUs but missing/mis-spelled in the guide file.
EXTRA_CODES = {
    "BLK": "BLACK",
    "BLU": "BLUE",
    "BLUE": "BLUE",
    "YLW": "YELLOW",
    "YLE": "YELLOW",
    "MX": "MIX COLOUR",
    "WT": "WHITE",
    "GLD": "GOLDEN",
    "GOLDEN": "GOLDEN",
    "SILVER": "SILVER",
    "NVY": "NAVY BLUE",
    "NAVY": "NAVY BLUE",
    "INDG": "INDIGO",
    "OLV": "OLIVE GREEN",
    "ORNG": "ORANGE",
    "RPNK": "ROSE PINK",
    "GREEN": "GREEN",
    "GREY": "GREY",
    "GR": "GREEN",
    "PUP": "PURPLE",
}

# Two-token combinations seen in SKUs (e.g. "DRK BLU" -> Dark Blue).
COMBO_CODES = {
    ("DRK", "BLU"): "DARK BLUE", ("DRK", "BLUE"): "DARK BLUE",
    ("DRK", "GRN"): "DARK GREEN", ("DRK", "GREEN"): "DARK GREEN",
    ("LMN", "YLW"): "YELLOW", ("MST", "YLW"): "YELLOW",
}


def load_code_map() -> dict:
    gwb = openpyxl.load_workbook(GUIDE_PATH, data_only=True)
    gws = gwb["Sheet1"]
    code_to_name = {}
    for row in gws.iter_rows(min_row=5, values_only=True):
        cat, code, name = row[0], row[1], row[2]
        if code and name:
            code_to_name[code.strip().upper()] = name.strip().upper()
    code_to_name.update(EXTRA_CODES)
    return code_to_name


def tokens_of(sku: str):
    return [t for t in re.split(r"[^A-Za-z0-9]+", sku) if t]


def detect_color(sku: str, code_to_name: dict) -> str:
    toks = tokens_of(sku or "")
    up_toks = [t.upper() for t in toks]
    for i, tok in enumerate(up_toks):
        if i + 1 < len(up_toks) and (tok, up_toks[i + 1]) in COMBO_CODES:
            raw = COMBO_CODES[(tok, up_toks[i + 1])]
            return RAWNAME_TO_ZOHO.get(raw, "")
        if tok in code_to_name:
            raw = code_to_name[tok]
            return RAWNAME_TO_ZOHO.get(raw, "")
        if i + 1 < len(up_toks):
            pair = tok + up_toks[i + 1]
            if pair in code_to_name:
                raw = code_to_name[pair]
                return RAWNAME_TO_ZOHO.get(raw, "")
    return ""


def main() -> None:
    code_to_name = load_code_map()

    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb.active
    headers = [c.value for c in ws[1]]

    sku_col = headers.index("SKU") + 1

    if "Color" in headers:
        color_col = headers.index("Color") + 1
    else:
        color_col = len(headers) + 1
        header_cell = ws.cell(row=1, column=color_col, value="Color")
        header_cell.font = Font(bold=True, color="FFFFFF")
        header_cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(color_col)].width = 16

    filled = 0
    blank = 0
    unmatched_examples = []

    for row_idx in range(2, ws.max_row + 1):
        sku = ws.cell(row=row_idx, column=sku_col).value or ""
        cell = ws.cell(row=row_idx, column=color_col)
        color = detect_color(sku, code_to_name)
        if color:
            cell.value = color
            cell.alignment = Alignment(horizontal="center", vertical="center")
            filled += 1
        else:
            cell.value = None
            blank += 1
            unmatched_examples.append(sku)

    wb.save(EXCEL_PATH)

    print(f"Rows with color filled: {filled}")
    print(f"Rows left blank (no detectable color): {blank}")
    print("Sample of unmatched SKUs:")
    for s in unmatched_examples[:30]:
        print(" ", s)


if __name__ == "__main__":
    main()
