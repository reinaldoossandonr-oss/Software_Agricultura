"""
CRUD para catálogos: categorías y proveedores.
Ubicaciones y posiciones tienen su propio router por su complejidad.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from auth.dependencies import CurrentUser, get_current_user, require_rol
from database.client import get_user_client
from schemas.catalogs import (
    CategoriaCreate, CategoriaUpdate, CategoriaOut,
    ProveedorCreate, ProveedorUpdate, ProveedorOut,
)

router = APIRouter(tags=["catálogos"])


# ══════════════════════════════════════════════════════════════
# CATEGORÍAS
# ══════════════════════════════════════════════════════════════

@router.get("/categorias", response_model=list[CategoriaOut], summary="Listar categorías")
async def listar_categorias(
    activo: bool = True,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    q = db.table("categorias").select("*").eq("activo", activo).order("nombre")
    return q.execute().data


@router.post("/categorias", response_model=CategoriaOut, status_code=201, summary="Crear categoría")
async def crear_categoria(
    body: CategoriaCreate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    data = {**body.model_dump(), "empresa_id": user.empresa_id}
    res = db.table("categorias").insert(data).execute()
    return res.data[0]


@router.put("/categorias/{id}", response_model=CategoriaOut, summary="Actualizar categoría")
async def actualizar_categoria(
    id: UUID,
    body: CategoriaUpdate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    res = (
        db.table("categorias")
        .update(body.model_dump(exclude_none=True))
        .eq("id", str(id))
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Categoría no encontrada")
    return res.data[0]


@router.delete("/categorias/{id}", status_code=204, summary="Eliminar categoría (soft)")
async def eliminar_categoria(
    id: UUID,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    db.table("categorias").update({"activo": False}).eq("id", str(id)).execute()


# ══════════════════════════════════════════════════════════════
# PROVEEDORES
# ══════════════════════════════════════════════════════════════

@router.get("/proveedores", response_model=list[ProveedorOut], summary="Listar proveedores")
async def listar_proveedores(
    activo: bool = True,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    return db.table("proveedores").select("*").eq("activo", activo).order("nombre").execute().data


@router.post("/proveedores", response_model=ProveedorOut, status_code=201, summary="Crear proveedor")
async def crear_proveedor(
    body: ProveedorCreate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    data = {**body.model_dump(), "empresa_id": user.empresa_id}
    res = db.table("proveedores").insert(data).execute()
    return res.data[0]


@router.get("/proveedores/{id}", response_model=ProveedorOut, summary="Detalle proveedor")
async def obtener_proveedor(id: UUID, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = db.table("proveedores").select("*").eq("id", str(id)).single().execute()
    if not res.data:
        raise HTTPException(404, "Proveedor no encontrado")
    return res.data


@router.put("/proveedores/{id}", response_model=ProveedorOut, summary="Actualizar proveedor")
async def actualizar_proveedor(
    id: UUID,
    body: ProveedorUpdate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    res = (
        db.table("proveedores")
        .update(body.model_dump(exclude_none=True))
        .eq("id", str(id))
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Proveedor no encontrado")
    return res.data[0]


@router.delete("/proveedores/{id}", status_code=204, summary="Eliminar proveedor (soft)")
async def eliminar_proveedor(
    id: UUID,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    db.table("proveedores").update({"activo": False}).eq("id", str(id)).execute()
