import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { EstudiantesMetricsTable } from '@/components/cursos/estudiantes-metrics-table'
import { RiesgoPanel } from '@/components/cursos/RiesgoPanel'
import { ExportDatasetButton } from '@/components/cursos/ExportDatasetButton'
import { CierreParcialesPanel } from '@/components/cursos/CierreParcialesPanel'
import { getSnapshotsParcial } from '@/lib/actions/parcial'
import type { Tables } from '@/types/database.types'

type Curso = Tables<'cursos'>
type EstudianteRaw = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email' | 'tutoria' | 'estado'> & {
  auth_user_id?: string | null
}

export default async function CursoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cursoId: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { cursoId } = await params
  const { edit } = await searchParams
  const supabase = await createClient()
  // Redirect legacy ?edit=true links to new dedicated route
  if (edit === 'true') {
    redirect(`/dashboard/cursos/${cursoId}/editar`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, asistenciaRes, trabajosRes, citacionesRes, participacionRes, notasEnCursoRes, snapshots] = await Promise.all([
    db.from('cursos').select('*').eq('id', cursoId).single(),
    db.from('estudiantes')
      .select('id, nombre, email, tutoria, estado, auth_user_id')
      .eq('curso_id', cursoId)
      .order('nombre'),
    db.from('asistencia').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('trabajos_asignados').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('citaciones_tutoria')
      .select('estudiante_id')
      .eq('curso_id', cursoId)
      .in('estado', ['pendiente', 'agendada']),
    db.from('participacion').select('estudiante_id, nivel').eq('curso_id', cursoId),
    db.from('calificaciones_items').select('estudiante_id, nota').eq('curso_id', cursoId).eq('fuente', 'en_curso'),
    getSnapshotsParcial(cursoId),
  ])

  const curso = cursoRes.data as Curso | null
  if (!curso) notFound()

  const todosEstudiantes: EstudianteRaw[] = estudiantesRes.data ?? []
  const asistencias: { estudiante_id: string; estado: string }[] = asistenciaRes.data ?? []
  const trabajos: { estudiante_id: string; estado: string }[] = trabajosRes.data ?? []
  const participaciones: { estudiante_id: string; nivel: number }[] = participacionRes.data ?? []
  const notasEnCurso: { estudiante_id: string; nota: number | null }[] = notasEnCursoRes.data ?? []
  const citadosSet = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (citacionesRes.data ?? []).map((c: any) => c.estudiante_id as string)
  )

  // Encuesta via auth_user_id — RLS permite al profesor leer encuestas de sus estudiantes
  const authIds = todosEstudiantes.map(e => e.auth_user_id).filter(Boolean) as string[]
  let encuestaSet = new Set<string>()
  if (authIds.length > 0) {
    const { data: encuestasData } = await db
      .from('encuesta_estudiante')
      .select('auth_user_id')
      .in('auth_user_id', authIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encuestaSet = new Set<string>((encuestasData ?? []).map((e: any) => e.auth_user_id as string))
  }

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

  // Participación promedio por estudiante
  const participacionMap: Record<string, number> = {}
  {
    const grupos: Record<string, number[]> = {}
    for (const p of participaciones) {
      if (!grupos[p.estudiante_id]) grupos[p.estudiante_id] = []
      grupos[p.estudiante_id].push(p.nivel)
    }
    for (const [id, niveles] of Object.entries(grupos)) {
      participacionMap[id] = Math.round((niveles.reduce((s, n) => s + n, 0) / niveles.length) * 10) / 10
    }
  }

  // Notas en curso: pct completadas
  const notasEnCursoMap: Record<string, { total: number; completadas: number }> = {}
  for (const n of notasEnCurso) {
    if (!notasEnCursoMap[n.estudiante_id]) notasEnCursoMap[n.estudiante_id] = { total: 0, completadas: 0 }
    notasEnCursoMap[n.estudiante_id].total++
    if (n.nota !== null) notasEnCursoMap[n.estudiante_id].completadas++
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
      participacionPromedio: participacionMap[est.id] ?? null,
      notasEnCursoPct: notasEnCursoMap[est.id]
        ? Math.round((notasEnCursoMap[est.id].completadas / notasEnCursoMap[est.id].total) * 100)
        : null,
    }
  })

  const activos   = estudiantesConMetricas.filter(e => e.estado !== 'retirado')
  const retirados = estudiantesConMetricas.filter(e => e.estado === 'retirado')

  function contarFactores(e: { pctAsistencia: number | null; trabajosActivos: number; participacionPromedio: number | null; notasEnCursoPct: number | null }): number {
    let f = 0
    if (e.pctAsistencia !== null && e.pctAsistencia < 75) f++
    if (e.participacionPromedio !== null && e.participacionPromedio < 2.5) f++
    if (e.notasEnCursoPct !== null && e.notasEnCursoPct < 50) f++
    if (e.trabajosActivos >= 3) f++
    return f
  }

  const enRiesgo = activos
    .filter(e => {
      if (citadosSet.has(e.id)) return false
      const factores = contarFactores(e)
      return (e.pctAsistencia !== null && e.pctAsistencia < 60) || factores >= 2
    })
    .map(e => ({
      id: e.id,
      nombre: e.nombre,
      pctAsistencia: e.pctAsistencia,
      trabajosActivos: e.trabajosActivos,
      participacionPromedio: e.participacionPromedio,
      notasEnCursoPct: e.notasEnCursoPct,
      factoresRiesgo: contarFactores(e),
    }))
    .sort((a, b) => b.factoresRiesgo - a.factoresRiesgo)

  // Notificación encuesta parcial
  let encuestaParcialNotif: { mostrar: boolean; respondieron: number; total: number } = { mostrar: false, respondieron: 0, total: 0 }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((curso as any).encuesta_parcial_habilitada && curso.fecha_inicio && curso.fecha_fin) {
    const inicio = new Date(curso.fecha_inicio).getTime()
    const fin = new Date(curso.fecha_fin).getTime()
    const pct = (Date.now() - inicio) / (fin - inicio)
    if (pct >= 0.5 && pct < 0.75) {
      const [totalRes, respRes] = await Promise.all([
        db.from('estudiantes').select('id', { count: 'exact', head: true })
          .eq('curso_id', cursoId).eq('estado', 'activo'),
        db.from('encuesta_parcial').select('id', { count: 'exact', head: true })
          .eq('curso_id', cursoId).eq('tipo', 'mitad'),
      ])
      encuestaParcialNotif = {
        mostrar: true,
        respondieron: respRes.count ?? 0,
        total: totalRes.count ?? 0,
      }
    }
  }

  // Métricas globales del curso
  const conAsistencia = activos.filter(e => e.pctAsistencia !== null)
  const asistGlobal = conAsistencia.length > 0
    ? Math.round(conAsistencia.reduce((s, e) => s + (e.pctAsistencia ?? 0), 0) / conAsistencia.length)
    : null
  const totalTrabajosActivos = Object.values(trabajosMap).reduce((s, v) => s + v, 0)
  const totalConEncuesta = activos.filter(e => e.tieneEncuesta).length

  const modules = [
    { href: `/dashboard/cursos/${cursoId}/pase-lista`,             label: 'Bitácora y Lista',   icon: '✅', desc: 'Tomar y editar por fecha' },
    { href: `/dashboard/cursos/${cursoId}/asistencia`,             label: 'Asistencia',          icon: '📊', desc: 'Reporte completo' },
    { href: `/dashboard/cursos/${cursoId}/calificaciones`,         label: 'Evaluaciones',        icon: '📝', desc: 'Notas, participación y resumen' },
    { href: `/dashboard/cursos/${cursoId}/trabajos`,               label: 'Trabajos',            icon: '📋', desc: 'Asignar y monitorear' },
    { href: `/dashboard/cursos/${cursoId}/encuesta`,               label: 'Encuesta',            icon: '📋', desc: 'Perfil del grupo' },
    { href: `/dashboard/cursos/${cursoId}/citaciones`,             label: 'Citaciones',          icon: '📞', desc: 'Historial de tutorías' },
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{curso.asignatura}</h1>
            <Link
              href={`/dashboard/cursos/${cursoId}/editar`}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:border-brand-600/60 hover:text-brand-400 hover:bg-brand-900/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar curso
            </Link>
            <div className="mt-1">
              <ExportDatasetButton cursoId={cursoId} />
            </div>
          </div>
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
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-bold text-white">{activos.length}</p>
          <p className="text-xs text-gray-500">estudiantes activos</p>
          {retirados.length > 0 && (
            <p className="text-xs text-gray-500">+ {retirados.length} retirado(s)</p>
          )}
        </div>
      </div>

      {/* Banner encuesta parcial activa */}
      {encuestaParcialNotif.mostrar && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-400 text-lg mt-0.5">📋</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 font-medium text-sm">Encuesta de progreso activa esta semana</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              {encuestaParcialNotif.respondieron} de {encuestaParcialNotif.total} estudiantes han respondido
            </p>
          </div>
          <Link
            href={`/dashboard/cursos/${cursoId}/encuesta-parcial`}
            className="text-amber-400 text-xs font-medium hover:text-amber-300 whitespace-nowrap"
          >
            Ver resultados →
          </Link>
        </div>
      )}

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
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {modules.map(m => (
          <Link key={m.href} href={m.href}
            className="card hover:border-gray-700 transition-colors text-center group p-4">
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{m.label}</p>
            <p className="text-xs text-gray-500 mt-1 hidden md:block">{m.desc}</p>
          </Link>
        ))}
      </div>

      {/* Panel de riesgo */}
      <RiesgoPanel cursoId={cursoId} estudiantes={enRiesgo} />

      {/* Cierre de parciales */}
      <CierreParcialesPanel
        cursoId={cursoId}
        numParciales={(curso as any).num_parciales ?? 2}
        snapshots={snapshots}
      />

      {/* Tabla de estudiantes con métricas */}
      <EstudiantesMetricsTable
        cursoId={cursoId}
        estudiantes={activos}
        retirados={retirados}
      />

    </div>
  )
}
