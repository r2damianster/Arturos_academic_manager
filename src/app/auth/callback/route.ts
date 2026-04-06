import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') // destino explícito (ej. /auth/new-password)

  if (code) {
    // Determinar destino para construir la respuesta de redirect primero
    // Los cookies se escriben directamente sobre esta respuesta
    const redirectUrl = `${origin}${next ?? '/auth/login'}`
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Escribir cookies tanto en request como en la respuesta de redirect
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Si hay destino explícito (reset de contraseña, etc.) ir directamente
      if (next) return response

      // Sin destino: detectar tipo de usuario
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any
        const { data: profesor } = await db.from('profesores').select('id').eq('id', user.id).single()
        if (profesor) {
          response.headers.set('Location', `${origin}/dashboard`)
          return response
        }
        const { data: estudiante } = await db.from('estudiantes').select('id').eq('auth_user_id', user.id).limit(1).single()
        if (estudiante) {
          response.headers.set('Location', `${origin}/student`)
          return response
        }
      }
      response.headers.set('Location', `${origin}/dashboard`)
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
