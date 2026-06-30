// ============================================================
// Tipos globales — Axioma Flux
// ============================================================

export interface Empresa {
  id: string
  nombre: string
  plan: 'free' | 'pro' | 'enterprise'
  activo: boolean
}

export interface PerfilUsuario {
  id: string
  user_id: string
  empresa_id: string
  rol: 'admin' | 'operador' | 'viewer'
  nombre: string
  email: string
}

export interface Categoria {
  id: string
  empresa_id: string
  nombre: string
  descripcion?: string
  activo: boolean
}

export interface Proveedor {
  id: string
  empresa_id: string
  nombre: string
  ruc_nit?: string
  contacto?: string
  email?: string
  telefono?: string
  activo: boolean
}

export interface Ubicacion {
  id: string
  empresa_id: string
  nombre: string
  codigo: string
  tipo: 'almacen' | 'centro_distribucion' | 'tienda' | 'externo'
  descripcion?: string
  activo: boolean
}

export interface Posicion {
  id: string
  empresa_id: string
  ubicacion_id: string
  zona: string
  rack: string
  nivel: string
  codigo: string          // generado: zona-rack-nivel
  descripcion?: string
  capacidad_maxima?: number
  activo: boolean
}

export interface Producto {
  id: string
  empresa_id: string
  sku: string
  nombre: string
  descripcion?: string
  categoria_id?: string
  unidad_medida: string
  precio_venta?: number
  costo_promedio: number
  stock_minimo: number
  activo: boolean
}

export interface ProductoConStock extends Producto {
  categoria?: string
  stock_actual: number
  consumo_promedio_diario: number
  dias_inventario?: number
  estado?: 'Óptimo' | 'Reponer' | 'Sin consumo'
  cantidad_reponer: number
  valor_inventario: number
}

export type TipoMovimiento = 'ingreso' | 'salida' | 'ajuste' | 'traslado'
export type EstadoOrden = 'borrador' | 'confirmado' | 'anulado'

export interface OrdenMovimiento {
  id: string
  empresa_id: string
  tipo: TipoMovimiento
  fecha: string
  referencia?: string
  observaciones?: string
  usuario_id: string
  estado: EstadoOrden
  costo_total: number
  created_at: string
}

export interface DetalleMovimiento {
  id: string
  orden_id: string
  producto_id: string
  producto_sku?: string
  producto_nombre?: string
  lote_id?: string
  posicion_origen_id?: string
  posicion_origen_codigo?: string
  posicion_destino_id?: string
  posicion_destino_codigo?: string
  cantidad: number
  costo_unitario: number
  costo_total: number
}

// Estado local de una línea en el formulario de orden
export interface LineaOrdenForm {
  uid: string              // ID temporal para React keys
  producto_id: string
  sku: string
  nombre: string
  unidad_medida: string
  cantidad: number
  costo_unitario: number
  stock_disponible: number
  posicion_origen_id?: string
  posicion_destino_id?: string
  lote_id?: string
  error?: string
}

// Dashboard
export interface DashboardResumen {
  total_productos: number
  productos_a_reponer: number
  valor_inventario_total: number
  ordenes_pendientes: number
}

export interface StockCategoria {
  categoria: string
  total_productos: number
  stock_total: number
  valor_total: number
}

export interface SalidaMensual {
  mes: string
  total_ordenes: number
  cantidad_total: number
  costo_total: number
}

export interface StockPosicion {
  producto_id: string
  sku: string
  producto_nombre: string
  ubicacion_nombre: string
  posicion_codigo: string
  zona: string
  rack: string
  nivel: string
  stock_posicion: number
}
