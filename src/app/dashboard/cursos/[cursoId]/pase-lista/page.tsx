import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PaseListaClient } from '@/components/pase-lista/pase-lista-client'
import type { Tables } from '@/types/database.types'

type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email' | 'tutoria'>
type Curso = Tables<'cursos'>

export interface EstudiantePerfil {
  pct_asistencia: number | null
  promedio: number | null
  trabajos_activos: number
  ultimo_trabajo: { tipo: string; tema: string | null; estado: string } | null
  ultima_observacion: string | null
}

export default async function PaseListaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, asistenciaHistRes, calificacionesRes, trabajosRes] = await Promise.all([
    db.from('cursos').select('*').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email, tutoria').eq('curso_id', cursoId).order('nombre'),
    db.from('asistencia').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('calificaciones').select('estudiante_id, acd1, ta1, pe1, ex1, acd2, ta2, pe2, ex2').eq('curso_id', cursoId),
    db.from('trabajos_asignados')
      .select('id, estudiante_id, tipo, tema, estado, fecha_asignacion')
      .eq('curso_id', cursoId)
      .order('fecha_asignacion', { ascending: false }),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Curso
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []

  // Fetch observaciones de todos los trabajos del curso
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todosTrabajos: any[] = trabajosRes.data ?? []
  const trabajoIds: string[] = todosTrabajos.map((t: { id: string }) => t.id)

  const observacionesRes = trabajoIds.length > 0
    ? await db.from('observaciones_trabajo')
        .select('observacion, fecha, trabajo_id')
        .in('trabajo_id', trabajoIds)
        .order('fecha', { ascending: false })
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observaciones: any[] = observacionesRes.data ?? []
  // Map trabajo_id → estudiante_id
  const trabajoAEstudiante: Record<string, string> = {}
  for (const t of todosTrabajos) trabajoAEstudiante[t.id] = t.estudiante_id

  const hoy = new Date().toISOString().split('T')[0]
  const asistenciaHoyRes = await db
    .from('asistencia')
    .select('estudiante_id, estado')
    .eq('curso_id', cursoId)
    .eq('fecha', hoy)

  const yaRegistrado = (asistenciaHoyRes.data?.length ?? 0) > 0
  const horasSesion = Math.max(1, Math.round(curso.horas_semana / Math.max(1, curso.num_sesiones)))

  // Construir perfiles por estudiante
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asistenciaHist: any[] = asistenciaHistRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calificaciones: any[] = calificacionesRes.data ?? []

  const perfiles: Record<string, EstudiantePerfil> = {}

  for (const est of estudiantes) {
    // % asistencia
    const regEst = asistenciaHist.filter((r: { estudiante_id: string }) => r.estudiante_id === est.id)
    const presentes = regEst.filter((r: { estado: string }) => r.estado === 'Presente').length
    const pct_asistencia = regEst.length > 0 ? Math.round(presentes / regEst.length * 100) : null

    // Promedio (fórmula: ACD×30% + TA×10% + PE×20% + EX×40% por ciclo)
    const cal = calificaciones.find((c: { estudiante_id: string }) => c.estudiante_id === est.id)
    let promedio: number | null = null
    if (cal) {
      const ciclo1 = (cal.acd1 ?? 0) * 0.3 + (cal.ta1 ?? 0) * 0.1 + (cal.pe1 ?? 0) * 0.2 + (cal.ex1 ?? 0) * 0.4
      const ciclo2 = (cal.acd2 ?? 0) * 0.3 + (cal.ta2 ?? 0) * 0.1 + (cal.pe2 ?? 0) * 0.2 + (cal.ex2 ?? 0) * 0.4
      const total = (ciclo1 + ciclo2) / 2
      if (total > 0) promedio = Math.round(total * 10) / 10
    }

    // Trabajos activos + último trabajo
    const trabajosEst = todosTrabajos.filter((t: { estudiante_id: string }) => t.estudiante_id === est.id)
    const trabajos_activos = trabajosEst.filter((t: { estado: string }) =>
      t.estado === 'Pendiente' || t.estado === 'En progreso'
    ).length

    // El trabajo más reciente activo (o el más reciente en general)
    const trabajoActivo = trabajosEst.find((t: { estado: string }) =>
      t.estado === 'Pendiente' || t.estado === 'En progreso'
    ) ?? trabajosEst[0] ?? null

    const ultimo_trabajo = trabajoActivo
      ? { tipo: trabajoActivo.tipo, tema: trabajoActivo.tema ?? null, estado: trabajoActivo.estado }
      : null

    // Última observación del estudiante
    const obsEst = observaciones.filter((o: { trabajo_id: string }) =>
      trabajoAEstudiante[o.trabajo_id] === est.id
    )
    const ultima_observacion = obsEst[0]?.observacion ?? null

    perfiles[est.id] = { pct_asistencia, promedio, trabajos_activos, ultimo_trabajo, ultima_observacion }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Bitácora y lista</h1>
          <p className="text-gray-400 text-sm">
            {curso.asignatura} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {yaRegistrado && (
        <div className="bg-yellow-950/50 border border-yellow-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-400 text-lg">⚠️</span>
          <div>
            <p className="text-yellow-300 text-sm font-medium">Ya registraste asistencia hoy</p>
            <p className="text-yellow-600 text-xs">Puedes volver a registrar y se sobreescribirá.</p>
          </div>
        </div>
      )}

      {estudiantes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-3">No hay estudiantes en este curso</p>
          <Link href={`/dashboard/cursos/${cursoId}/estudiantes/importar`} className="btn-primary text-sm">
            Importar estudiantes
          </Link>
        </div>
      ) : (
        <PaseListaClient
          cursoId={cursoId}
          estudiantes={estudiantes}
          fecha={hoy}
          horasSesion={horasSesion}
          perfiles={perfiles}
        />
      )}
    </div>
  )
}
