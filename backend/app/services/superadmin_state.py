"""In-process state for the super admin console: maintenance mode, log buffer, audit trail, login throttle."""

import hashlib
import hmac
import json
import logging
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = Path(__file__).resolve().parent.parent.parent / "maintenance_state.json"
STARTED_AT = time.time()

_lock = threading.Lock()
_maintenance: dict = {"enabled": False, "message": "", "eta": "", "since": None}
_bypass: dict = {"hash": ""}


def _apply(data: dict) -> None:
    _maintenance.update({k: data.get(k, _maintenance[k]) for k in _maintenance})
    _bypass["hash"] = str(data.get("bypass_hash", "") or "")


def _load_maintenance() -> None:
    """Loads from Supabase (survives Render restarts); falls back to the local file."""
    try:
        from ..database import get_supabase

        rows = get_supabase().table("app_state").select("value").eq("key", "maintenance").limit(1).execute().data
        if rows:
            _apply(rows[0]["value"] or {})
            return
    except Exception:
        logging.getLogger(__name__).warning("Could not load maintenance state from database", exc_info=True)
    try:
        _apply(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass


def _persist() -> None:
    payload = {**_maintenance, "bypass_hash": _bypass["hash"]}
    try:
        STATE_FILE.write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        pass
    try:
        from ..database import get_supabase

        get_supabase().table("app_state").upsert({"key": "maintenance", "value": payload}).execute()
    except Exception:
        logging.getLogger(__name__).warning("Could not persist maintenance state to database", exc_info=True)


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
        _persist()
    return get_maintenance()


# --- developer bypass password (stored only as a salted PBKDF2 hash) -------
_PBKDF2_ROUNDS = 240_000


def has_bypass_password() -> bool:
    return bool(_bypass["hash"])


def set_bypass_password(password: str) -> None:
    """Sets (or, with an empty string, removes) the developer bypass password."""
    with _lock:
        if not password:
            _bypass["hash"] = ""
        else:
            salt = secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ROUNDS)
            _bypass["hash"] = f"{salt.hex()}${digest.hex()}"
        _persist()


def verify_bypass_password(password: str) -> bool:
    stored = _bypass["hash"]
    if not stored or not password:
        return False
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), _PBKDF2_ROUNDS)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def bypass_fingerprint() -> str:
    """Changes whenever the bypass password changes, which invalidates every issued bypass cookie."""
    return hashlib.sha256(_bypass["hash"].encode("utf-8")).hexdigest()[:24]


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
