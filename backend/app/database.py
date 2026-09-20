from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions
import httpx

from .config import get_settings


def get_supabase() -> Client:
    """Server-side Supabase client scoped to the moksha_collection schema.

    Uses the service-role key — this must only ever run on the backend,
    never be exposed to the frontend/browser.

    A fresh client is created on every call (cheap — just wires up an httpx
    client) instead of being cached for the process lifetime. A long-lived
    cached client's underlying HTTP/2 connection can be silently closed by
    Supabase after being idle, which previously surfaced as an intermittent
    `httpx.RemoteProtocolError: Server disconnected` on requests like register.
    """
    settings = get_settings()
    options = ClientOptions(schema=settings.supabase_schema)
    return create_client(settings.supabase_url, settings.supabase_service_role_key, options=options)


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
