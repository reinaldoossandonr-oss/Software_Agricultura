'use client'

import { useEffect, useState } from 'react'
import { ubicacionesApi, posicionesApi } from '@/lib/api'

interface Ubicacion {
  id: string
  nombre: string
  tipo?: string
  descripcion?: string
  activo: boolean
}

interface Posicion {
  id: string
  codigo: string
  zona: string
  rack: string
  nivel: string
  capacidad?: number
  activo: boolean
}

export default function UbicacionesPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [seleccionada, setSeleccionada] = useState<Ubicacion | null>(null)
  const [posiciones, setPosiciones] = useState<Posicion[]>([])
  const [loadingUbic, setLoadingUbic] = useState(true)
  const [loadingPos, setLoadingPos] = useState(false)
  const [formUbic, setFormUbic] = useState({ nombre: '', tipo: 'almacen', descripcion: '' })
  const [guardandoUbic, setGuardandoUbic] = useState(false)
  const [errorUbic, setErrorUbic] = useState<string | null>(null)
  const [mostrarFormUbic, setMostrarFormUbic] = useState(false)

  async function cargarUbicaciones() {
    try {
      const data = await ubicacionesApi.listar()
      setUbicaciones(data)
    } finally {
      setLoadingUbic(false)
    }
  }

  async function cargarPosiciones(ubicId: string) {
    setLoadingPos(true)
    try {
      const data = await ubicacionesApi.posiciones(ubicId)
      setPosiciones(data)
    } finally {
      setLoadingPos(false)
    }
  }

  useEffect(() => { cargarUbicaciones() }, [])

  function seleccionar(u: Ubicacion) {
    setSeleccionada(u)
    cargarPosiciones(u.id)
  }

  async function handleCrearUbicacion(e: React.FormEvent) {
    e.preventDefault()
    if (!formUbic.nombre.trim()) return
    setGuardandoUbic(true)
    setErrorUbic(null)
    try {
      await ubicacionesApi.crear({
        nombre: formUbic.nombre.trim(),
        tipo: formUbic.tipo,
        descripcion: formUbic.descripcion.trim() || null,
      })
      setFormUbic({ nombre: '', tipo: 'almacen', descripcion: '' })
      setMostrarFormUbic(false)
      cargarUbicaciones()
    } catch (e: any) {
      setErrorUbic(e.message)
    } finally {
      setGuardandoUbic(false)
    }
  }

  const TIPOS = ['almacen', 'bodega', 'planta', 'tienda', 'externo']

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ubicaciones</h1>
          <p className="text-slate-400 text-sm">Bodegas, almacenes y sus posiciones (Zona-Rack-Nivel)</p>
        </div>
        <button
          onClick={() => setMostrarFormUbic(v => !v)}
          className="btn-primary flex items-center gap-2"
        >
          <span className="text-lg font-light leading-none">+</span>
          Nueva ubicación
        </button>
      </div>

      {/* Form nueva ubicación */}
      {mostrarFormUbic && (
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Nueva ubicación</h2>
          <form onSubmit={handleCrearUbicacion} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre *</label>
                <input
                  className="input w-full"
                  placeholder="Ej: Bodega Central"
                  value={formUbic.nombre}
                  onChange={e => setFormUbic(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                <select
                  className="input w-full"
                  value={formUbic.tipo}
                  onChange={e => setFormUbic(f => ({ ...f, tipo: e.target.value }))}
                >
                  {TIPOS.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Descripción</label>
                <input
                  className="input w-full"
                  placeholder="Opcional"
                  value={formUbic.descripcion}
                  onChange={e => setFormUbic(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
            </div>
            {errorUbic && <p className="text-red-500 text-sm">{errorUbic}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setMostrarFormUbic(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button type="submit" disabled={guardandoUbic} className="btn-primary px-5">
                {guardandoUbic ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lista de ubicaciones */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-slate-700 mb-3">Ubicaciones</h2>
          {loadingUbic ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded" />)}
            </div>
          ) : ubicaciones.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Sin ubicaciones</p>
          ) : (
            <ul className="space-y-1">
              {ubicaciones.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => seleccionar(u)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      seleccionada?.id === u.id
                        ? 'bg-primary text-white'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-medium">{u.nombre}</span>
                    {u.tipo && (
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        seleccionada?.id === u.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.tipo}
                      </span>
                    )}
                    {u.descripcion && (
                      <p className={`text-xs mt-0.5 ${seleccionada?.id === u.id ? 'text-white/70' : 'text-slate-400'}`}>
                        {u.descripcion}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Posiciones de la ubicación seleccionada */}
        <div className="card lg:col-span-2">
          {!seleccionada ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Selecciona una ubicación para ver sus posiciones
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-700">
                  Posiciones — {seleccionada.nombre}
                </h2>
                <span className="text-xs text-slate-400">{posiciones.length} posiciones</span>
              </div>
              {loadingPos ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-slate-100 rounded" />)}
                </div>
              ) : posiciones.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-3xl mb-2">📦</p>
                  <p className="text-sm">Esta ubicación no tiene posiciones registradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-100">
                        <th className="table-th">Código</th>
                        <th className="table-th">Zona</th>
                        <th className="table-th">Rack</th>
                        <th className="table-th">Nivel</th>
                        <th className="table-th text-right">Capacidad</th>
                        <th className="table-th">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {posiciones.map(pos => (
                        <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                          <td className="table-td font-mono text-xs font-semibold text-slate-700">
                            {pos.codigo}
                          </td>
                          <td className="table-td text-slate-500">{pos.zona}</td>
                          <td className="table-td text-slate-500">{pos.rack}</td>
                          <td className="table-td text-slate-500">{pos.nivel}</td>
                          <td className="table-td text-right text-slate-500">
                            {pos.capacidad ?? '∞'}
                          </td>
                          <td className="table-td">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              pos.activo
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {pos.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
