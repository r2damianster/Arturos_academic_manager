import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalificacionesTabs } from '@/components/calificaciones/calificaciones-tabs'
import { calcularHorasDesdeHorario } from '@/lib/moodle-csv'

export default async function CalificacionesPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, califRes, participacionRes, asistenciaRes, itemsRes, importsRes, bitacorasRes, horariosRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo, num_parciales, nombres_tareas').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email, auth_user_id').eq('curso_id', cursoId).eq('estado', 'activo').order('nombre'),
    db.from('calificaciones').select('*').eq('curso_id', cursoId),
    db.from('participacion')
      .select('id, estudiante_id, fecha, semana, nivel, observacion')
      .eq('curso_id', cursoId)
      .order('fecha', { ascending: true }),
    db.from('asistencia')
      .select('estudiante_id, estado, atraso, fecha')
      .eq('curso_id', cursoId)
      .order('fecha'),
    db.from('calificaciones_items')
      .select('id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, fuente, updated_at')
      .eq('curso_id', cursoId)
      .order('parcial', { ascending: true })
      .order('nombre_item', { ascending: true }),
    db.from('calificaciones_imports')
      .select('id, archivo_nombre, created_at, parciales_afectados, columnas_importadas, num_estudiantes_match, num_estudiantes_sin_match, num_celdas_creadas, num_celdas_actualizadas, num_celdas_sin_cambio, num_celdas_preservadas, revertido_at')
      .eq('curso_id', cursoId)
      .order('created_at', { ascending: false }),
    db.from('bitacora_clase').select('fecha').eq('curso_id', cursoId).eq('estado', 'cumplido'),
    db.from('horarios_clases').select('dia_semana, hora_inicio, hora_fin').eq('curso_id', cursoId),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data
  const estudiantes = estudiantesRes.data ?? []
  const calificaciones = califRes.data ?? []
  const participacion = participacionRes.data ?? []
  const asistencia = asistenciaRes.data ?? []
  const calificacionesItems = itemsRes.data ?? []
  const imports = importsRes.data ?? []

  // Grid data for asistencia tab
  const bitacoraFechas: string[] = (bitacorasRes.data ?? []).map((b: any) => b.fecha)
  const fechasAsistencia = Array.from(new Set([
    ...asistencia.map((r: any) => r.fecha).filter(Boolean),
    ...bitacoraFechas,
  ])).sort() as string[]

  const mapaAsistenciaFechas: Record<string, Record<string, { estado: string }>> = {}
  for (const reg of asistencia) {
    if (!reg.fecha) continue
    if (!mapaAsistenciaFechas[reg.estudiante_id]) mapaAsistenciaFechas[reg.estudiante_id] = {}
    mapaAsistenciaFechas[reg.estudiante_id][reg.fecha] = { estado: reg.estado }
  }

  const horasPorDia: Record<string, number> = {}
  for (const h of (horariosRes.data ?? []) as { dia_semana: string; hora_inicio: string; hora_fin: string }[]) {
    horasPorDia[h.dia_semana] = calcularHorasDesdeHorario(h.hora_inicio, h.hora_fin)
  }

  const asistenciaMap: Record<string, {
    total_sesiones: number
    presentes: number
    ausentes: number
    atrasos: number
    porcentaje: number | null
  }> = {}

  for (const registro of asistencia) {
    const estudianteId = registro.estudiante_id
    if (!asistenciaMap[estudianteId]) {
      asistenciaMap[estudianteId] = {
        total_sesiones: 0,
        presentes: 0,
        ausentes: 0,
        atrasos: 0,
        porcentaje: null,
      }
    }

    const stats = asistenciaMap[estudianteId]
    stats.total_sesiones += 1
    if (registro.estado === 'Presente') stats.presentes += 1
    if (registro.estado === 'Ausente') stats.ausentes += 1
    if (registro.atraso) stats.atrasos += 1
  }

  for (const estudianteId of Object.keys(asistenciaMap)) {
    const stats = asistenciaMap[estudianteId]
    stats.porcentaje = stats.total_sesiones > 0
      ? Math.round((stats.presentes / stats.total_sesiones) * 1000) / 10
      : null
  }

  const authIds = estudiantes.map((e: any) => e.auth_user_id).filter(Boolean)
  const encuestasRes = authIds.length > 0
    ? await db.from('encuesta_estudiante')
        .select('auth_user_id, tiene_laptop, tiene_pc_escritorio, comparte_pc, trabaja, tipo_trabajo, situacion_vivienda, es_foraneo, problemas_reportados, nivel_tecnologia, modalidad_carrera')
        .in('auth_user_id', authIds)
    : { data: [] }
  const encuestas: any[] = encuestasRes.data ?? []
  const authToEstId: Record<string, string> = {}
  for (const e of estudiantes as any[]) if (e.auth_user_id) authToEstId[e.auth_user_id] = e.id
  const perfilesMap: Record<string, any> = {}
  for (const enc of encuestas) {
    const estId = authToEstId[enc.auth_user_id]
    if (estId) perfilesMap[estId] = enc
  }

  const mapaCalif: Record<string, any> = {}
  for (const c of calificaciones) mapaCalif[c.estudiante_id] = c

  const numParciales: number = curso.num_parciales ?? 2
  const nombresTareas: string[] = Array.isArray(curso.nombres_tareas)
    ? curso.nombres_tareas
    : ['ACD', 'TA', 'PE', 'EX']

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Evaluaciones</h1>
            <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo}</p>
          </div>
        </div>
        <Link href={`/dashboard/cursos/${cursoId}/calificaciones/config`} className="btn-ghost text-sm">
          ⚙ Configurar
        </Link>
      </div>

      {estudiantes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay estudiantes en este curso.</p>
        </div>
      ) : (
        <CalificacionesTabs
          cursoId={cursoId}
          cursoCodigo={curso.codigo}
          estudiantes={estudiantes}
          calificaciones={mapaCalif}
          numParciales={numParciales}
          nombresTareas={nombresTareas}
          perfiles={perfilesMap}
          participacion={participacion}
          asistenciaMap={asistenciaMap}
          calificacionesItems={calificacionesItems}
          imports={imports}
          fechas={fechasAsistencia}
          mapaAsistencia={mapaAsistenciaFechas}
          horasPorDia={horasPorDia}
        />
      )}
    </div>
  )
}
