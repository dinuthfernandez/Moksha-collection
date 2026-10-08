import threading

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions
import httpx

from .config import get_settings

_client: Client | None = None
_client_lock = threading.Lock()


class _RetryTransport(httpx.BaseTransport):
    """Retries once when a pooled connection was silently closed by Supabase."""

    def __init__(self, inner: httpx.BaseTransport):
        self._inner = inner

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return self._inner.handle_request(request)
        except (httpx.TransportError,):
            return self._inner.handle_request(request)

    def close(self) -> None:
        self._inner.close()


def _build_client() -> Client:
    settings = get_settings()
    options = ClientOptions(schema=settings.supabase_schema)
    client = create_client(settings.supabase_url, settings.supabase_service_role_key, options=options)
    session = client.postgrest.session
    # HTTP/1.1 with a short keep-alive and short timeout so a dead pooled
    # connection fails fast and is retried instead of hanging for ~2 minutes.
    session._transport = _RetryTransport(
        httpx.HTTPTransport(
            http2=False,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=2.0),
        )
    )
    session.timeout = httpx.Timeout(10.0, connect=5.0)
    return client


def get_supabase() -> Client:
    """Server-side Supabase client scoped to the moksha_collection schema.

    Uses the service-role key — this must only ever run on the backend,
    never be exposed to the frontend/browser.

    The client (and its keep-alive HTTP connection) is shared across requests,
    which avoids a new TLS handshake per query. If Supabase closed an idle
    connection, the transport transparently retries on a fresh one.
    """
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = _build_client()
    return _client



def execute_with_retry(build_query, retries: int = 2):
    """Runs a Supabase query, retrying once on a transient connection drop.

    `build_query` is a zero-arg callable that builds and returns a fresh query
    each time (so a retry doesn't reuse a query object already tied to a dead
    connection) — e.g. `lambda: supabase.table("x").select("*").execute()`.
    """
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            return build_query()
        except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.ReadError) as exc:
            last_error = exc
    raise last_error
