/**
 * Cliente HTTP para el backend FastAPI.
 * Todas las peticiones incluyen el JWT de Supabase en Authorization.
 * empresa_id es inferida por el backend desde el JWT — nunca se envía en el body.
 */

import { getAccessToken } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  if (!token) throw new ApiError(401, 'No autenticado')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, err.detail || 'Error en el servidor')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ── DASHBOARD ────────────────────────────────────────────────
export const dashboardApi = {
  resumen:          () => apiFetch<any>('/dashboard/resumen'),
  stockCategorias:  () => apiFetch<any[]>('/dashboard/stock-categorias'),
  salidasMensuales: () => apiFetch<any[]>('/dashboard/salidas-mensuales'),
  tablaPrincipal:   () => apiFetch<any[]>('/dashboard/tabla-principal'),
  alertas:          () => apiFetch<any[]>('/dashboard/alertas'),
  stockPosiciones:  () => apiFetch<any[]>('/dashboard/stock-posiciones'),
}

// ── PRODUCTOS ────────────────────────────────────────────────
export const productosApi = {
  listar: (params?: { q?: string; categoria_id?: string; estado?: string; page?: number }) => {
    const qs = new URLSearchParams(params as any).toString()
    return apiFetch<any[]>(`/productos${qs ? `?${qs}` : ''}`)
  },
  buscar: (q: string) => apiFetch<any[]>(`/productos/buscar?q=${encodeURIComponent(q)}`),
  obtener: (id: string) => apiFetch<any>(`/productos/${id}`),
  crear: (data: any) => apiFetch<any>('/productos', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: any) =>
    apiFetch<any>(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch<void>(`/productos/${id}`, { method: 'DELETE' }),
  lotes: (productoId: string) => apiFetch<any[]>(`/productos/${productoId}/lotes`),
}

// ── ÓRDENES ──────────────────────────────────────────────────
export const ordenesApi = {
  listar: (params?: { tipo?: string; estado?: string; page?: number }) => {
    const qs = new URLSearchParams(params as any).toString()
    return apiFetch<any[]>(`/ordenes${qs ? `?${qs}` : ''}`)
  },
  obtener: (id: string) => apiFetch<any>(`/ordenes/${id}`),
  crear: (data: any) => apiFetch<any>('/ordenes', { method: 'POST', body: JSON.stringify(data) }),
  confirmar: (id: string) =>
    apiFetch<any>(`/ordenes/${id}/confirmar`, { method: 'POST' }),
  anular: (id: string, motivo?: string) =>
    apiFetch<any>(`/ordenes/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
}

// ── CATÁLOGOS ────────────────────────────────────────────────
export const categoriasApi = {
  listar: () => apiFetch<any[]>('/categorias'),
  crear: (data: any) => apiFetch<any>('/categorias', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: any) =>
    apiFetch<any>(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch<void>(`/categorias/${id}`, { method: 'DELETE' }),
}

export const proveedoresApi = {
  listar: () => apiFetch<any[]>('/proveedores'),
  crear: (data: any) => apiFetch<any>('/proveedores', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: any) =>
    apiFetch<any>(`/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const ubicacionesApi = {
  listar: () => apiFetch<any[]>('/ubicaciones'),
  crear: (data: any) => apiFetch<any>('/ubicaciones', { method: 'POST', body: JSON.stringify(data) }),
  posiciones: (ubicacionId: string) =>
    apiFetch<any[]>(`/ubicaciones/${ubicacionId}/posiciones`),
}

export const posicionesApi = {
  buscar: (q?: string, ubicacionId?: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (ubicacionId) params.set('ubicacion_id', ubicacionId)
    return apiFetch<any[]>(`/posiciones?${params.toString()}`)
  },
  crear: (data: any) =>
    apiFetch<any>('/posiciones', { method: 'POST', body: JSON.stringify(data) }),
}

export { ApiError }
