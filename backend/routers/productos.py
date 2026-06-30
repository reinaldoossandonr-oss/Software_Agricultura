"""
CRUD de productos + lotes.
La búsqueda por SKU/nombre es el endpoint crítico para el autocompletado
en la pantalla de órdenes masivas.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from uuid import UUID

from auth.dependencies import CurrentUser, get_current_user, require_rol
from database.client import get_user_client
from schemas.productos import (
    ProductoCreate, ProductoUpdate, ProductoOut, ProductoConStock,
    LoteCreate, LoteOut,
)

router = APIRouter(prefix="/productos", tags=["productos"])


@router.get(
    "",
    response_model=list[ProductoConStock],
    summary="Listar productos con stock y estado",
)
async def listar_productos(
    q: Optional[str] = Query(None, description="Buscar por SKU o nombre"),
    categoria_id: Optional[UUID] = None,
    estado: Optional[str] = Query(None, description="Óptimo | Reponer | Sin consumo"),
    activo: bool = True,
    page: int = 1,
    limit: int = 50,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Devuelve la vista v_tabla_principal que incluye:
    stock_actual, consumo_promedio_diario, dias_inventario, estado, cantidad_reponer.
    """
    db = get_user_client(user.token)
    offset = (page - 1) * limit

    query = (
        db.table("v_tabla_principal")
        .select("*")
        .eq("empresa_id", user.empresa_id)
    )
    if q:
        # Búsqueda por SKU (exacto primero) o nombre (contains)
        query = query.or_(f"sku.ilike.{q}%,nombre.ilike.%{q}%")
    if categoria_id:
        query = query.eq("categoria_id", str(categoria_id))
    if estado:
        query = query.eq("estado", estado)

    return query.order("nombre").range(offset, offset + limit - 1).execute().data


@router.post("", response_model=ProductoOut, status_code=201, summary="Crear producto")
async def crear_producto(
    body: ProductoCreate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    data = {**body.model_dump(), "empresa_id": user.empresa_id}
    # Convertir UUIDs a string
    for key in ("categoria_id", "proveedor_default_id", "posicion_default_id"):
        if data.get(key):
            data[key] = str(data[key])
    try:
        res = db.table("productos").insert(data).execute()
        return res.data[0]
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(409, f"El SKU '{body.sku}' ya existe")
        raise HTTPException(400, str(e))


@router.get(
    "/buscar",
    response_model=list[ProductoOut],
    summary="Autocompletado de productos (para órdenes)",
)
async def buscar_productos(
    q: str = Query(..., min_length=1, description="SKU o nombre"),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Búsqueda rápida para el autocompletado en la pantalla de órdenes masivas.
    Devuelve max 20 resultados ordenados por relevancia (SKU primero).
    """
    db = get_user_client(user.token)
    res = (
        db.table("productos")
        .select("id, sku, nombre, unidad_medida, costo_promedio, precio_venta, activo")
        .eq("activo", True)
        .or_(f"sku.ilike.{q}%,nombre.ilike.%{q}%")
        .order("sku")
        .limit(20)
        .execute()
    )
    return res.data


@router.get("/{id}", response_model=ProductoConStock, summary="Detalle de producto con stock")
async def obtener_producto(id: UUID, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)
    res = (
        db.table("v_tabla_principal")
        .select("*")
        .eq("producto_id", str(id))
        .eq("empresa_id", user.empresa_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Producto no encontrado")
    return res.data


@router.put("/{id}", response_model=ProductoOut, summary="Actualizar producto")
async def actualizar_producto(
    id: UUID,
    body: ProductoUpdate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    data = body.model_dump(exclude_none=True)
    for key in ("categoria_id", "proveedor_default_id", "posicion_default_id"):
        if data.get(key):
            data[key] = str(data[key])
    res = db.table("productos").update(data).eq("id", str(id)).execute()
    if not res.data:
        raise HTTPException(404, "Producto no encontrado")
    return res.data[0]


@router.delete("/{id}", status_code=204, summary="Desactivar producto (soft delete)")
async def eliminar_producto(
    id: UUID,
    user: CurrentUser = Depends(require_rol("admin")),
):
    db = get_user_client(user.token)
    db.table("productos").update({"activo": False}).eq("id", str(id)).execute()


# ── LOTES ────────────────────────────────────────────────────

@router.get("/{producto_id}/lotes", response_model=list[LoteOut], summary="Lotes de un producto")
async def listar_lotes(
    producto_id: UUID,
    solo_disponibles: bool = True,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    q = db.table("lotes").select("*").eq("producto_id", str(producto_id))
    if solo_disponibles:
        q = q.gt("cantidad_disponible", 0)
    return q.order("fecha_ingreso").execute().data


@router.post("/{producto_id}/lotes", response_model=LoteOut, status_code=201, summary="Crear lote")
async def crear_lote(
    producto_id: UUID,
    body: LoteCreate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)
    data = {
        **body.model_dump(),
        "empresa_id": user.empresa_id,
        "producto_id": str(producto_id),
        "cantidad_disponible": body.cantidad_inicial,
    }
    if data.get("proveedor_id"):
        data["proveedor_id"] = str(data["proveedor_id"])
    if data.get("fecha_ingreso"):
        data["fecha_ingreso"] = str(data["fecha_ingreso"])
    if data.get("fecha_vencimiento"):
        data["fecha_vencimiento"] = str(data["fecha_vencimiento"])
    res = db.table("lotes").insert(data).execute()
    return res.data[0]
