interface BadgeProps {
  value: string
  variant?: 'success' | 'warning' | 'danger' | 'default' | 'info'
}

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border border-amber-100',
  danger:  'bg-red-50 text-red-700 border border-red-100',
  info:    'bg-primary-50 text-primary-700 border border-primary-100',
  default: 'bg-slate-100 text-slate-600 border border-slate-200',
}

export default function Badge({ value, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {value}
    </span>
  )
}

export function EstadoBadge({ estado }: { estado?: string }) {
  if (!estado) return null
  const map: Record<string, BadgeProps['variant']> = {
    'Óptimo':      'success',
    'Reponer':     'danger',
    'Sin consumo': 'default',
    'confirmado':  'success',
    'borrador':    'warning',
    'anulado':     'danger',
  }
  return <Badge value={estado} variant={map[estado] ?? 'default'} />
}

export function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    ingreso:  'success',
    salida:   'danger',
    ajuste:   'info',
    traslado: 'warning',
  }
  return <Badge value={tipo.charAt(0).toUpperCase() + tipo.slice(1)} variant={map[tipo] ?? 'default'} />
}
