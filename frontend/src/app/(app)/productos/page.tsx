'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { productosApi, categoriasApi } from '@/lib/api'
import { EstadoBadge } from '@/components/ui/Badge'

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  async function cargar(q?: string, cat?: string, est?: string) {
    setLoading(true)
    try {
      const data = await productosApi.listar({
        q: q || undefined,
        categoria_id: cat || undefined,
        estado: est || undefined,
      })
      setProductos(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    categoriasApi.listar().then(setCategorias)
  }, [])

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    cargar(busqueda, categoriaFiltro, estadoFiltro)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-slate-400 text-sm">{productos.length} productos encontrados</p>
        </div>
        <Link href="/ordenes/nueva" className="btn-primary flex items-center gap-2">
          <span className="text-lg font-light leading-none">+</span>
          Nueva orden
        </Link>
      </div>

      {/* Filtros */}
      <div className="card">
        <form onSubmit={handleBuscar} className="flex flex-wrap gap-3">
          <input
            className="input flex-1 min-w-40"
            placeholder="Buscar por SKU o nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select
            className="input w-44"
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <select
            className="input w-40"
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="Óptimo">Óptimo</option>
            <option value="Reponer">Reponer</option>
            <option value="Sin consumo">Sin consumo</option>
          </select>
          <button type="submit" className="btn-primary px-5">Buscar</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setBusqueda(''); setCategoriaFiltro(''); setEstadoFiltro(''); cargar() }}
          >
            Limpiar
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="table-th">SKU</th>
                <th className="table-th">Producto</th>
                <th className="table-th">Categoría</th>
                <th className="table-th">Unidad</th>
                <th className="table-th text-right">CPP</th>
                <th className="table-th text-right">Stock</th>
                <th className="table-th text-right">CPD</th>
                <th className="table-th text-right">Días</th>
                <th className="table-th">Estado</th>
                <th className="table-th text-right">Reponer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(10)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                productos.map((p: any) => (
                  <tr key={p.producto_id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="table-td font-medium text-slate-800">{p.nombre}</td>
                    <td className="table-td text-slate-500">{p.categoria ?? '—'}</td>
                    <td className="table-td text-slate-500">{p.unidad_medida}</td>
                    <td className="table-td text-right text-slate-700">
                      ${p.costo_promedio?.toFixed(2)}
                    </td>
                    <td className="table-td text-right font-semibold">
                      {p.stock_actual?.toFixed(1)}
                    </td>
                    <td className="table-td text-right text-slate-400 text-xs">
                      {p.consumo_promedio_diario?.toFixed(3)}
                    </td>
                    <td className="table-td text-right">
                      {p.dias_inventario != null ? (
                        <span className={p.dias_inventario < 45 ? 'text-red-500 font-semibold' : 'text-slate-700'}>
                          {p.dias_inventario.toFixed(0)}d
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="table-td text-right font-medium text-red-600">
                      {p.cantidad_reponer > 0 ? p.cantidad_reponer.toFixed(0) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
