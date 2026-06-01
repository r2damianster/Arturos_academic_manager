'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ─── Schema canónico ──────────────────────────────────────────────────────────

const CursoFullSchema = z.object({
  codigo:         z.string().min(2).max(30),
  asignatura:     z.string().min(3).max(100),
  periodo:        z.string().min(3).max(20),
  institucion:    z.string().max(200).optional(),
  aula:           z.string().max(100).optional(),
  observacion:    z.string().max(500).optional(),
  fecha_inicio:   z.string().optional(),
  fecha_fin:      z.string().optional(),
  horas_semana:   z.coerce.number().int().min(1).max(200).default(64),
  num_sesiones:   z.coerce.number().int().min(1).max(200).default(32),
  horas_teoricas: z.coerce.number().int().min(1).max(200).default(64),
  num_parciales:  z.coerce.number().int().min(1).max(4).default(2),
  nombres_tareas: z.array(z.string().max(8)).length(4).optional(),
  encuesta_inicial_habilitada: z.boolean().optional(),
  encuesta_parcial_habilitada: z.boolean().optional(),
  tipo:           z.enum(['regular', 'tutorados']).optional(),
})

type HorarioInput = {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo?: string
  centro_computo?: boolean
  obligatoria?: boolean
}

function buildHorariosInserts(horarios: HorarioInput[], cursoId: string, profesorId: string) {
  return horarios.map(h => ({
    curso_id: cursoId,
    profesor_id: profesorId,
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fin: h.hora_fin,
    tipo: h.tipo || 'clase',
    centro_computo: h.centro_computo ?? false,
    obligatoria: h.obligatoria ?? false,
  }))
}

// ─── Crear curso (base — solo info, devuelve id para wizard) ─────────────────

export async function crearCursoBase(
  formData: FormData
): Promise<{ cursoId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = CursoFullSchema.pick({
    codigo: true, asignatura: true, periodo: true,
    institucion: true, aula: true, observacion: true,
    num_parciales: true, tipo: true,
  }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }

  const { data: curso, error } = await supabase.from('cursos')
    .insert({
      codigo:      parsed.data.codigo,
      asignatura:  parsed.data.asignatura,
      periodo:     parsed.data.periodo,
      institucion: parsed.data.institucion || null,
      aula:        parsed.data.aula || null,
      observacion: parsed.data.observacion || null,
      num_parciales: parsed.data.num_parciales ?? 2,
      tipo:        parsed.data.tipo ?? 'regular',
      profesor_id: user.id,
    })
    .select('id').single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/cursos')
  revalidatePath('/dashboard')
  return { cursoId: curso.id }
}

// ─── Actualizar curso (canónico — todos los tabs) ─────────────────────────────

export async function actualizarCurso(
  cursoId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const raw = Object.fromEntries(formData)

  // Convertir campos booleanos enviados como '1'/'0' desde checkboxes
  if (raw.encuesta_inicial_habilitada !== undefined) {
    raw.encuesta_inicial_habilitada = (raw.encuesta_inicial_habilitada === '1' || raw.encuesta_inicial_habilitada === 'true') as unknown as string
  }
  if (raw.encuesta_parcial_habilitada !== undefined) {
    raw.encuesta_parcial_habilitada = (raw.encuesta_parcial_habilitada === '1' || raw.encuesta_parcial_habilitada === 'true') as unknown as string
  }

  // nombres_tareas viene como tarea1..tarea4 desde /calificaciones/config
  if (!raw.nombres_tareas && (raw.tarea1 || raw.tarea2 || raw.tarea3 || raw.tarea4)) {
    raw.nombres_tareas = JSON.stringify([
      (raw.tarea1 as string)?.trim() || 'ACD',
      (raw.tarea2 as string)?.trim() || 'TA',
      (raw.tarea3 as string)?.trim() || 'PE',
      (raw.tarea4 as string)?.trim() || 'EX',
    ])
  }

  // Parsear nombres_tareas si viene como JSON string
  if (typeof raw.nombres_tareas === 'string' && raw.nombres_tareas.startsWith('[')) {
    try { raw.nombres_tareas = JSON.parse(raw.nombres_tareas) } catch { /* ignorar */ }
  }

  const parsed = CursoFullSchema.partial().safeParse(raw)
  if (!parsed.success) return { error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }

  // Auto-limpieza cuando se reduce num_parciales
  if (parsed.data.num_parciales !== undefined) {
    const confirmacion = formData.get('confirmacion_borrado')
    const { data: cursoActual } = await supabase
      .from('cursos').select('num_parciales').eq('id', cursoId).single()

    const parcialesActuales = (cursoActual as { num_parciales: number | null } | null)?.num_parciales ?? 2
    if (parsed.data.num_parciales < parcialesActuales) {
      if (!confirmacion) return { error: 'Reducir parciales requiere confirmación' }
      const limpRes = await limpiarNotasParciales(cursoId, parsed.data.num_parciales + 1, parcialesActuales)
      if (limpRes.error) return limpRes
    }
  }

  // Construir objeto de update solo con campos presentes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  const d = parsed.data
  if (d.codigo         !== undefined) update.codigo         = d.codigo
  if (d.asignatura     !== undefined) update.asignatura     = d.asignatura
  if (d.periodo        !== undefined) update.periodo        = d.periodo
  if (d.institucion    !== undefined) update.institucion    = d.institucion || null
  if (d.aula           !== undefined) update.aula           = d.aula || null
  if (d.observacion    !== undefined) update.observacion    = d.observacion || null
  if (d.fecha_inicio   !== undefined) update.fecha_inicio   = d.fecha_inicio || null
  if (d.fecha_fin      !== undefined) update.fecha_fin      = d.fecha_fin || null
  if (d.horas_semana   !== undefined) update.horas_semana   = d.horas_semana
  if (d.num_sesiones   !== undefined) update.num_sesiones   = d.num_sesiones
  if (d.horas_teoricas !== undefined) update.horas_teoricas = d.horas_teoricas
  if (d.num_parciales  !== undefined) update.num_parciales  = d.num_parciales
  if (d.nombres_tareas !== undefined) update.nombres_tareas = d.nombres_tareas
  if (d.encuesta_inicial_habilitada !== undefined) update.encuesta_inicial_habilitada = d.encuesta_inicial_habilitada
  if (d.encuesta_parcial_habilitada !== undefined) update.encuesta_parcial_habilitada = d.encuesta_parcial_habilitada
  if (d.tipo                        !== undefined) update.tipo                        = d.tipo

  if (Object.keys(update).length === 0) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('cursos')
    .update(update)
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/cursos')
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  revalidatePath('/dashboard')
  return {}
}

// ─── Limpiar notas de parciales eliminados ────────────────────────────────────

export async function limpiarNotasParciales(
  cursoId: string,
  desde: number,
  hasta: number
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const update: Record<string, null> = {}
  for (let i = desde; i <= hasta; i++) {
    update[`acd${i}`] = null
    update[`ta${i}`]  = null
    update[`pe${i}`]  = null
    update[`ex${i}`]  = null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('calificaciones')
    .update(update)
    .eq('curso_id', cursoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  return {}
}

// ─── Actualizar horarios ──────────────────────────────────────────────────────

export async function actualizarHorariosCurso(
  cursoId: string,
  horarios: HorarioInput[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { data: curso } = await supabase
    .from('cursos').select('id').eq('id', cursoId).eq('profesor_id', user.id).single()
  if (!curso) return { ok: false, error: 'Curso no encontrado' }

  await supabase.from('horarios_clases').delete().eq('curso_id', cursoId)

  if (horarios.length > 0) {
    const { error } = await supabase
      .from('horarios_clases').insert(buildHorariosInserts(horarios, cursoId, user.id))
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard/tutorias')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── Eliminar curso ───────────────────────────────────────────────────────────

export async function eliminarCurso(cursoId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('cursos').delete().eq('id', cursoId).eq('profesor_id', user.id)

  revalidatePath('/dashboard/cursos')
  redirect('/dashboard/cursos')
}

// ─── Export dataset investigación ─────────────────────────────────────────────

export async function exportarDatasetInvestigacion(cursoId: string): Promise<{ csv?: string; error?: string }> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    // Verificar que el curso pertenece al profesor
    const { data: curso } = await db.from('cursos').select('id, asignatura').eq('id', cursoId).eq('profesor_id', user.id).single()
    if (!curso) return { error: 'Curso no encontrado' }

    const [estudiantesRes, asistenciaRes, participacionRes, trabajosRes, notasEnCursoRes, encuestaParcialRes] = await Promise.all([
      db.from('estudiantes').select('id').eq('curso_id', cursoId).eq('estado', 'activo'),
      db.from('asistencia').select('estudiante_id, estado').eq('curso_id', cursoId),
      db.from('participacion').select('estudiante_id, nivel').eq('curso_id', cursoId),
      db.from('trabajos_asignados').select('estudiante_id, estado').eq('curso_id', cursoId),
      db.from('calificaciones_items').select('estudiante_id, nota').eq('curso_id', cursoId).eq('fuente', 'en_curso'),
      db.from('encuesta_parcial').select('estudiante_id, autopercepcion_aprendizaje, esfuerzo_dedicado, comprension_temas_propia, preparacion_evaluacion, cumplimiento_entregas').eq('curso_id', cursoId),
    ])

    const estudiantes: { id: string }[] = estudiantesRes.data ?? []
    const asistencias: { estudiante_id: string; estado: string }[] = asistenciaRes.data ?? []
    const participaciones: { estudiante_id: string; nivel: number }[] = participacionRes.data ?? []
    const trabajos: { estudiante_id: string; estado: string }[] = trabajosRes.data ?? []
    const notasItems: { estudiante_id: string; nota: number | null }[] = notasEnCursoRes.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encuestas: any[] = encuestaParcialRes.data ?? []

    // Mapas por estudiante
    const asistMap: Record<string, { presentes: number; total: number }> = {}
    for (const a of asistencias) {
      if (!asistMap[a.estudiante_id]) asistMap[a.estudiante_id] = { presentes: 0, total: 0 }
      asistMap[a.estudiante_id].total++
      if (a.estado === 'Presente') asistMap[a.estudiante_id].presentes++
    }
    const partMap: Record<string, number[]> = {}
    for (const p of participaciones) {
      if (!partMap[p.estudiante_id]) partMap[p.estudiante_id] = []
      partMap[p.estudiante_id].push(p.nivel)
    }
    const trabajosMap: Record<string, { completados: number; activos: number }> = {}
    for (const t of trabajos) {
      if (!trabajosMap[t.estudiante_id]) trabajosMap[t.estudiante_id] = { completados: 0, activos: 0 }
      if (t.estado === 'Aprobado' || t.estado === 'Entregado') trabajosMap[t.estudiante_id].completados++
      if (t.estado === 'Pendiente' || t.estado === 'En progreso') trabajosMap[t.estudiante_id].activos++
    }
    const notasMap: Record<string, { total: number; completadas: number }> = {}
    for (const n of notasItems) {
      if (!notasMap[n.estudiante_id]) notasMap[n.estudiante_id] = { total: 0, completadas: 0 }
      notasMap[n.estudiante_id].total++
      if (n.nota !== null) notasMap[n.estudiante_id].completadas++
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encuestaMap: Record<string, any> = {}
    for (const e of encuestas) encuestaMap[e.estudiante_id] = e

    const header = 'id_anonimizado,asistencia_pct,participacion_avg,trabajos_completados,trabajos_activos,notas_en_curso_pct,autopercepcion_aprendizaje,esfuerzo_dedicado,comprension_temas_propia,preparacion_evaluacion,cumplimiento_entregas'
    const rows = estudiantes.map(est => {
      const asist = asistMap[est.id]
      const asistPct = asist && asist.total > 0 ? Math.round((asist.presentes / asist.total) * 100) : ''
      const niveles = partMap[est.id] ?? []
      const partAvg = niveles.length > 0 ? Math.round(niveles.reduce((s, n) => s + n, 0) / niveles.length * 10) / 10 : ''
      const trab = trabajosMap[est.id]
      const notas = notasMap[est.id]
      const notasPct = notas && notas.total > 0 ? Math.round((notas.completadas / notas.total) * 100) : ''
      const enc = encuestaMap[est.id]
      return [
        est.id.slice(0, 8),
        asistPct,
        partAvg,
        trab?.completados ?? '',
        trab?.activos ?? '',
        notasPct,
        enc?.autopercepcion_aprendizaje ?? '',
        enc?.esfuerzo_dedicado ?? '',
        enc?.comprension_temas_propia ?? '',
        enc?.preparacion_evaluacion ?? '',
        enc?.cumplimiento_entregas ?? '',
      ].join(',')
    })

    return { csv: [header, ...rows].join('\n') }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// ─── Alertas silenciadas ──────────────────────────────────────────────────────

type TipoAlerta = 'riesgo' | 'encuesta_parcial'

async function _getAlertasSilenciadas(db: ReturnType<typeof Object.create>, cursoId: string, userId: string) {
  const { data } = await db.from('cursos')
    .select('alertas_silenciadas')
    .eq('id', cursoId)
    .eq('profesor_id', userId)
    .single()
  return (data?.alertas_silenciadas ?? {}) as Record<string, unknown>
}

export async function silenciarAlerta(
  cursoId: string,
  tipo: TipoAlerta,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const actual = await _getAlertasSilenciadas(db, cursoId, user.id)
    const nuevo = { ...actual, [tipo]: true }

    const { error } = await db.from('cursos')
      .update({ alertas_silenciadas: nuevo })
      .eq('id', cursoId)
      .eq('profesor_id', user.id)
    if (error) return { error: error.message }

    revalidatePath(`/dashboard/cursos/${cursoId}`)
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function restaurarAlerta(
  cursoId: string,
  tipo?: TipoAlerta,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    let nuevo: Record<string, unknown>
    if (tipo) {
      const actual = await _getAlertasSilenciadas(db, cursoId, user.id)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tipo]: _removed, ...rest } = actual
      nuevo = rest
    } else {
      nuevo = {}
    }

    const { error } = await db.from('cursos')
      .update({ alertas_silenciadas: nuevo })
      .eq('id', cursoId)
      .eq('profesor_id', user.id)
    if (error) return { error: error.message }

    revalidatePath(`/dashboard/cursos/${cursoId}`)
    revalidatePath(`/dashboard/cursos/${cursoId}/editar`)
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function excluirEstudianteDeRiesgo(
  cursoId: string,
  estudianteId: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const actual = await _getAlertasSilenciadas(db, cursoId, user.id)
    const excluidos = Array.isArray(actual.riesgo_excluidos) ? actual.riesgo_excluidos as string[] : []
    if (!excluidos.includes(estudianteId)) excluidos.push(estudianteId)
    const nuevo = { ...actual, riesgo_excluidos: excluidos }

    const { error } = await db.from('cursos')
      .update({ alertas_silenciadas: nuevo })
      .eq('id', cursoId)
      .eq('profesor_id', user.id)
    if (error) return { error: error.message }

    revalidatePath(`/dashboard/cursos/${cursoId}`)
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function reincluirEstudianteEnRiesgo(
  cursoId: string,
  estudianteId: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const actual = await _getAlertasSilenciadas(db, cursoId, user.id)
    const excluidos = Array.isArray(actual.riesgo_excluidos) ? actual.riesgo_excluidos as string[] : []
    const nuevo = { ...actual, riesgo_excluidos: excluidos.filter(id => id !== estudianteId) }

    const { error } = await db.from('cursos')
      .update({ alertas_silenciadas: nuevo })
      .eq('id', cursoId)
      .eq('profesor_id', user.id)
    if (error) return { error: error.message }

    revalidatePath(`/dashboard/cursos/${cursoId}`)
    revalidatePath(`/dashboard/cursos/${cursoId}/editar`)
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error' }
  }
}
