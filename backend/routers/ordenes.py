"""
Órdenes de movimiento — router principal.

Flujo completo de una orden:
  1. POST /ordenes          → crea cabecera + líneas en estado 'borrador'
  2. GET  /ordenes/{id}     → revisar antes de confirmar
  3. POST /ordenes/{id}/confirmar → ejecuta transacción atómica en PostgreSQL:
                                     • valida stock
                                     • recalcula CPP (ingresos)
                                     • actualiza lotes
                                     • marca como 'confirmado'
  4. POST /ordenes/{id}/anular   → solo admin, revierte lotes

CRÍTICO: empresa_id se inyecta desde el JWT, nunca del body.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from uuid import UUID
from datetime import date

from auth.dependencies import CurrentUser, get_current_user, require_rol
from database.client import get_user_client, get_admin_client
from schemas.ordenes import (
    OrdenCreate, OrdenUpdate, OrdenOut, OrdenDetalle, AnularRequest, DetalleConProducto
)

router = APIRouter(prefix="/ordenes", tags=["órdenes de movimiento"])


@router.get("", response_model=list[OrdenOut], summary="Listar órdenes")
async def listar_ordenes(
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    page: int = 1,
    limit: int = 50,
    user: CurrentUser = Depends(get_current_user),
):
    db = get_user_client(user.token)
    offset = (page - 1) * limit

    q = db.table("ordenes_movimiento").select("*").eq("empresa_id", user.empresa_id)
    if tipo:
        q = q.eq("tipo", tipo)
    if estado:
        q = q.eq("estado", estado)
    if fecha_desde:
        q = q.gte("fecha", str(fecha_desde))
    if fecha_hasta:
        q = q.lte("fecha", str(fecha_hasta))

    return q.order("fecha", desc=True).range(offset, offset + limit - 1).execute().data


@router.post("", response_model=OrdenOut, status_code=201, summary="Crear orden (borrador)")
async def crear_orden(
    body: OrdenCreate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    """
    Crea la cabecera y todas las líneas en estado 'borrador'.
    Para confirmar la orden, usar POST /ordenes/{id}/confirmar.
    """
    # Usamos admin client para evitar problemas de RLS en INSERT
    admin = get_admin_client()

    # 1. Insertar cabecera
    cabecera = {
        "empresa_id": user.empresa_id,
        "tipo": body.tipo,
        "referencia": body.referencia,
        "observaciones": body.observaciones,
        "usuario_id": user.perfil_id,
        "estado": "borrador",
    }
    try:
        res_orden = admin.table("ordenes_movimiento").insert(cabecera).execute()
    except Exception as e:
        raise HTTPException(500, f"Error al crear cabecera: {str(e)}")

    if not res_orden.data:
        raise HTTPException(500, "Error al crear la orden: sin datos devueltos")

    orden = res_orden.data[0]
    orden_id = orden["id"]

    # 2. Insertar líneas
    lineas = []
    for linea in body.lineas:
        item = {
            "empresa_id": user.empresa_id,
            "orden_id": orden_id,
            "producto_id": str(linea.producto_id),
            "cantidad": linea.cantidad,
            "costo_unitario": linea.costo_unitario,
        }
        if linea.lote_id:
            item["lote_id"] = str(linea.lote_id)
        if linea.posicion_origen_id:
            item["posicion_origen_id"] = str(linea.posicion_origen_id)
        if linea.posicion_destino_id:
            item["posicion_destino_id"] = str(linea.posicion_destino_id)
        lineas.append(item)

    try:
        res_lineas = admin.table("detalle_movimientos").insert(lineas).execute()
    except Exception as e:
        admin.table("ordenes_movimiento").delete().eq("id", orden_id).execute()
        raise HTTPException(500, f"Error al insertar líneas: {str(e)}")

    if not res_lineas.data:
        admin.table("ordenes_movimiento").delete().eq("id", orden_id).execute()
        raise HTTPException(500, "Error al insertar las líneas: sin datos devueltos")

    return orden


@router.get("/{id}", response_model=OrdenDetalle, summary="Detalle completo de una orden")
async def obtener_orden(id: UUID, user: CurrentUser = Depends(get_current_user)):
    db = get_user_client(user.token)

    # Cabecera
    res = (
        db.table("ordenes_movimiento")
        .select("*")
        .eq("id", str(id))
        .eq("empresa_id", user.empresa_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Orden no encontrada")

    orden = res.data

    # Líneas con info de producto y posiciones
    lineas_res = (
        db.table("detalle_movimientos")
        .select(
            "*, "
            "productos(sku, nombre), "
            "posicion_origen:posiciones!posicion_origen_id(codigo), "
            "posicion_destino:posiciones!posicion_destino_id(codigo)"
        )
        .eq("orden_id", str(id))
        .execute()
    )

    lineas = []
    for l in lineas_res.data:
        producto_info = l.pop("productos", {}) or {}
        pos_origen    = l.pop("posicion_origen", {}) or {}
        pos_destino   = l.pop("posicion_destino", {}) or {}
        lineas.append(DetalleConProducto(
            **l,
            producto_sku=producto_info.get("sku"),
            producto_nombre=producto_info.get("nombre"),
            posicion_origen_codigo=pos_origen.get("codigo"),
            posicion_destino_codigo=pos_destino.get("codigo"),
        ))

    return OrdenDetalle(**orden, lineas=lineas)


@router.put("/{id}", response_model=OrdenOut, summary="Actualizar orden (solo en borrador)")
async def actualizar_orden(
    id: UUID,
    body: OrdenUpdate,
    user: CurrentUser = Depends(require_rol("operador")),
):
    db = get_user_client(user.token)

    # Verificar que esté en borrador
    check = (
        db.table("ordenes_movimiento")
        .select("estado")
        .eq("id", str(id))
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(404, "Orden no encontrada")
    if check.data["estado"] != "borrador":
        raise HTTPException(409, "Solo se pueden editar órdenes en estado borrador")

    res = (
        db.table("ordenes_movimiento")
        .update(body.model_dump(exclude_none=True))
        .eq("id", str(id))
        .execute()
    )
    return res.data[0]


@router.post(
    "/{id}/confirmar",
    response_model=dict,
    summary="Confirmar orden (transacción atómica)",
)
async def confirmar_orden(
    id: UUID,
    user: CurrentUser = Depends(require_rol("operador")),
):
    """
    Llama a la función PostgreSQL `confirmar_orden_movimiento()`:
    - Valida stock en salidas/traslados (con SELECT FOR UPDATE → sin race conditions)
    - Recalcula CPP en ingresos
    - Actualiza lotes
    - Todo en una sola transacción atómica
    """
    db = get_user_client(user.token)
    res = db.rpc("confirmar_orden_movimiento", {"p_orden_id": str(id)}).execute()

    if not res.data:
        raise HTTPException(500, "Error al confirmar la orden")

    resultado = res.data
    if isinstance(resultado, list):
        resultado = resultado[0]

    if not resultado.get("success"):
        raise HTTPException(422, resultado.get("error", "Error desconocido al confirmar"))

    return resultado


@router.post(
    "/{id}/anular",
    response_model=dict,
    summary="Anular orden (solo admin)",
)
async def anular_orden(
    id: UUID,
    body: AnularRequest,
    user: CurrentUser = Depends(require_rol("admin")),
):
    """
    Llama a `anular_orden_movimiento()`:
    - Revierte cantidades en lotes
    - Marca la orden como 'anulado'
    """
    db = get_user_client(user.token)
    res = db.rpc(
        "anular_orden_movimiento",
        {"p_orden_id": str(id), "p_motivo": body.motivo}
    ).execute()

    if not res.data:
        raise HTTPException(500, "Error al anular la orden")

    resultado = res.data
    if isinstance(resultado, list):
        resultado = resultado[0]

    if not resultado.get("success"):
        raise HTTPException(422, resultado.get("error", "Error desconocido al anular"))

    return resultado
