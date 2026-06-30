'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { productosApi, ordenesApi, posicionesApi } from '@/lib/api'
import type { LineaOrdenForm, TipoMovimiento } from '@/types'

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso (entrada de mercadería)',
  salida: 'Salida (despacho / venta)',
  ajuste: 'Ajuste de inventario',
  traslado: 'Traslado entre posiciones',
}

export default function OrdenForm() {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Estado del formulario ──────────────────────────────────
  const [tipo, setTipo] = useState<TipoMovimiento>('ingreso')
  const [referencia, setReferencia] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<LineaOrdenForm[]>([])

  // ── Búsqueda de productos ──────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // ── Búsqueda de posiciones ────────────────────────────────
  const [posiciones, setPosiciones] = useState<any[]>([])

  // ── Estado UI ─────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar posiciones para los selectores
  useEffect(() => {
    posicionesApi.buscar().then(setPosiciones).catch(() => {})
  }, [])

  // ── Búsqueda con debounce ─────────────────────────────────
  useEffect(() => {
    if (busqueda.trim().length < 1) {
      setResultados([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await productosApi.buscar(busqueda)
        setResultados(res)
        setShowDropdown(true)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  // ── Agregar producto a la orden ──────────────────────────
  function agregarProducto(producto: any) {
    const yaExiste = lineas.some(l => l.producto_id === producto.id)
    if (yaExiste) {
      // Incrementar cantidad si ya está en la lista
      setLineas(prev => prev.map(l =>
        l.producto_id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l
      ))
    } else {
      const nueva: LineaOrdenForm = {
        uid: crypto.randomUUID(),
        producto_id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        unidad_medida: producto.unidad_medida,
        cantidad: 1,
        costo_unitario: producto.costo_promedio ?? 0,
        stock_disponible: 0, // se carga al validar
      }
      setLineas(prev => [...prev, nueva])
    }
    setBusqueda('')
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  // ── Editar campo de una línea ─────────────────────────────
  function editarLinea(uid: string, campo: keyof LineaOrdenForm, valor: any) {
    setLineas(prev => prev.map(l => l.uid === uid ? { ...l, [campo]: valor, error: undefined } : l))
  }

  function eliminarLinea(uid: string) {
    setLineas(prev => prev.filter(l => l.uid !== uid))
  }

  // ── Calcular total ────────────────────────────────────────
  const costoTotal = lineas.reduce((acc, l) => acc + (l.cantidad * l.costo_unitario), 0)

  // ── Guardar borrador ──────────────────────────────────────
  async function guardarBorrador(): Promise<string | null> {
    if (lineas.length === 0) {
      setError('Agrega al menos un producto a la orden')
      return null
    }
    setGuardando(true)
    setError(null)
    try {
      const payload = {
        tipo,
        referencia: referencia || null,
        observaciones: observaciones || null,
        lineas: lineas.map(l => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          costo_unitario: tipo === 'ingreso' ? l.costo_unitario : 0,
          posicion_origen_id: l.posicion_origen_id || null,
          posicion_destino_id: l.posicion_destino_id || null,
          lote_id: l.lote_id || null,
        })),
      }
      const orden = await ordenesApi.crear(payload)
      return orden.id
    } catch (e: any) {
      setError(e.message || 'Error al guardar la orden')
      return null
    } finally {
      setGuardando(false)
    }
  }

  // ── Confirmar orden (atómica) ─────────────────────────────
  async function handleConfirmar() {
    setShowConfirm(false)
    setConfirmando(true)
    setError(null)

    const ordenId = await guardarBorrador()
    if (!ordenId) { setConfirmando(false); return }

    try {
      await ordenesApi.confirmar(ordenId)
      router.push('/ordenes')
    } catch (e: any) {
      setError(e.message || 'Error al confirmar la orden')
    } finally {
      setConfirmando(false)
    }
  }

  async function handleGuardarSolo() {
    const id = await guardarBorrador()
    if (id) router.push('/ordenes')
  }

  const mostrarCosto = tipo === 'ingreso' || tipo === 'ajuste'
  const mostrarOrigen = tipo === 'salida' || tipo === 'traslado'
  const mostrarDestino = tipo === 'ingreso' || tipo === 'traslado' || tipo === 'ajuste'

  return (
    <div className="space-y-5">
      {/* ── Cabecera ── */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 mb-4">Datos de la orden</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo de movimiento *</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value as TipoMovimiento)}>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Referencia (opcional)</label>
            <input
              className="input"
              placeholder="N° factura, OC, etc."
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Observaciones (opcional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Notas adicionales..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Buscador de productos ── */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 mb-3">Agregar productos</h2>
        <div className="relative">
          <input
            ref={searchRef}
            className="input pr-10"
            placeholder="Buscar por SKU o nombre del producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={() => resultados.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            autoComplete="off"
          />
          {buscando && (
            <div className="absolute right-3 top-2.5">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Dropdown de resultados */}
          {showDropdown && resultados.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {resultados.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary-50 text-left transition-colors border-b border-slate-50 last:border-0"
                  onMouseDown={() => agregarProducto(p)}
                >
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{p.sku}</span>
                    <span className="text-sm font-medium text-slate-800">{p.nombre}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{p.unidad_medida}</span>
                    <span className="text-sm font-semibold text-primary ml-3">
                      ${p.costo_promedio?.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && busqueda.length > 0 && resultados.length === 0 && !buscando && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
              No se encontraron productos con "{busqueda}"
            </div>
          )}
        </div>

        {/* ── Tabla de líneas ── */}
        {lineas.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="table-th">SKU</th>
                  <th className="table-th">Producto</th>
                  <th className="table-th text-right">Cantidad</th>
                  {mostrarCosto && <th className="table-th text-right">Costo unit.</th>}
                  {mostrarOrigen && <th className="table-th">Pos. origen</th>}
                  {mostrarDestino && <th className="table-th">Pos. destino</th>}
                  <th className="table-th text-right">Total</th>
                  <th className="table-th w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lineas.map(linea => (
                  <tr key={linea.uid} className={linea.error ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="table-td font-mono text-xs text-slate-400">{linea.sku}</td>
                    <td className="table-td">
                      <p className="font-medium text-slate-800">{linea.nombre}</p>
                      <p className="text-xs text-slate-400">{linea.unidad_medida}</p>
                      {linea.error && <p className="text-xs text-red-500 mt-0.5">{linea.error}</p>}
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className="input text-right w-24 py-1"
                        value={linea.cantidad}
                        onChange={e => editarLinea(linea.uid, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    {mostrarCosto && (
                      <td className="table-td">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input text-right w-28 py-1"
                          value={linea.costo_unitario}
                          onChange={e => editarLinea(linea.uid, 'costo_unitario', parseFloat(e.target.value) || 0)}
                          disabled={tipo !== 'ingreso' && tipo !== 'ajuste'}
                        />
                      </td>
                    )}
                    {mostrarOrigen && (
                      <td className="table-td">
                        <select
                          className="input py-1 text-xs"
                          value={linea.posicion_origen_id || ''}
                          onChange={e => editarLinea(linea.uid, 'posicion_origen_id', e.target.value || undefined)}
                        >
                          <option value="">Sin posición</option>
                          {posiciones.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.codigo}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    {mostrarDestino && (
                      <td className="table-td">
                        <select
                          className="input py-1 text-xs"
                          value={linea.posicion_destino_id || ''}
                          onChange={e => editarLinea(linea.uid, 'posicion_destino_id', e.target.value || undefined)}
                        >
                          <option value="">Sin posición</option>
                          {posiciones.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.codigo}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="table-td text-right font-semibold text-slate-700">
                      ${(linea.cantidad * linea.costo_unitario).toFixed(2)}
                    </td>
                    <td className="table-td">
                      <button
                        type="button"
                        onClick={() => eliminarLinea(linea.uid)}
                        className="text-slate-300 hover:text-red-400 transition-colors"
                        title="Eliminar línea"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={mostrarCosto ? 3 : 2} className="table-td font-semibold text-slate-500 text-right">
                    Total orden:
                  </td>
                  <td className="table-td text-right font-bold text-lg text-slate-800">
                    ${costoTotal.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {lineas.length === 0 && (
          <div className="text-center py-10 text-slate-300 border-2 border-dashed border-slate-200 rounded-xl mt-4">
            <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">Busca un producto para agregar a la orden</p>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-5 py-4 border border-red-100">
          {error}
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/ordenes')}
          className="btn-secondary"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGuardarSolo}
            disabled={guardando || lineas.length === 0}
            className="btn-secondary"
          >
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={confirmando || lineas.length === 0}
            className="btn-primary px-6"
          >
            {confirmando ? 'Procesando...' : 'Confirmar orden'}
          </button>
        </div>
      </div>

      {/* ── Modal de confirmación ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Confirmar orden de {tipo}
            </h3>
            <p className="text-slate-500 text-sm mb-4">
              Esta acción procesará {lineas.length} producto(s) de forma atómica.
              {tipo === 'salida' && ' Se validará el stock disponible antes de confirmar.'}
              {tipo === 'ingreso' && ' El costo promedio (CPP) se recalculará automáticamente.'}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-1 text-sm">
              {referencia && <p><span className="text-slate-400">Ref:</span> {referencia}</p>}
              <p><span className="text-slate-400">Productos:</span> {lineas.length}</p>
              <p><span className="text-slate-400">Costo total:</span>{' '}
                <strong>${costoTotal.toFixed(2)}</strong>
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">
                Revisar
              </button>
              <button onClick={handleConfirmar} className="btn-primary flex-1 py-2.5">
                Sí, confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
