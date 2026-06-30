'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ordenesApi } from '@/lib/api'
import { EstadoBadge, TipoBadge } from '@/components/ui/Badge'

export default function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  async function cargar() {
    setLoading(true)
    try {
      const data = await ordenesApi.listar({
        tipo: tipoFiltro || undefined,
        estado: estadoFiltro || undefined,
      })
      setOrdenes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de movimiento</h1>
          <p className="text-slate-400 text-sm">{ordenes.length} órdenes encontradas</p>
        </div>
        <Link href="/ordenes/nueva" className="btn-primary flex items-center gap-2">
          <span className="text-lg font-light leading-none">+</span>
          Nueva orden
        </Link>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <select className="input w-44" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
            <option value="traslado">Traslado</option>
          </select>
          <select className="input w-44" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="anulado">Anulado</option>
          </select>
          <button onClick={cargar} className="btn-primary px-5">Filtrar</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="table-th">Fecha</th>
                <th className="table-th">Tipo</th>
                <th className="table-th">Referencia</th>
                <th className="table-th">Estado</th>
                <th className="table-th text-right">Costo total</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : ordenes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No hay órdenes.{' '}
                    <Link href="/ordenes/nueva" className="text-primary hover:underline">
                      Crear la primera
                    </Link>
                  </td>
                </tr>
              ) : (
                ordenes.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td text-slate-500">
                      {new Date(o.fecha).toLocaleDateString('es-CL', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="table-td"><TipoBadge tipo={o.tipo} /></td>
                    <td className="table-td text-slate-500">{o.referencia ?? '—'}</td>
                    <td className="table-td"><EstadoBadge estado={o.estado} /></td>
                    <td className="table-td text-right font-semibold">
                      ${o.costo_total?.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="table-td text-right">
                      <Link
                        href={`/ordenes/${o.id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Ver detalle →
                      </Link>
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
