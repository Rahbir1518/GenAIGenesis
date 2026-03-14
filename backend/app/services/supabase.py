"""Supabase client singleton used by the rest of the backend."""

from supabase import create_client, Client

from app.core.config import settings

# Service-role client — bypasses RLS, use only on the server side.
_client: Client | None = None


def get_supabase() -> Client:
    """Return a cached Supabase client (service-role)."""
    global _client
    if _client is None:
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client
