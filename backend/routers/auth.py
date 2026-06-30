"""Endpoints de autenticación — solo /auth/me."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from uuid import UUID

from auth.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: str
    empresa_id: str
    rol: str
    nombre: str
    email: str


@router.get("/me", response_model=MeResponse, summary="Perfil del usuario autenticado")
async def me(user: CurrentUser = Depends(get_current_user)):
    """
    Devuelve el perfil del usuario autenticado.
    El login real ocurre en Supabase Auth (desde el frontend).
    Este endpoint confirma que el token es válido y tiene perfil activo.
    """
    return MeResponse(
        user_id=user.user_id,
        empresa_id=user.empresa_id,
        rol=user.rol,
        nombre=user.nombre,
        email=user.email,
    )
