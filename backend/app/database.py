from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from .config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Server-side Supabase client scoped to the moksha_collection schema.

    Uses the service-role key — this must only ever run on the backend,
    never be exposed to the frontend/browser.
    """
    settings = get_settings()
    options = ClientOptions(schema=settings.supabase_schema)
    return create_client(settings.supabase_url, settings.supabase_service_role_key, options=options)
