import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Si es profesor, mandarlo al dashboard
  const { data: profesor } = await db.from('profesores').select('id').eq('id', user.id).single()
  if (profesor) redirect('/dashboard')

  // Verificar que es estudiante registrado
  const { data: estudiantes } = await db
    .from('estudiantes').select('id, nombre').eq('auth_user_id', user.id).limit(1)

  if (!estudiantes || estudiantes.length === 0) redirect('/auth/login')

  const nombre: string = estudiantes[0].nombre

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header simple */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-5 z-30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <span className="text-white text-sm font-semibold">Portal Estudiantil</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm hidden sm:block">{nombre}</span>
          <form action="/auth/logout" method="post">
            <Link href="/auth/login" className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Link>
          </form>
        </div>
      </header>
      <main className="pt-14 px-4 py-6 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}
