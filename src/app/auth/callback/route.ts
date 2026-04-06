import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') // destino explícito (ej. /auth/new-password)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Si hay destino explícito (ej. reset de contraseña), ir allí directamente
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Detectar tipo de usuario y redirigir
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any
        const { data: profesor } = await db.from('profesores').select('id').eq('id', user.id).single()
        if (profesor) return NextResponse.redirect(`${origin}/dashboard`)
        const { data: estudiante } = await db.from('estudiantes').select('id').eq('auth_user_id', user.id).limit(1).single()
        if (estudiante) return NextResponse.redirect(`${origin}/student`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
