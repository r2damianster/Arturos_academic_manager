import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { HorarioSemanaWidget } from '@/components/dashboard/horario-semana-widget'

export default async function DashboardPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursosCount, estudiantesCount] = await Promise.all([
    db.from('cursos').select('id', { count: 'exact', head: true }),
    db.from('estudiantes').select('id', { count: 'exact', head: true }),
  ])
  const totalCursos: number = cursosCount.count ?? 0
  const totalEstudiantes: number = estudiantesCount.count ?? 0

  // Cursos recientes
  const cursosRes = await db
    .from('cursos')
    .select('id, asignatura, codigo, periodo')
    .order('created_at', { ascending: false })
    .limit(5)
  const cursosRecientes: { id: string; asignatura: string; codigo: string; periodo: string }[] =
    cursosRes.data ?? []

  // Asistencia de hoy
  const hoy = new Date().toISOString().split('T')[0]
  const asistenciaRes = await db
    .from('asistencia')
    .select('id', { count: 'exact', head: true })
    .eq('fecha', hoy)
  const asistenciaHoy: number = asistenciaRes.count ?? 0

  // Todas las clases de la semana (para el widget navegable)
  const DOW_MAP = [ 'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado' ]
  const hoyDow = DOW_MAP[new Date().getDay()] ?? 'lunes'

  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let todasClases: any[] = []
  if (user) {
    const clasesRes = await db
      .from('horarios_clases')
      .select('id, hora_inicio, hora_fin, dia_semana, tipo, cursos(asignatura, codigo)')
      .eq('profesor_id', user.id)
      .order('hora_inicio')
    todasClases = clasesRes.data ?? []
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de inicio</h1>
        <p className="text-gray-400 mt-1 mb-4 text-sm">Resumen de tu actividad docente</p>
        <Link href="/dashboard/pase-lista" className="btn-primary inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Tomar Lista
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-value">{totalCursos}</span>
          <span className="stat-label">Cursos activos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalEstudiantes}</span>
          <span className="stat-label">Estudiantes total</span>
        </div>
        <div className="stat-card col-span-2 md:col-span-1">
          <span className="stat-value">{asistenciaHoy}</span>
          <span className="stat-label">Registros de asistencia hoy</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Horario semanal navegable */}
        <HorarioSemanaWidget clases={todasClases} todayDia={hoyDow} />

        {/* Cursos recientes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Cursos recientes</h2>
            <Link href="/dashboard/cursos" className="text-sm text-brand-400 hover:text-brand-300">
              Ver todos →
            </Link>
          </div>

          {cursosRecientes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-3">No tienes cursos aún</p>
              <Link href="/dashboard/cursos/nuevo" className="btn-primary text-sm">
                + Crear primer curso
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {cursosRecientes.map(curso => (
                <Link
                  key={curso.id}
                  href={`/dashboard/cursos/${curso.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 transition-colors group"
                >
                  <div>
                    <p className="font-medium text-gray-200 group-hover:text-white transition-colors">
                      {curso.asignatura}
                    </p>
                    <p className="text-xs text-gray-500">{curso.codigo} · {curso.periodo}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
