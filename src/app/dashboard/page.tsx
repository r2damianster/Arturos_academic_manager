import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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

  // Clases de hoy
  const DOW_MAP = [ 'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado' ]
  const hoyDow = DOW_MAP[new Date().getDay()]
  
  const { data: { user } } = await supabase.auth.getUser()
  let clasesHoy: any[] = []
  if (user) {
    const clasesRes = await db
      .from('horarios_clases')
      .select('id, hora_inicio, hora_fin, cursos(asignatura, codigo)')
      .eq('profesor_id', user.id)
      .eq('dia_semana', hoyDow)
      .order('hora_inicio')
    clasesHoy = clasesRes.data ?? []
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
        {/* Clases de hoy */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span>📅</span> Horario de Hoy ({hoyDow})
            </h2>
            <Link href="/dashboard/tutorias" className="text-sm text-brand-400 hover:text-brand-300">
              Ver calendario →
            </Link>
          </div>

          {clasesHoy.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-2">No tienes clases registradas para hoy.</p>
              <Link href="/dashboard/cursos" className="text-xs text-brand-400 hover:text-brand-300">
                Gestionar cursos
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {clasesHoy.map((clase, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-800">
                  <div className="flex flex-col justify-center text-center px-3 py-1 bg-gray-900 rounded border border-gray-700 min-w-[70px]">
                    <span className="text-xs font-bold text-white">{clase.hora_inicio.slice(0, 5)}</span>
                    <span className="text-[10px] text-gray-500">{clase.hora_fin.slice(0, 5)}</span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="font-medium text-gray-200 text-sm">{clase.cursos?.asignatura}</p>
                    <p className="text-xs text-gray-500">{clase.cursos?.codigo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
