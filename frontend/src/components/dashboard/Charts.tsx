'use client'

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement
)

const PRIMARY = '#1AABF0'
const PRIMARY_LIGHT = 'rgba(26,171,240,0.15)'
const PALETTE = [
  '#1AABF0', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316',
]

// ── GRÁFICO 1: Stock por categoría (barras) ──────────────────
interface StockCategoriaProps {
  data: { categoria: string; stock_total: number; valor_total: number }[]
}

export function StockCategoriaChart({ data }: StockCategoriaProps) {
  if (!data?.length) return <EmptyChart mensaje="Sin datos de categorías" />

  const chartData = {
    labels: data.map(d => d.categoria),
    datasets: [
      {
        label: 'Stock total (unidades)',
        data: data.map(d => d.stock_total ?? 0),
        backgroundColor: PALETTE.slice(0, data.length),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toLocaleString('es-CL')} unidades`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 } } },
        },
      }}
    />
  )
}

// ── GRÁFICO 2: Salidas mensuales (línea) ─────────────────────
interface SalidasProps {
  data: { mes: string; costo_total: number; cantidad_total: number }[]
}

export function SalidasMensualesChart({ data }: SalidasProps) {
  if (!data?.length) return <EmptyChart mensaje="Sin datos de salidas en los últimos 12 meses" />

  const labels = data.map(d => {
    const date = new Date(d.mes)
    return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Costo total salidas ($)',
        data: data.map(d => d.costo_total ?? 0),
        borderColor: PRIMARY,
        backgroundColor: PRIMARY_LIGHT,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: PRIMARY,
        pointRadius: 4,
      },
    ],
  }

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx =>
                ` $${ctx.parsed.y.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: '#F1F5F9' },
            ticks: {
              font: { size: 11 },
              callback: v => `$${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
            },
          },
        },
      }}
    />
  )
}

// ── GRÁFICO 3: Donut por valor de inventario ─────────────────
interface ValorCategoriaProps {
  data: { categoria: string; valor_total: number }[]
}

export function ValorCategoriaChart({ data }: ValorCategoriaProps) {
  if (!data?.length) return <EmptyChart mensaje="Sin datos" />

  const chartData = {
    labels: data.map(d => d.categoria),
    datasets: [{
      data: data.map(d => d.valor_total ?? 0),
      backgroundColor: PALETTE.slice(0, data.length),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  }

  return (
    <Doughnut
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: ctx =>
                ` $${ctx.parsed.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
            },
          },
        },
      }}
    />
  )
}

function EmptyChart({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      {mensaje}
    </div>
  )
}
