"""Schemas para productos y lotes."""

from pydantic import BaseModel, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime, date


# ── PRODUCTOS ────────────────────────────────────────────────

class ProductoCreate(BaseModel):
    sku: str
    nombre: str
    descripcion: Optional[str] = None
    categoria_id: Optional[UUID] = None
    proveedor_default_id: Optional[UUID] = None
    posicion_default_id: Optional[UUID] = None
    unidad_medida: str = "unidad"
    precio_venta: Optional[float] = None
    costo_promedio: float = 0.0
    stock_minimo: float = 0.0

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_id: Optional[UUID] = None
    proveedor_default_id: Optional[UUID] = None
    posicion_default_id: Optional[UUID] = None
    unidad_medida: Optional[str] = None
    precio_venta: Optional[float] = None
    stock_minimo: Optional[float] = None
    activo: Optional[bool] = None
    # Nota: costo_promedio NO se actualiza directamente; lo maneja el trigger CPP.

class ProductoOut(BaseModel):
    id: UUID
    empresa_id: UUID
    sku: str
    nombre: str
    descripcion: Optional[str]
    categoria_id: Optional[UUID]
    proveedor_default_id: Optional[UUID]
    posicion_default_id: Optional[UUID]
    unidad_medida: str
    precio_venta: Optional[float]
    costo_promedio: float
    stock_minimo: float
    activo: bool
    created_at: datetime
    updated_at: datetime

class ProductoConStock(ProductoOut):
    """Producto con stock calculado (desde v_tabla_principal)."""
    categoria: Optional[str] = None
    stock_actual: float = 0.0
    consumo_promedio_diario: float = 0.0
    dias_inventario: Optional[float] = None
    estado: Optional[str] = None
    cantidad_reponer: float = 0.0
    valor_inventario: float = 0.0


# ── LOTES ────────────────────────────────────────────────────

class LoteCreate(BaseModel):
    producto_id: UUID
    proveedor_id: Optional[UUID] = None
    numero_lote: Optional[str] = None
    costo_unitario: float
    cantidad_inicial: float
    fecha_ingreso: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    observaciones: Optional[str] = None

    @field_validator("costo_unitario", "cantidad_inicial")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Debe ser mayor o igual a 0")
        return v

class LoteOut(BaseModel):
    id: UUID
    empresa_id: UUID
    producto_id: UUID
    proveedor_id: Optional[UUID]
    numero_lote: Optional[str]
    costo_unitario: float
    cantidad_inicial: float
    cantidad_disponible: float
    fecha_ingreso: date
    fecha_vencimiento: Optional[date]
    observaciones: Optional[str]
    created_at: datetime
