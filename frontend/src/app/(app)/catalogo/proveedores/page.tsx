'use client'

import { useEffect, useState } from 'react'
import { proveedoresApi } from '@/lib/api'

interface Proveedor {
  id: string
  nombre: string
  rut?: string
  email?: string
  telefono?: string
  contacto?: string
  activo: boolean
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [form, setForm] = useState({ nombre: '', rut: '', email: '', telefono: '', contacto: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    try {
      const data = await proveedoresApi.listar()
      setProveedores(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', rut: '', email: '', telefono: '', contacto: '' })
    setError(null)
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setForm({
      nombre: p.nombre ?? '',
      rut: p.rut ?? '',
      email: p.email ?? '',
      telefono: p.telefono ?? '',
      contacto: p.contacto ?? '',
    })
    setError(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rut: form.rut.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        contacto: form.contacto.trim() || null,
      }
      if (editando) {
        await proveedoresApi.actualizar(editando.id, payload)
      } else {
        await proveedoresApi.crear(payload)
      }
      setEditando(null)
      setForm({ nombre: '', rut: '', email: '', telefono: '', contacto: '' })
      cargar()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const mostrar = editando !== null || form.nombre !== ''

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-slate-400 text-sm">Gestiona tus proveedores de mercancía</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2">
          <span className="text-lg font-light leading-none">+</span>
          Nuevo proveedor
        </button>
      </div>

      {/* Formulario */}
      {(editando !== null || mostrar) && (
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">
            {editando ? `Editar: ${editando.nombre}` : 'Nuevo proveedor'}
          </h2>
          <form onSubmit={handleGuardar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre *</label>
                <input
                  className="input w-full"
                  placeholder="Ej: Distribuidora Central"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">RUT</label>
                <input
                  className="input w-full"
                  placeholder="Ej: 76.123.456-7"
                  value={form.rut}
                  onChange={e => setForm(f => ({ ...f, rut: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="ventas@proveedor.cl"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
                <input
                  className="input w-full"
                  placeholder="+56 9 1234 5678"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Persona de contacto</label>
                <input
                  className="input w-full"
                  placeholder="Nombre del ejecutivo de cuenta"
                  value={form.contacto}
                  onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => { setEditando(null); setForm({ nombre: '', rut: '', email: '', telefono: '', contacto: '' }) }}
                className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="btn-primary px-5">
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proveedor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="card">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : proveedores.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-3">🚚</p>
            <p className="font-medium">Sin proveedores todavía</p>
            <p className="text-sm">Agrega tu primer proveedor usando el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="table-th">Nombre</th>
                  <th className="table-th">RUT</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Teléfono</th>
                  <th className="table-th">Contacto</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proveedores.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td font-medium">{p.nombre}</td>
                    <td className="table-td text-slate-500 font-mono text-xs">{p.rut ?? '—'}</td>
                    <td className="table-td text-slate-500">{p.email ?? '—'}</td>
                    <td className="table-td text-slate-500">{p.telefono ?? '—'}</td>
                    <td className="table-td text-slate-500">{p.contacto ?? '—'}</td>
                    <td className="table-td text-right">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="text-xs text-primary hover:underline"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
