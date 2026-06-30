"""
Endpoints del dashboard.
Todas las vistas usan empresa_id del JWT → RLS garantiza aislamiento.
"""

from fastapi import APIRouter, Depends
from auth.dependencies import CurrentUser, get_current_user
from database.client import get_user_client

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/resumen", summary="Resumen principal del dashboard")
async def resumen(user: CurrentUser = Depends(get_current_user)):
    """
    Métricas clave para las tarjetas del dashboard:
    - Total productos activos
    - Productos a reponer
    - Valor total del inventario
    - Órdenes pendientes (borrador)
    """
    db = get_user_client(user.token)

    # Stock y estados
    stock_res = (
        db.table("v_tabla_principal")
        .select("estado, stock_actual, valor_inventario")
        .eq("empresa_id", user.empresa_id)
        .execute()
    ).data

    total_productos = len(stock_res)
    a_reponer = sum(1 for r in stock_res if r.get("estado") == "Reponer")
    valor_total = sum((r.get("valor_inventario") or 0) for r in stock_res)

    # Órdenes en borrador
    ordenes_borrador = (
        db.table("ordenes_movimiento")
        .select("id", count="exact")
        .eq("empresa_id", user.empresa_id)
        .eq("estado", "borrador")
        .execute()
    ).count or 0

    return {
        "total_productos": total_productos,
        "productos_a_reponer": a_reponer,
        "valor_inventario_total": round(valor_total, 2),
        "ordenes_pendientes": ordenes_borrador,
    }


@router.get("/stock-categorias", summary="Stock por categoría (gráfico 1)")
async def stock_por_categoria(user: CurrentUser = Depends(get_current_user)):
    """
    Fuente: v_dashboard_stock_categoria
    Formato listo para gráfico de barras/torta en el frontend.
    """
    db = get_user_client(user.token)
    return (
        db.table("v_dashboard_stock_categoria")
        .select("categoria, total_productos, stock_total, valor_total")
        .eq("empresa_id", user.empresa_id)
        .order("stock_total", desc=True)
        .execute()
    ).data


@router.get("/salidas-mensuales", summary="Salidas mensuales (gráfico 2)")
async def salidas_mensuales(user: CurrentUser = Depends(get_current_user)):
    """
    Fuente: v_salidas_mensuales (últimos 12 meses)
    Formato listo para gráfico de línea/barras.
    """
    db = get_user_client(user.token)
    return (
        db.table("v_salidas_mensuales")
        .select("mes, total_ordenes, cantidad_total, costo_total")
        .eq("empresa_id", user.empresa_id)
        .execute()
    ).data


@router.get("/tabla-principal", summary="Tabla principal con reglas de negocio")
async def tabla_principal(
    user: CurrentUser = Depends(get_current_user),
):
    """
    Devuelve la vista completa v_tabla_principal:
    SKU, nombre, stock_actual, consumo_promedio_diario,
    dias_inventario, estado (Óptimo/Reponer/Sin consumo), cantidad_reponer.
    """
    db = get_user_client(user.token)
    return (
        db.table("v_tabla_principal")
        .select(
            "producto_id, sku, nombre, categoria, unidad_medida, "
            "costo_promedio, precio_venta, stock_actual, "
            "consumo_promedio_diario, dias_inventario, estado, cantidad_reponer, valor_inventario"
        )
        .eq("empresa_id", user.empresa_id)
        .order("nombre")
        .execute()
    ).data


@router.get("/alertas", summary="Productos que requieren reposición")
async def alertas_reposicion(user: CurrentUser = Depends(get_current_user)):
    """Lista rápida de productos con estado 'Reponer' para notificaciones."""
    db = get_user_client(user.token)
    return (
        db.table("v_tabla_principal")
        .select("producto_id, sku, nombre, stock_actual, dias_inventario, cantidad_reponer")
        .eq("empresa_id", user.empresa_id)
        .eq("estado", "Reponer")
        .order("dias_inventario")
        .execute()
    ).data


@router.get("/stock-posiciones", summary="Stock por posición física (Zona-Rack-Nivel)")
async def stock_posiciones(user: CurrentUser = Depends(get_current_user)):
    """
    Fuente: v_stock_por_posicion
    Muestra dónde está cada producto dentro del centro de distribución.
    """
    db = get_user_client(user.token)
    return (
        db.table("v_stock_por_posicion")
        .select(
            "producto_id, sku, producto_nombre, "
            "ubicacion_nombre, posicion_codigo, zona, rack, nivel, stock_posicion"
        )
        .eq("empresa_id", user.empresa_id)
        .order("posicion_codigo")
        .execute()
    ).data
