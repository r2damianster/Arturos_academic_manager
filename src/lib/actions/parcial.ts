'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ResumenParcial {
  estudiantes_activos: number
  asistencia_global: number | null
  participacion_global: number | null
  encuesta_respondida: number
  encuesta_total: number
  trabajos_completados: number
  trabajos_activos: number
  notas_en_curso_completadas: number
  notas_en_curso_total: number
  por_estudiante: {
    id: string
    nombre: string
    pct_asistencia: number | null
    participacion_avg: number | null
    notas_en_curso_pct: number | null
    trabajos_activos: number
    tiene_encuesta: boolean
  }[]
}

export interface SnapshotParcial {
  id: string
  numero_parcial: number
  fecha_cierre: string
  semana_cierre: string | null
  resumen: ResumenParcial
}

export async function getSnapshotsParcial(cursoId: string): Promise<SnapshotParcial[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('snapshot_parcial')
    .select('id, numero_parcial, fecha_cierre, semana_cierre, resumen')
    .eq('curso_id', cursoId)
    .order('numero_parcial', { ascending: true })
  return (data ?? []) as SnapshotParcial[]
}

export async function cerrarParcial(
  cursoId: string,
  numeroParcial: number
): Promise<{ error?: string; snapshot?: SnapshotParcial }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verify ownership
  const { data: curso } = await db
    .from('cursos')
    .select('asignatura, fecha_inicio, fecha_fin')
    .eq('id', cursoId)
    .eq('profesor_id', user.id)
    .single()
  if (!curso) return { error: 'Curso no encontrado' }

  // Check no existing snapshot for this parcial
  const { data: existing } = await db
    .from('snapshot_parcial')
    .select('id')
    .eq('curso_id', cursoId)
    .eq('numero_parcial', numeroParcial)
    .single()
  if (existing) return { error: `El parcial ${numeroParcial} ya fue cerrado` }

  // Fetch all data in parallel
  const [estudiantesRes, asistenciaRes, participacionRes, trabajosRes, notasEnCursoRes, encuestaParcialRes, semanaRes] = await Promise.all([
    db.from('estudiantes').select('id, nombre').eq('curso_id', cursoId).eq('estado', 'activo'),
    db.from('asistencia').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('participacion').select('estudiante_id, nivel').eq('curso_id', cursoId),
    db.from('trabajos_asignados').select('estudiante_id, estado').eq('curso_id', cursoId),
    db.from('calificaciones_items').select('estudiante_id, nota').eq('curso_id', cursoId).eq('fuente', 'en_curso'),
    db.from('encuesta_parcial').select('estudiante_id').eq('curso_id', cursoId).eq('tipo', 'mitad'),
    db.rpc('calcular_semana', { p_curso_id: cursoId }),
  ])

  const estudiantes: { id: string; nombre: string }[] = estudiantesRes.data ?? []
  const asistencias: { estudiante_id: string; estado: string }[] = asistenciaRes.data ?? []
  const participaciones: { estudiante_id: string; nivel: number }[] = participacionRes.data ?? []
  const trabajos: { estudiante_id: string; estado: string }[] = trabajosRes.data ?? []
  const notasEnCurso: { estudiante_id: string; nota: number | null }[] = notasEnCursoRes.data ?? []
  const encuestasRespondidas = new Set<string>((encuestaParcialRes.data ?? []).map((e: { estudiante_id: string }) => e.estudiante_id))

  // Compute per-student maps
  const asistMap: Record<string, { total: number; presentes: number }> = {}
  for (const a of asistencias) {
    if (!asistMap[a.estudiante_id]) asistMap[a.estudiante_id] = { total: 0, presentes: 0 }
    asistMap[a.estudiante_id].total++
    if (a.estado === 'Presente') asistMap[a.estudiante_id].presentes++
  }

  const participMap: Record<string, number[]> = {}
  for (const p of participaciones) {
    if (!participMap[p.estudiante_id]) participMap[p.estudiante_id] = []
    participMap[p.estudiante_id].push(p.nivel)
  }

  const trabajosMap: Record<string, { activos: number; completados: number }> = {}
  for (const t of trabajos) {
    if (!trabajosMap[t.estudiante_id]) trabajosMap[t.estudiante_id] = { activos: 0, completados: 0 }
    if (t.estado === 'Pendiente' || t.estado === 'En progreso') trabajosMap[t.estudiante_id].activos++
    if (t.estado === 'Completado' || t.estado === 'Entregado') trabajosMap[t.estudiante_id].completados++
  }

  const notasMap: Record<string, { total: number; completadas: number }> = {}
  for (const n of notasEnCurso) {
    if (!notasMap[n.estudiante_id]) notasMap[n.estudiante_id] = { total: 0, completadas: 0 }
    notasMap[n.estudiante_id].total++
    if (n.nota !== null) notasMap[n.estudiante_id].completadas++
  }

  // Build per-student snapshot
  const porEstudiante = estudiantes.map(est => {
    const asist = asistMap[est.id]
    const pctAsistencia = asist && asist.total > 0
      ? Math.round((asist.presentes / asist.total) * 100)
      : null
    const niveles = participMap[est.id] ?? []
    const participacionAvg = niveles.length > 0
      ? Math.round((niveles.reduce((s, n) => s + n, 0) / niveles.length) * 10) / 10
      : null
    const notas = notasMap[est.id]
    const notasEnCursoPct = notas && notas.total > 0
      ? Math.round((notas.completadas / notas.total) * 100)
      : null

    return {
      id: est.id,
      nombre: est.nombre,
      pct_asistencia: pctAsistencia,
      participacion_avg: participacionAvg,
      notas_en_curso_pct: notasEnCursoPct,
      trabajos_activos: trabajosMap[est.id]?.activos ?? 0,
      tiene_encuesta: encuestasRespondidas.has(est.id),
    }
  })

  // Aggregate globals
  const conAsist = porEstudiante.filter(e => e.pct_asistencia !== null)
  const asistenciaGlobal = conAsist.length > 0
    ? Math.round(conAsist.reduce((s, e) => s + (e.pct_asistencia ?? 0), 0) / conAsist.length)
    : null
  const conPartic = porEstudiante.filter(e => e.participacion_avg !== null)
  const participacionGlobal = conPartic.length > 0
    ? Math.round((conPartic.reduce((s, e) => s + (e.participacion_avg ?? 0), 0) / conPartic.length) * 10) / 10
    : null

  let totalTrabajosActivos = 0, totalTrabajosCompletados = 0
  for (const v of Object.values(trabajosMap)) {
    totalTrabajosActivos += v.activos
    totalTrabajosCompletados += v.completados
  }
  let totalNotasCompletadas = 0, totalNotasTotal = 0
  for (const v of Object.values(notasMap)) {
    totalNotasCompletadas += v.completadas
    totalNotasTotal += v.total
  }

  const resumen: ResumenParcial = {
    estudiantes_activos: estudiantes.length,
    asistencia_global: asistenciaGlobal,
    participacion_global: participacionGlobal,
    encuesta_respondida: encuestasRespondidas.size,
    encuesta_total: estudiantes.length,
    trabajos_completados: totalTrabajosCompletados,
    trabajos_activos: totalTrabajosActivos,
    notas_en_curso_completadas: totalNotasCompletadas,
    notas_en_curso_total: totalNotasTotal,
    por_estudiante: porEstudiante,
  }

  const { data: snapshot, error } = await db
    .from('snapshot_parcial')
    .insert({
      profesor_id: user.id,
      curso_id: cursoId,
      numero_parcial: numeroParcial,
      semana_cierre: semanaRes.data ?? null,
      resumen,
    })
    .select('id, numero_parcial, fecha_cierre, semana_cierre, resumen')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  return { snapshot: snapshot as SnapshotParcial }
}

export async function eliminarSnapshot(snapshotId: string, cursoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('snapshot_parcial')
    .delete()
    .eq('id', snapshotId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  return {}
}
