import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar la sesión — IMPORTANTE: no agregar lógica entre esto y getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rutas protegidas — requieren sesión
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/student'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Login con sesión activa → redirigir según tipo de usuario
  if (user && pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    // Check if student (has row in estudiantes with auth_user_id)
    const { data: est } = await supabase
      .from('estudiantes')
      .select('id')
      .eq('auth_user_id', user.id)
      .limit(1)
      .single()
    url.pathname = est ? '/student' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // Forward pathname so server layouts can read it
  supabaseResponse.headers.set('x-pathname', pathname)

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
