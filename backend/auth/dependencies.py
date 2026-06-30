"""
Dependencias de autenticación para FastAPI.

Flujo:
  1. El frontend envía: Authorization: Bearer <supabase_jwt>
  2. Verificamos el token llamando a Supabase auth.get_user(token)
     → Supabase valida la firma, expiración y formato del JWT.
  3. Buscamos el perfil en perfiles_usuarios para obtener empresa_id y rol.
  4. Inyectamos CurrentUser en cada endpoint que lo necesite.

CRÍTICO: empresa_id NUNCA viene del body/query — siempre del perfil en BD.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from database.client import get_admin_client


bearer_scheme = HTTPBearer()


class CurrentUser(BaseModel):
    user_id: str        # auth.users.id (UUID de Supabase Auth)
    perfil_id: str      # perfiles_usuarios.id (PK del perfil — usar en FKs)
    empresa_id: str
    rol: str
    nombre: str
    email: str
    token: str          # JWT original, para construir el user_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    token = credentials.credentials
    admin = get_admin_client()

    # Verificar el token via Supabase (delega firma + expiración a Supabase)
    try:
        auth_response = admin.auth.get_user(token)
        supabase_user = auth_response.user
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Token inválido")
        user_id = supabase_user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Obtener empresa_id, rol e id del perfil desde perfiles_usuarios
    result = (
        admin.table("perfiles_usuarios")
        .select("id, empresa_id, rol, nombre, email")
        .eq("user_id", user_id)
        .eq("activo", True)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario sin perfil activo en el sistema",
        )

    perfil = result.data
    return CurrentUser(
        user_id=user_id,
        perfil_id=perfil["id"],      # PK de perfiles_usuarios — para FKs
        empresa_id=perfil["empresa_id"],
        rol=perfil["rol"],
        nombre=perfil["nombre"],
        email=perfil["email"],
        token=token,
    )


def require_rol(*roles: str):
    """
    Dependencia que verifica que el usuario tenga uno de los roles indicados.
    'admin' siempre pasa (tiene todos los permisos).
    """
    async def _check(user: CurrentUser = Depends(get_current_user)):
        if user.rol not in (*roles, "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol: {', '.join(roles)}",
            )
        return user
    return _check
