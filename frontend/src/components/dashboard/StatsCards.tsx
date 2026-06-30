interface Stat {
  label: string
  value: string | number
  subtitle?: string
  color: string
  icon: React.ReactNode
}

interface Props {
  resumen: {
    total_productos: number
    productos_a_reponer: number
    valor_inventario_total: number
    ordenes_pendientes: number
  }
}

export default function StatsCards({ resumen }: Props) {
  const stats: Stat[] = [
    {
      label: 'Productos activos',
      value: resumen.total_productos,
      color: 'bg-primary',
      icon: <BoxIcon />,
    },
    {
      label: 'Requieren reposición',
      value: resumen.productos_a_reponer,
      subtitle: 'Menos de 45 días de stock',
      color: 'bg-red-500',
      icon: <AlertIcon />,
    },
    {
      label: 'Valor inventario',
      value: `$${resumen.valor_inventario_total.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
      subtitle: 'A costo promedio (CPP)',
      color: 'bg-emerald-500',
      icon: <ChartIcon />,
    },
    {
      label: 'Órdenes pendientes',
      value: resumen.ordenes_pendientes,
      subtitle: 'En estado borrador',
      color: 'bg-amber-500',
      icon: <ClockIcon />,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card flex items-center gap-4">
          <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
            {stat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-800 truncate">{stat.value}</p>
            <p className="text-sm text-slate-500 leading-tight">{stat.label}</p>
            {stat.subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{stat.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function BoxIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
