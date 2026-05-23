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
    num_parciales: true,
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
