import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Axioma Flux — Gestión de Inventario',
  description: 'SaaS profesional de gestión de inventario multi-tenant',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
