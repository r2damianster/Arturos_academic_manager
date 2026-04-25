import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { HorariosEditor } from '@/components/cursos/horarios-editor'
import { EstudiantesMetricsTable } from '@/components/cursos/estudiantes-metrics-table'
import type { Tables } from '@/types/database.types'

type Curso = Tables<'cursos'>
type EstudianteRaw = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email' | 'tutoria' | 'estado'> & {
  auth_user_id?: string | null
}

export default async function CursoDetailPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, clasesRes, asistenciaRes, trabajosRes] = await Promise.all([
    db.from('cursos').select('*').eq('id', cursoId).single(),
    db.from('estudiantes')
      .select('id, nombre, email, tutoria, estado, auth_user_id')
      .eq('curso_id', cursoId)
      .order('nombre'),
    db.from('horarios_clases')
      .select('*')
      .eq('curso_id', cursoId)
      .order('dia_semana')
      .order('hora_inicio'),
    db.from('asistencia').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('trabajos_asignados').select('estudiante_id, estado').eq('curso_id', cursoId),
  ])

  const curso = cursoRes.data as Curso | null
  if (!curso) notFound()

  const todosEstudiantes: EstudianteRaw[] = estudiantesRes.data ?? []
  const clases = clasesRes.data ?? []
  const asistencias: { estudiante_id: string; estado: string }[] = asistenciaRes.data ?? []
  const trabajos: { estudiante_id: string; estado: string }[] = trabajosRes.data ?? []

  // Encuesta via auth_user_id
  const authIds = todosEstudiantes.map(e => e.auth_user_id).filter(Boolean)
  const encuestasRes = authIds.length > 0
    ? await db.from('encuesta_estudiante').select('auth_user_id').in('auth_user_id', authIds)
    : { data: [] }
  const encuestaSet = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (encuestasRes.data ?? []).map((e: any) => e.auth_user_id as string)
  )

  // Semana actual
  const semanaRes = await db.rpc('calcular_semana', { p_curso_id: cursoId })
  const semana: string | null = semanaRes.data

  // Asistencia por estudiante: { total, presentes }
  const asistMap: Record<string, { total: number; presentes: number }> = {}
  for (const a of asistencias) {
    if (!asistMap[a.estudiante_id]) asistMap[a.estudiante_id] = { total: 0, presentes: 0 }
    asistMap[a.estudiante_id].total++
    if (a.estado === 'Presente') asistMap[a.estudiante_id].presentes++
  }

  // Trabajos activos por estudiante
  const trabajosMap: Record<string, number> = {}
  for (const t of trabajos) {
    if (t.estado === 'Pendiente' || t.estado === 'En progreso') {
      trabajosMap[t.estudiante_id] = (trabajosMap[t.estudiante_id] ?? 0) + 1
    }
  }

  // Construir lista con métricas
  const estudiantesConMetricas = todosEstudiantes.map(est => {
    const asist = asistMap[est.id]
    const pctAsistencia = asist && asist.total > 0
      ? Math.round((asist.presentes / asist.total) * 100)
      : null
    return {
      id: est.id,
      nombre: est.nombre,
      email: est.email ?? '',
      estado: est.estado ?? 'activo',
      tutoria: est.tutoria,
      pctAsistencia,
      trabajosActivos: trabajosMap[est.id] ?? 0,
      tieneEncuesta: est.auth_user_id ? encuestaSet.has(est.auth_user_id) : false,
    }
  })

  const activos   = estudiantesConMetricas.filter(e => e.estado !== 'retirado')
  const retirados = estudiantesConMetricas.filter(e => e.estado === 'retirado')

  // Métricas globales del curso
  const conAsistencia = activos.filter(e => e.pctAsistencia !== null)
  const asistGlobal = conAsistencia.length > 0
    ? Math.round(conAsistencia.reduce((s, e) => s + (e.pctAsistencia ?? 0), 0) / conAsistencia.length)
    : null
  const totalTrabajosActivos = Object.values(trabajosMap).reduce((s, v) => s + v, 0)
  const totalConEncuesta = activos.filter(e => e.tieneEncuesta).length

  const modules = [
    { href: `/dashboard/cursos/${cursoId}/pase-lista`,             label: 'Bitácora y Lista',   icon: '✅', desc: 'Tomar asistencia' },
    { href: `/dashboard/cursos/${cursoId}/asistencia`,             label: 'Asistencia',          icon: '📊', desc: 'Reporte completo' },
    { href: `/dashboard/cursos/${cursoId}/calificaciones`,         label: 'Calificaciones',      icon: '📝', desc: 'Notas por parcial' },
    { href: `/dashboard/cursos/${cursoId}/trabajos`,               label: 'Trabajos',            icon: '📋', desc: 'Asignar y monitorear' },
    { href: `/dashboard/cursos/${cursoId}/estudiantes/importar`,   label: 'Agregar Estudiantes', icon: '📥', desc: 'Carga masiva' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Link href="/dashboard/cursos" className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{curso.codigo}</span>
            <span className="text-xs text-gray-500">{curso.periodo}</span>
            {semana && <span className="badge-azul">{semana}</span>}
          </div>
          <h1 className="text-2xl font-bold text-white">{curso.asignatura}</h1>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(curso as any).aula && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <p className="text-sm text-gray-400 mt-0.5">📍 {(curso as any).aula}</p>
          )}
          {curso.fecha_inicio && (
            <p className="text-sm text-gray-500 mt-1">
              {new Date(curso.fecha_inicio).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}
              {curso.fecha_fin && (
                <> → {new Date(curso.fecha_fin).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}</>
              )}
            </p>
          )}
          <HorariosEditor cursoId={cursoId} initialClases={clases as any} />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-bold text-white">{activos.length}</p>
          <p className="text-xs text-gray-500">estudiantes activos</p>
          {retirados.length > 0 && (
            <p className="text-xs text-gray-500">+ {retirados.length} retirado(s)</p>
          )}
        </div>
      </div>

      {/* Métricas globales */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <span className={`stat-value ${
            asistGlobal === null ? 'text-gray-600'
            : asistGlobal >= 80 ? 'text-emerald-400'
            : asistGlobal >= 60 ? 'text-yellow-400'
            : 'text-red-400'
          }`}>
            {asistGlobal !== null ? `${asistGlobal}%` : '—'}
          </span>
          <span className="stat-label">Asistencia promedio</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalTrabajosActivos}</span>
          <span className="stat-label">Trabajos activos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalConEncuesta}</span>
          <span className="stat-label">Con encuesta</span>
        </div>
      </div>

      {/* Módulos de navegación */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {modules.map(m => (
          <Link key={m.href} href={m.href}
            className="card hover:border-gray-700 transition-colors text-center group p-4">
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{m.label}</p>
            <p className="text-xs text-gray-500 mt-1 hidden md:block">{m.desc}</p>
          </Link>
        ))}
      </div>

      {/* Tabla de estudiantes con métricas */}
      <EstudiantesMetricsTable
        cursoId={cursoId}
        estudiantes={activos}
        retirados={retirados}
      />

    </div>
  )
}
