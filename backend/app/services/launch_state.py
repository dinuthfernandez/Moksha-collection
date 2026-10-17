"""In-memory launch trigger shared between the /launchbutton buzzer and the /launch screen."""
import threading
import time

COUNTDOWN_SECONDS = 10
# A trigger older than this is stale (e.g. someone opens /launch hours later).
STALE_AFTER_SECONDS = COUNTDOWN_SECONDS + 8

_lock = threading.Lock()
_triggered_at: float | None = None


def trigger() -> float:
    global _triggered_at
    with _lock:
        now = time.time()
        # Ignore double-presses while a countdown is already running.
        if _triggered_at is None or now - _triggered_at > STALE_AFTER_SECONDS:
            _triggered_at = now
        return _triggered_at


def reset() -> None:
    global _triggered_at
    with _lock:
        _triggered_at = None


def status() -> dict:
    with _lock:
        now = time.time()
        active = _triggered_at is not None and now - _triggered_at <= STALE_AFTER_SECONDS
        return {
            "triggered_at": _triggered_at if active else None,
            "server_time": now,
            "countdown_seconds": COUNTDOWN_SECONDS,
        }
