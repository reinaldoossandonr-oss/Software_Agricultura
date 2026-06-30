"""Schemas para órdenes de movimiento y sus líneas (detalle)."""

from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


# ── DETALLE (líneas de una orden) ────────────────────────────

class DetalleCreate(BaseModel):
    producto_id: UUID
    cantidad: float
    costo_unitario: float = 0.0     # requerido en ingresos; en salidas usa CPP vigente
    lote_id: Optional[UUID] = None
    posicion_origen_id: Optional[UUID] = None
    posicion_destino_id: Optional[UUID] = None

    @field_validator("cantidad")
    @classmethod
    def cantidad_positiva(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor que 0")
        return v

class DetalleOut(BaseModel):
    id: UUID
    empresa_id: UUID
    orden_id: UUID
    producto_id: UUID
    lote_id: Optional[UUID]
    posicion_origen_id: Optional[UUID]
    posicion_destino_id: Optional[UUID]
    cantidad: float
    costo_unitario: float
    costo_total: float
    created_at: datetime

class DetalleConProducto(DetalleOut):
    """Detalle enriquecido con info del producto (para GET /ordenes/{id})."""
    producto_sku: Optional[str] = None
    producto_nombre: Optional[str] = None
    posicion_origen_codigo: Optional[str] = None
    posicion_destino_codigo: Optional[str] = None


# ── ÓRDENES DE MOVIMIENTO ────────────────────────────────────

class OrdenCreate(BaseModel):
    tipo: str                               # ingreso | salida | ajuste | traslado
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    lineas: list[DetalleCreate]             # mínimo 1 línea

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        validos = {"ingreso", "salida", "ajuste", "traslado"}
        if v not in validos:
            raise ValueError(f"tipo debe ser uno de: {', '.join(validos)}")
        return v

    @model_validator(mode="after")
    def al_menos_una_linea(self) -> "OrdenCreate":
        if not self.lineas:
            raise ValueError("La orden debe tener al menos una línea")
        return self

class OrdenUpdate(BaseModel):
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    # Solo se puede editar una orden en estado 'borrador'

class AnularRequest(BaseModel):
    motivo: Optional[str] = None

class OrdenOut(BaseModel):
    id: UUID
    empresa_id: UUID
    tipo: str
    fecha: datetime
    referencia: Optional[str]
    observaciones: Optional[str]
    usuario_id: UUID
    estado: str
    costo_total: float
    created_at: datetime
    updated_at: datetime

class OrdenDetalle(OrdenOut):
    """Orden completa con sus líneas (para GET /ordenes/{id})."""
    lineas: list[DetalleConProducto] = []
