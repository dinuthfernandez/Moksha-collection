"""
Updates Zoho Inventory from Zoho_Items_Export.xlsx (matched by SKU):
  - Item Name        <- Excel "Item Name"
  - Item Description <- Excel "Description" (in Zoho this is the item GROUP's description)
  - Sales Information description and Purchase Information description are emptied.

Usage (from backend folder):
    .venv\\Scripts\\python.exe scripts\\update_zoho_names_descriptions.py --dry-run [--limit N]
    .venv\\Scripts\\python.exe scripts\\update_zoho_names_descriptions.py [--limit N]

Progress is written to zoho_item_update.log and zoho_item_update_done.json (re-running resumes).
"""
import json
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from threading import Lock

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.zoho_inventory import ZohoInventoryClient, get_settings  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
EXCEL = ROOT / "Zoho_Items_Export.xlsx"
LOG = ROOT / "zoho_item_update.log"
DONE_FILE = ROOT / "zoho_item_update_done.json"
WORKERS = 3

lock = Lock()


def log(msg: str) -> None:
    line = f"{datetime.now():%H:%M:%S} {msg}"
    with lock:
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
        print(line, flush=True)


def put(client: ZohoInventoryClient, path: str, body: dict) -> dict:
    """PUT with retries only on rate limiting (429), where Zoho has not applied the change."""
    for attempt in range(6):
        try:
            return client._request_json(path, {"organization_id": client.organization_id}, method="PUT", json_body=body)
        except RuntimeError as exc:
            if "429" in str(exc) and attempt < 5:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    return {}


def main() -> None:
    dry = "--dry-run" in sys.argv
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

    s = get_settings()
    client = ZohoInventoryClient(
        client_id=s.zoho_client_id, client_secret=s.zoho_client_secret,
        refresh_token=s.zoho_refresh_token, organization_id=s.zoho_organization_id,
    )

    ws = openpyxl.load_workbook(EXCEL, read_only=True).active
    excel: dict[str, tuple[str, str]] = {}
    for row in list(ws.iter_rows(values_only=True))[1:]:
        if row[1]:
            excel[str(row[1]).strip()] = (str(row[0] or "").strip(), str(row[8] or "").strip())
    log(f"Excel rows: {len(excel)} | mode: {'DRY RUN' if dry else 'LIVE'}")

    log("Loading all Zoho items (slow)...")
    items = client.fetch_all_items()
    log(f"Zoho items: {len(items)}")

    done = set(json.loads(DONE_FILE.read_text())) if DONE_FILE.exists() and not dry else set()

    groups: dict[str, list[dict]] = defaultdict(list)
    singles: list[dict] = []
    for it in items:
        (groups[it["group_id"]] if it.get("group_id") else singles).append(it)

    def xl(it: dict) -> tuple[str, str]:
        return excel.get(str(it.get("sku") or "").strip(), (str(it.get("name") or ""), str(it.get("description") or "")))

    not_in_excel = [it.get("sku") for it in items if str(it.get("sku") or "").strip() not in excel]
    conflicts = sum(1 for v in groups.values() if len({xl(i)[1] for i in v}) > 1)
    log(f"Groups: {len(groups)} | ungrouped items: {len(singles)} | groups whose members have different Excel descriptions: {conflicts} | items not in Excel (name kept, only descriptions cleared): {len(not_in_excel)}")

    tasks: list[tuple[str, object]] = [("G", (g, v)) for g, v in groups.items()] + [("S", it) for it in singles]
    if limit:
        tasks = tasks[:limit]
    total = len(tasks)
    counter = {"n": 0, "ok": 0, "fail": 0}

    def process(task) -> None:
        kind, data = task
        with lock:
            counter["n"] += 1
            n = counter["n"]
        members = data[1] if kind == "G" else [data]
        label = ", ".join(str(m.get("sku")) for m in members[:3]) + ("..." if len(members) > 3 else "")
        if all(str(m["item_id"]) in done for m in members):
            log(f"[{n}/{total}] {label} already done")
            return
        try:
            if kind == "G":
                gid, mem = data
                desc = xl(mem[0])[1]
                if dry:
                    log(f"[{n}/{total}] DRY group {mem[0].get('group_name')!r}: item description -> {desc!r} | {len(mem)} item(s): " + "; ".join(f"{m.get('name')!r}->{xl(m)[0]!r}" for m in mem[:3]))
                    return
                body = {
                    "group_name": mem[0].get("group_name"),
                    "description": desc,
                    "items": [{"item_id": str(m["item_id"]), "name": xl(m)[0] or m.get("name"), "sku": m.get("sku"),
                              "rate": m.get("rate"), "purchase_rate": m.get("purchase_rate") or 0} for m in mem],
                }
                put(client, f"/itemgroups/{gid}", body)
            for m in members:
                if dry:
                    log(f"[{n}/{total}] DRY single {m.get('sku')}: name {m.get('name')!r}->{xl(m)[0]!r}")
                    continue
                put(client, f"/items/{m['item_id']}", {"name": xl(m)[0] or m.get("name"), "description": "", "purchase_description": ""})
            with lock:
                for m in members:
                    done.add(str(m["item_id"]))
                counter["ok"] += 1
                DONE_FILE.write_text(json.dumps(sorted(done)))
            log(f"[{n}/{total}] OK {label} | {len(members)} item(s) | names + item description set, sales/purchase descriptions cleared")
        except Exception as exc:
            with lock:
                counter["fail"] += 1
            log(f"[{n}/{total}] FAIL {label}: {str(exc)[:250]}")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        list(pool.map(process, tasks))

    log(f"FINISHED | ok {counter['ok']} | failed {counter['fail']} | total {total}")


if __name__ == "__main__":
    main()
