import threading
import time
from typing import Any, Callable

_lock = threading.Lock()
_store: dict[str, tuple[float, Any]] = {}
_version = 0


def cached(key: str, ttl_seconds: float, loader: Callable[[], Any]) -> Any:
    """Return a cached value, loading it when missing or expired."""
    now = time.monotonic()
    with _lock:
        hit = _store.get(key)
        version = _version
        if hit and hit[0] > now:
            return hit[1]
    value = loader()
    with _lock:
        if version == _version:
            _store[key] = (time.monotonic() + ttl_seconds, value)
    return value


def invalidate_catalog() -> None:
    """Drop every cached product/category response (stock or catalog changed)."""
    global _version
    with _lock:
        _version += 1
        _store.clear()
