"""Schemas para catálogos: categorías, proveedores, ubicaciones, posiciones."""

from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


# ── CATEGORÍAS ──────────────────────────────────────────────

class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

class CategoriaOut(BaseModel):
    id: UUID
    empresa_id: UUID
    nombre: str
    descripcion: Optional[str]
    activo: bool
    created_at: datetime


# ── PROVEEDORES ──────────────────────────────────────────────

class ProveedorCreate(BaseModel):
    nombre: str
    ruc_nit: Optional[str] = None
    contacto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    ruc_nit: Optional[str] = None
    contacto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    activo: Optional[bool] = None

class ProveedorOut(BaseModel):
    id: UUID
    empresa_id: UUID
    nombre: str
    ruc_nit: Optional[str]
    contacto: Optional[str]
    email: Optional[str]
    telefono: Optional[str]
    direccion: Optional[str]
    activo: bool
    created_at: datetime


# ── UBICACIONES ──────────────────────────────────────────────

class UbicacionCreate(BaseModel):
    nombre: str
    codigo: str
    tipo: str = "almacen"       # almacen | centro_distribucion | tienda | externo
    descripcion: Optional[str] = None

class UbicacionUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

class UbicacionOut(BaseModel):
    id: UUID
    empresa_id: UUID
    nombre: str
    codigo: str
    tipo: str
    descripcion: Optional[str]
    activo: bool
    created_at: datetime


# ── POSICIONES ───────────────────────────────────────────────

class PosicionCreate(BaseModel):
    ubicacion_id: UUID
    zona: str           # Ej: 'A', 'B', 'Z'
    rack: str           # Ej: '1', '2', '10'
    nivel: str          # Ej: '1', '2', '3'
    descripcion: Optional[str] = None
    capacidad_maxima: Optional[float] = None

class PosicionUpdate(BaseModel):
    descripcion: Optional[str] = None
    capacidad_maxima: Optional[float] = None
    activo: Optional[bool] = None

class PosicionOut(BaseModel):
    id: UUID
    empresa_id: UUID
    ubicacion_id: UUID
    zona: str
    rack: str
    nivel: str
    codigo: str         # generado: zona-rack-nivel
    descripcion: Optional[str]
    capacidad_maxima: Optional[float]
    activo: bool
    created_at: datetime
