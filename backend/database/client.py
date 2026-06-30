"""
Fábrica de clientes Supabase.

Se crean dos tipos:
  - user_client(token): usa el JWT del usuario → RLS activo → operaciones normales.
  - admin_client():     usa service_role       → RLS desactivado → solo para
                        operaciones administrativas del sistema (no exponer al frontend).
"""

from supabase import create_client, Client
from config.settings import settings


def get_user_client(token: str) -> Client:
    """
    Devuelve un cliente Supabase autenticado como el usuario.
    Todas las queries respetan las políticas RLS.
    empresa_id es inferida por la BD a través de auth.uid().
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(token)
    return client


def get_admin_client() -> Client:
    """
    Cliente con service_role. SOLO para tareas del sistema.
    NUNCA expongas este cliente a endpoints públicos.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
