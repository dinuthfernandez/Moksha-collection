import asyncio
import logging
import threading
import time
from datetime import datetime
from typing import Any

from . import zoho_inventory

_lock = threading.Lock()
_state: dict[str, Any] = {
    "running": False,
    "percent": 0.0,
    "message": "Idle",
    "started_at": None,
    "finished_at": None,
    "status": "idle",
    "result": None,
    "logs": [],
}
_task: asyncio.Task | None = None
_MAX_LOGS = 500


def _log(line: str) -> None:
    with _lock:
        _state["logs"].append(f"{datetime.now():%H:%M:%S} {line}")
        del _state["logs"][:-_MAX_LOGS]


class _JobLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.INFO:
            _log(f"{record.levelname:<7} {record.getMessage()}")


def _on_progress(percent: float, message: str) -> None:
    with _lock:
        _state["percent"] = max(_state["percent"], round(percent, 1))
        _state["message"] = message
    _log(message)


def snapshot(since: int = 0) -> dict[str, Any]:
    with _lock:
        data = {k: v for k, v in _state.items() if k != "logs"}
        data["log_total"] = len(_state["logs"])
        data["logs"] = _state["logs"][since:] if since < len(_state["logs"]) else []
    if data["running"] and data["started_at"]:
        data["elapsed_seconds"] = int(time.time() - data["started_at"])
    return data


async def _run() -> None:
    handler = _JobLogHandler()
    zoho_logger = logging.getLogger("app.services.zoho_inventory")
    zoho_logger.addHandler(handler)
    zoho_inventory.set_progress_callback(_on_progress)
    try:
        _on_progress(1, "Connecting to Zoho Inventory")
        total = await zoho_inventory.sync_products_to_supabase(full=True)
        with _lock:
            _state.update(status="done", percent=100.0, message=f"Finished: {total} item(s) processed", result=total)
        _log(f"Finished: {total} item(s) processed")
    except Exception as exc:
        with _lock:
            _state.update(status="failed", message=f"Failed: {exc}")
        _log(f"ERROR   Sync failed: {exc}")
    finally:
        zoho_inventory.set_progress_callback(None)
        zoho_logger.removeHandler(handler)
        with _lock:
            _state.update(running=False, finished_at=time.time())


def start() -> bool:
    """Starts a full Zoho -> Supabase sync in the background. Returns False if one is already running."""
    global _task
    with _lock:
        if _state["running"]:
            return False
        _state.update(
            running=True, percent=0.0, message="Starting", started_at=time.time(),
            finished_at=None, status="running", result=None, logs=[],
        )
    _task = asyncio.get_running_loop().create_task(_run())
    return True
