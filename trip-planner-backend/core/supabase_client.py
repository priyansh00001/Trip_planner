"""
Supabase client singleton and database utilities.
"""
from supabase import create_client, AsyncClient
from core.config import settings


def get_supabase_client() -> AsyncClient:
    """Create and return Supabase async client singleton."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Singleton instance - initialized once and reused
db: AsyncClient = get_supabase_client()


def get_db() -> AsyncClient:
    """
    Dependency injection function for FastAPI routes.
    Returns the shared Supabase client instance.
    """
    return db