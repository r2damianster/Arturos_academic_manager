import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profesor } = await db
    .from('profesores')
    .select('nombre, email, rol')
    .eq('id', user.id)
    .single()

  if (!profesor) {
    const { data: estudiante } = await db
      .from('estudiantes').select('id').eq('auth_user_id', user.id).limit(1).single()
    if (estudiante) redirect('/student')
    redirect('/auth/login')
  }

  const nombre = profesor.nombre ?? user.email ?? 'Profesor'
  const email  = profesor.email  ?? user.email ?? ''

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sidebar — desktop only (the Sidebar component uses fixed positioning) */}
      <div className="hidden md:block" aria-hidden="false">
        <Sidebar nombreProfesor={nombre} />
      </div>

      <div className="md:ml-16 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center sticky top-0 z-30">
          {/* Mobile hamburger */}
          <div className="md:hidden">
            <MobileNav nombreProfesor={nombre} />
          </div>
          {/* Desktop spacer + Header (user info + signout) */}
          <div className="flex-1">
            <Header nombreProfesor={nombre} email={email} />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
