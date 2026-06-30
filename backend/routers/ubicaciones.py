"""
Endpoints para ubicaciones y posiciones.
Posiciones son hijas de ubicaciones (Zona-Rack-Nivel).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from uuid import UUID

from auth.dependencies import CurrentUser, get_current_user, require_rol
from database.client import get_user_client
from schemas.catalogs import (
    UbicacionCreate, UbicacionUpdate, UbicacionOut,
    PosicionCreate, PosicionUpdate, PosicionOut,
)

router = APIRouter(tags=["ubicaciones"])


# ══════════════════════════════════════════════════════════════
# UBICACIONES
# ══════════════════════════════════════════════════════════════

@router.get("/ubicaciones", response_model=list[UbicacionOut], summary="Listar ubicaciones")
async def listar_ubicaciones(
    activo: bool = True,
    tipo: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    q = db.table("ubicaciones").select("*").eq("activo", activo)
    if tipo:
        q = q.eq("tipo", tipo)
    return q.order("nombre").execute().data


@router.post("/ubicaciones", response_model=UbicacionOut, status_code=201, summary="Crear ubicación")
async def crear_ubicacion(
    body: UbicacionCreate,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    data = {**body.model_dump(), "empresa_id": user.empresa_id}
    res = db.table("ubicaciones").insert(data).execute()
    return res.data[0]


@router.get("/ubicaciones/{id}", response_model=UbicacionOut, summary="Detalle ubicación")
async def obtener_ubicacion(id: UUID, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("ubicaciones").select("*").eq("id", str(id)).single().execute()
    if not res.data:
        raise HTTPException(404, "Ubicación no encontrada")
    return res.data


@router.put("/ubicaciones/{id}", response_model=UbicacionOut, summary="Actualizar ubicación")
async def actualizar_ubicacion(
    id: UUID,
    body: UbicacionUpdate,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    res = (
        db.table("ubicaciones")
        .update(body.model_dump(exclude_none=True))
        .eq("id", str(id))
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Ubicación no encontrada")
    return res.data[0]


# ══════════════════════════════════════════════════════════════
# POSICIONES  (Zona-Rack-Nivel dentro de una ubicación)
# ══════════════════════════════════════════════════════════════

@router.get(
    "/ubicaciones/{ubicacion_id}/posiciones",
    response_model=list[PosicionOut],
    summary="Listar posiciones de una ubicación",
)
async def listar_posiciones(
    ubicacion_id: UUID,
    activo: bool = True,
    zona: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    q = (
        db.table("posiciones")
        .select("*")
        .eq("ubicacion_id", str(ubicacion_id))
        .eq("activo", activo)
    )
    if zona:
        q = q.eq("zona", zona)
    return q.order("codigo").execute().data


@router.post(
    "/posiciones",
    response_model=PosicionOut,
    status_code=201,
    summary="Crear posición (Zona-Rack-Nivel)",
)
async def crear_posicion(
    body: PosicionCreate,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    data = {
        **body.model_dump(),
        "empresa_id": user.empresa_id,
        "ubicacion_id": str(body.ubicacion_id),
    }
    try:
        res = db.table("posiciones").insert(data).execute()
        return res.data[0]
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(409, f"La posición {body.zona}-{body.rack}-{body.nivel} ya existe en esta ubicación")
        raise HTTPException(400, str(e))


@router.get("/posiciones/{id}", response_model=PosicionOut, summary="Detalle de posición")
async def obtener_posicion(id: UUID, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("posiciones").select("*").eq("id", str(id)).single().execute()
    if not res.data:
        raise HTTPException(404, "Posición no encontrada")
    return res.data


@router.put("/posiciones/{id}", response_model=PosicionOut, summary="Actualizar posición")
async def actualizar_posicion(
    id: UUID,
    body: PosicionUpdate,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    res = (
        db.table("posiciones")
        .update(body.model_dump(exclude_none=True))
        .eq("id", str(id))
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Posición no encontrada")
    return res.data[0]


@router.get(
    "/posiciones",
    response_model=list[PosicionOut],
    summary="Buscar posiciones (todas las ubicaciones)",
)
async def buscar_posiciones(
    q: Optional[str] = Query(None, description="Filtrar por código (ej: A-1)"),
    ubicacion_id: Optional[UUID] = None,
    activo: bool = True,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Útil para el autocompletado de posición origen/destino al crear una orden.
    """
    db = get_user_client(user.token)
    query = db.table("posiciones").select("*").eq("activo", activo)
    if ubicacion_id:
        query = query.eq("ubicacion_id", str(ubicacion_id))
    if q:
        query = query.ilike("codigo", f"{q}%")
    return query.order("codigo").limit(50).execute().data
