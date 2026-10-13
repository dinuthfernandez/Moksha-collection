"""In-process state for the super admin console: maintenance mode, log buffer, audit trail, login throttle."""

import json
import logging
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = Path(__file__).resolve().parent.parent.parent / "maintenance_state.json"
STARTED_AT = time.time()

_lock = threading.Lock()
_maintenance: dict = {"enabled": False, "message": "", "eta": "", "since": None}


def _load_maintenance() -> None:
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        _maintenance.update({k: data.get(k, _maintenance[k]) for k in _maintenance})
    except (OSError, ValueError):
        pass


_load_maintenance()


def get_maintenance() -> dict:
    return dict(_maintenance)


def is_maintenance_on() -> bool:
    return bool(_maintenance["enabled"])


def set_maintenance(enabled: bool, message: str = "", eta: str = "") -> dict:
    with _lock:
        _maintenance["enabled"] = enabled
        _maintenance["message"] = message.strip()[:500]
        _maintenance["eta"] = eta.strip()[:100]
        _maintenance["since"] = datetime.now(timezone.utc).isoformat() if enabled else None
        try:
            STATE_FILE.write_text(json.dumps(_maintenance), encoding="utf-8")
        except OSError:
            logging.getLogger(__name__).warning("Could not persist maintenance state")
    return get_maintenance()


# --- live log buffer -------------------------------------------------------
_log_buffer: deque[str] = deque(maxlen=400)


class _BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_buffer.append(f"{datetime.fromtimestamp(record.created):%H:%M:%S} {record.levelname:<7} {record.name}: {record.getMessage()}")
        except Exception:
            pass


def install_log_buffer() -> None:
    root = logging.getLogger()
    if not any(isinstance(h, _BufferHandler) for h in root.handlers):
        root.addHandler(_BufferHandler(level=logging.INFO))
        if root.level > logging.INFO or root.level == logging.NOTSET:
            root.setLevel(logging.INFO)


def recent_logs(limit: int = 200) -> list[str]:
    return list(_log_buffer)[-limit:]


# --- audit trail -----------------------------------------------------------
_audit: deque[dict] = deque(maxlen=300)


def audit(action: str, ip: str, detail: str = "") -> None:
    entry = {"at": datetime.now(timezone.utc).isoformat(), "ip": ip, "action": action, "detail": detail[:300]}
    _audit.append(entry)
    logging.getLogger("superadmin").warning("AUDIT %s ip=%s %s", action, ip, detail[:300])


def audit_entries() -> list[dict]:
    return list(reversed(_audit))


# --- login throttle: 5 wrong passwords per IP (or 20 overall) => locked for 1 hour ---
MAX_FAILS_PER_IP = 5
MAX_FAILS_GLOBAL = 20
LOCK_SECONDS = 3600
_ip_fails: dict[str, list[float]] = {}
_global_fails: list[float] = []
_locked_until: dict[str, float] = {}


def _recent(entries: list[float]) -> list[float]:
    cutoff = time.time() - LOCK_SECONDS
    return [t for t in entries if t > cutoff]


def lock_remaining(ip: str) -> int:
    now = time.time()
    until = max(_locked_until.get(ip, 0), _locked_until.get("*", 0))
    return max(int(until - now), 0)


def register_failure(ip: str) -> None:
    now = time.time()
    with _lock:
        _ip_fails[ip] = _recent(_ip_fails.get(ip, [])) + [now]
        global _global_fails
        _global_fails = _recent(_global_fails) + [now]
        if len(_ip_fails[ip]) >= MAX_FAILS_PER_IP:
            _locked_until[ip] = now + LOCK_SECONDS
            _ip_fails[ip] = []
        if len(_global_fails) >= MAX_FAILS_GLOBAL:
            _locked_until["*"] = now + LOCK_SECONDS
            _global_fails = []


def register_success(ip: str) -> None:
    with _lock:
        _ip_fails.pop(ip, None)
