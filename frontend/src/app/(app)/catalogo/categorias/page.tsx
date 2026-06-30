'use client'

import { useEffect, useState } from 'react'
import { categoriasApi } from '@/lib/api'

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const data = await categoriasApi.listar()
    setCategorias(data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await categoriasApi.crear({ nombre, descripcion })
      setNombre('')
      setDescripcion('')
      cargar()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm('¿Desactivar esta categoría?')) return
    await categoriasApi.eliminar(id)
    cargar()
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-800">Categorías</h1>

      {/* Formulario */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 mb-4">Nueva categoría</h2>
        <form onSubmit={handleCrear} className="flex gap-3">
          <input className="input flex-1" placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} required />
          <input className="input flex-1" placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          <button type="submit" disabled={guardando} className="btn-primary px-5">
            {guardando ? 'Guardando...' : 'Agregar'}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-th">Nombre</th>
              <th className="table-th">Descripción</th>
              <th className="table-th w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={3} className="text-center py-8 text-slate-400">Cargando...</td></tr>
            ) : categorias.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="table-td font-medium">{c.nombre}</td>
                <td className="table-td text-slate-500">{c.descripcion ?? '—'}</td>
                <td className="table-td text-right">
                  <button
                    onClick={() => handleEliminar(c.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Desactivar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
