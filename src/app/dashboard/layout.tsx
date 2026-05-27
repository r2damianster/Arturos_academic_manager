import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { ClaseEnProgresoBar } from '@/components/layout/ClaseEnProgresoBar'
import { FloatingNotesPanel } from '@/components/actividades/FloatingNotesPanel'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Detectar modo reemplazante via header puesto por middleware (antes del check de profesor)
  const hdrs = await headers()
  const esReemplazante = hdrs.get('x-es-reemplazante') === 'true'

  const { data: profesor } = await db
    .from('profesores')
    .select('nombre, email, rol')
    .eq('id', user.id)
    .single()

  if (!profesor && !esReemplazante) {
    const { data: estudiante } = await db
      .from('estudiantes').select('id').eq('auth_user_id', user.id).limit(1).single()
    if (estudiante) redirect('/student')
    redirect('/auth/login')
  }

  const nombre = profesor?.nombre ?? user.email ?? 'Reemplazante'
  const email  = profesor?.email  ?? user.email ?? ''

  const hoy = new Date().toISOString().split('T')[0]
  const { data: claseActiva } = await db
    .from('bitacora_clase')
    .select('id, hora_inicio_real, tema, cursos(asignatura, codigo)')
    .eq('profesor_id', user.id)
    .not('hora_inicio_real', 'is', null)
    .neq('estado', 'cumplido')
    .eq('fecha', hoy)
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sidebar — desktop only (the Sidebar component uses fixed positioning) */}
      <div className="hidden md:block" aria-hidden="false">
        <Sidebar nombreProfesor={nombre} />
      </div>

      <div className="md:ml-16 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="bg-gray-900/80 backdrop-blur border-b border-gray-800 sticky top-0 z-30">
          <div className="h-14 flex items-center">
            <div className="md:hidden">
              <MobileNav nombreProfesor={nombre} />
            </div>
            <div className="flex-1">
              <Header nombreProfesor={nombre} email={email} />
            </div>
          </div>
          {claseActiva?.hora_inicio_real && (
            <ClaseEnProgresoBar
              bitacoraId={claseActiva.id}
              cursoNombre={claseActiva.cursos?.asignatura ?? 'Clase'}
              cursoCodigo={claseActiva.cursos?.codigo ?? ''}
              tema={claseActiva.tema ?? ''}
              horaInicioReal={claseActiva.hora_inicio_real}
            />
          )}
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-screen-2xl mx-auto w-full">
            {esReemplazante && (
              <div className="mb-4 flex items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3">
                <span className="text-amber-400 text-lg flex-shrink-0">🔄</span>
                <div>
                  <p className="text-sm font-medium text-amber-300">Modo Reemplazante</p>
                  <p className="text-xs text-amber-400/70">
                    Acceso temporal activo. Solo puedes usar pase de lista y planificación. Edición de curso y exportaciones deshabilitadas.
                  </p>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <FloatingNotesPanel />
    </div>
  )
}
