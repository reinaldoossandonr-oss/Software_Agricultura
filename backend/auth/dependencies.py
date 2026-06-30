"""
Dependencias de autenticación para FastAPI.

Flujo:
  1. El frontend envía: Authorization: Bearer <supabase_jwt>
  2. Decodificamos el JWT localmente (sin llamada a la API → rápido).
  3. Buscamos el perfil del usuario en perfiles_usuarios para obtener
     empresa_id y rol (usando el cliente admin, ya que el token aún
     no tiene empresa_id en el claim).
  4. Inyectamos CurrentUser en cada endpoint que lo necesite.

CRÍTICO: empresa_id NUNCA viene del body/query — siempre del perfil en BD.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel

from config.settings import settings
from database.client import get_user_client, get_admin_client


bearer_scheme = HTTPBearer()


class CurrentUser(BaseModel):
    user_id: str
    empresa_id: str
    rol: str
    nombre: str
    email: str
    token: str          # JWT original, para construir el user_client


def _decode_token(token: str) -> dict:
    """Decodifica y valida el JWT de Supabase localmente."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    token = credentials.credentials
    payload = _decode_token(token)
    user_id: str = payload.get("sub")

    if not user_id:
        raise HTTPException(status_code=401, detail="Token sin subject (sub)")

    # Obtener empresa_id y rol desde la BD
    # Usamos admin_client para saltear RLS en esta consulta inicial
    admin = get_admin_client()
    result = (
        admin.table("perfiles_usuarios")
        .select("empresa_id, rol, nombre, email")
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

    Uso:
        @router.delete("/{id}", dependencies=[Depends(require_rol("admin"))])
    """
    async def _check(user: CurrentUser = Depends(get_current_user)):
        if user.rol not in (*roles, "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol: {', '.join(roles)}",
            )
        return user
    return _check
