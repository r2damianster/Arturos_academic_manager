import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

// Cliente de Supabase para Server Components, Server Actions y Route Handlers
// Los tipos de tabla se manejan con importaciones explícitas de @/types/database.types
// Regenerar tipos cuando tengas el proyecto: npx supabase gen types typescript --project-id TU_ID
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En Server Components el set es ignorado
          }
        },
      },
    }
  )
}

// Cliente con service role — bypasea RLS completamente.
// Usar SOLO para lecturas cross-usuario donde RLS bloquea legítimamente al profesor
// (ej: leer encuesta_estudiante de sus propios alumnos).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en el entorno')
  return createSupabaseClient(url, key)
}

// Tipo de retorno del cliente para uso en funciones auxiliares
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
