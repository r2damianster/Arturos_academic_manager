import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: totalCursos }, { count: totalEstudiantes }] = await Promise.all([
    supabase.from('cursos').select('*', { count: 'exact', head: true }),
    supabase.from('estudiantes').select('*', { count: 'exact', head: true }),
  ])

  // Cursos recientes
  const { data: cursosRecientes } = await supabase
    .from('cursos')
    .select('id, asignatura, codigo, periodo')
    .order('created_at', { ascending: false })
    .limit(5)

  // Asistencia de hoy
  const hoy = new Date().toISOString().split('T')[0]
  const { count: asistenciaHoy } = await supabase
    .from('asistencia')
    .select('*', { count: 'exact', head: true })
    .eq('fecha', hoy)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de inicio</h1>
        <p className="text-gray-400 mt-1 text-sm">Resumen de tu actividad docente</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-value">{totalCursos ?? 0}</span>
          <span className="stat-label">Cursos activos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalEstudiantes ?? 0}</span>
          <span className="stat-label">Estudiantes total</span>
        </div>
        <div className="stat-card col-span-2 md:col-span-1">
          <span className="stat-value">{asistenciaHoy ?? 0}</span>
          <span className="stat-label">Registros de asistencia hoy</span>
        </div>
      </div>

      {/* Cursos recientes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Cursos recientes</h2>
          <Link href="/dashboard/cursos" className="text-sm text-brand-400 hover:text-brand-300">
            Ver todos →
          </Link>
        </div>

        {!cursosRecientes || cursosRecientes.length === 0 ? (
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

      {/* Acciones rápidas */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/dashboard/cursos/nuevo"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors text-center">
            <span className="text-2xl">📚</span>
            <span className="text-sm text-gray-300">Nuevo curso</span>
          </Link>
          <Link href="/dashboard/cursos"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors text-center">
            <span className="text-2xl">✅</span>
            <span className="text-sm text-gray-300">Pase de lista</span>
          </Link>
          <Link href="/dashboard/cursos"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors text-center">
            <span className="text-2xl">📊</span>
            <span className="text-sm text-gray-300">Ver asistencia</span>
          </Link>
          <Link href="/dashboard/cursos"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors text-center">
            <span className="text-2xl">📋</span>
            <span className="text-sm text-gray-300">Calificaciones</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
