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
})

type HorarioInput = {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo?: string
  centro_computo?: boolean
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
  }))
}

// ─── Crear curso ──────────────────────────────────────────────────────────────

export async function crearCursoAction(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const raw = Object.fromEntries(formData)
  const parsed = CursoFullSchema.safeParse(raw)
  if (!parsed.success) return

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { aula: _aula, nombres_tareas, ...fields } = parsed.data
  const { data: curso, error } = await supabase.from('cursos')
    .insert({
      ...fields,
      aula: parsed.data.aula || null,
      fecha_inicio: parsed.data.fecha_inicio || null,
      fecha_fin: parsed.data.fecha_fin || null,
      institucion: parsed.data.institucion || null,
      observacion: parsed.data.observacion || null,
      profesor_id: user.id,
    })
    .select('id').single()

  if (error || !curso) return

  const horariosJson = formData.get('horarios_clases') as string
  if (horariosJson) {
    try {
      const horarios: HorarioInput[] = JSON.parse(horariosJson)
      if (Array.isArray(horarios) && horarios.length > 0) {
        await supabase.from('horarios_clases').insert(buildHorariosInserts(horarios, curso.id, user.id))
      }
    } catch {
      // horarios_clases mal formados — continuar
    }
  }

  revalidatePath('/dashboard/cursos')
  revalidatePath('/dashboard')
  redirect('/dashboard/cursos')
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
