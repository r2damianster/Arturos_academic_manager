import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profesor } = await supabase
    .from('profesores')
    .select('nombre, email')
    .eq('id', user.id)
    .single()

  const nombre = profesor?.nombre ?? user.email ?? 'Profesor'
  const email = profesor?.email ?? user.email ?? ''

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar nombreProfesor={nombre} />
      <div className="ml-[260px] flex flex-col min-h-screen">
        <Header nombreProfesor={nombre} email={email} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
