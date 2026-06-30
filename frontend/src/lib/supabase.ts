import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Cliente Supabase para componentes del lado del cliente (browser).
 * Se reutiliza una sola instancia por módulo.
 */
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Obtiene el JWT del usuario autenticado actualmente.
 * Este token se envía al backend FastAPI en el header Authorization.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Obtiene la sesión completa del usuario.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session
}
