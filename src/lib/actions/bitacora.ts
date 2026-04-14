'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActividadPlanificada } from '@/types/domain'

const BitacoraSchema = z.object({
  tema:          z.string().min(1, 'El tema es obligatorio'),
  actividades:   z.string().optional(),
  materiales:    z.string().optional(),
  observaciones: z.string().optional(),
  fecha:         z.string().optional(),
})

export async function guardarBitacoraData(
  cursoId: string,
  data: { tema: string; actividades?: string; materiales?: string; observaciones?: string; fecha: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: semanaData } = await supabase.rpc('calcular_semana', { p_curso_id: cursoId })

  const { error } = await supabase.from('bitacora_clase').insert({
    ...data,
    profesor_id: user.id,
    curso_id: cursoId,
    semana: semanaData ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/bitacora`)
  return {}
}

export async function guardarBitacora(cursoId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const parsed = BitacoraSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { data: semanaData } = await supabase.rpc('calcular_semana', { p_curso_id: cursoId })

  await supabase.from('bitacora_clase').insert({
    ...parsed.data,
    profesor_id: user.id,
    curso_id: cursoId,
    fecha: parsed.data.fecha || new Date().toISOString().split('T')[0],
    semana: semanaData ?? null,
  })

  revalidatePath(`/dashboard/cursos/${cursoId}/bitacora`)
  redirect(`/dashboard/cursos/${cursoId}/bitacora`)
}

// ─── Módulo de planificación ──────────────────────────────────────────────────

export type PlanificacionData = {
  tema: string
  actividades_json: ActividadPlanificada[]
  observaciones?: string | null
}

/**
 * Crea o actualiza la planificación de una clase para una fecha dada.
 * Si ya existe una bitácora para ese curso+fecha, la actualiza.
 * Si no existe, la crea con estado='planificado'.
 */
export async function guardarPlanificacion(
  cursoId: string,
  fecha: string,
  data: PlanificacionData
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: semanaData } = await supabase.rpc('calcular_semana', { p_curso_id: cursoId })

  // Buscar bitácora existente para este curso+fecha
  const { data: existing } = await supabase
    .from('bitacora_clase')
    .select('id, estado')
    .eq('curso_id', cursoId)
    .eq('fecha', fecha)
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Actualizar sin cambiar estado si ya está cumplido
    const { error } = await supabase
      .from('bitacora_clase')
      .update({
        tema: data.tema,
        actividades_json: data.actividades_json,
        observaciones: data.observaciones ?? null,
        // Preservar 'cumplido' si ya fue tomada la lista
        estado: existing.estado === 'cumplido' ? 'cumplido' : 'planificado',
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/agenda')
    return { id: existing.id }
  }

  // Crear nueva
  const { data: created, error } = await supabase
    .from('bitacora_clase')
    .insert({
      profesor_id: user.id,
      curso_id: cursoId,
      fecha,
      semana: semanaData ?? null,
      tema: data.tema,
      actividades_json: data.actividades_json,
      observaciones: data.observaciones ?? null,
      estado: 'planificado',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  return { id: created.id }
}

/**
 * Marca una bitácora como cumplida (actividades confirmadas durante el pase de lista).
 * Permite actualizar tema/actividades/observaciones al confirmar.
 */
export async function confirmarCumplido(
  bitacoraId: string,
  data?: Partial<PlanificacionData>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const update: Record<string, unknown> = { estado: 'cumplido' }
  if (data?.tema) update.tema = data.tema
  if (data?.actividades_json) update.actividades_json = data.actividades_json
  if (data?.observaciones !== undefined) update.observaciones = data.observaciones

  const { error } = await supabase
    .from('bitacora_clase')
    .update(update)
    .eq('id', bitacoraId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  return {}
}

// ─── Módulo de replplanificación ─────────────────────────────────────────────

export type ReplanificarResult = {
  error?: string
  success?: boolean
  modo?: 'merge' | 'shift'
  /** IDs de bitácoras que fueron desplazadas (shift) */
  shiftedIds?: string[]
  /** ID de la bitácora destino que fue eliminada (merge) */
  mergedOriginId?: string
  /** Info sobre conflicto si el destino ya tenía contenido */
  conflictInfo?: { targetFecha: string; existingTema: string; existingEstado: string }
}

/**
 * Mueve una planificación de una fecha a otra dentro del mismo curso.
 *
 * @param modo - 'merge': fusiona actividades en destino y borra origen
 *               - 'shift': desplaza en cascada hasta encontrar hueco vacío
 *
 * Shift en cascada:
 * 1. Obtiene todas las fechas del curso entre fechaInicioCurso y fechaFin
 * 2. Filtra solo los días que coinciden con horarios_clases del curso
 * 3. Encuentra el slot destino y siguientes
 * 4. Desplaza cada bitácora al siguiente slot hasta encontrar uno vacío
 * 5. Si llega al fin del semestre sin hueco, retorna error
 */
export async function replanificarClase(params: {
  cursoId: string
  origenFecha: string  // YYYY-MM-DD
  destinoFecha: string // YYYY-MM-DD
  modo: 'merge' | 'shift'
}): Promise<ReplanificarResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { cursoId, origenFecha, destinoFecha, modo } = params

  // 1. Validar que origenFecha existe y está 'planificado'
  const { data: origen, error: errOrigen } = await supabase
    .from('bitacora_clase')
    .select('*')
    .eq('curso_id', cursoId)
    .eq('fecha', origenFecha)
    .eq('profesor_id', user.id)
    .maybeSingle()

  if (errOrigen) return { error: errOrigen.message }
  if (!origen) return { error: 'No hay planificación en la fecha de origen' }
  if (origen.estado === 'cumplido') return { error: 'No se puede mover una clase ya tomada (estado=cumplido)' }

  // 2. Validar que destinoFecha no es fecha pasada
  const today = new Date().toISOString().split('T')[0]
  if (destinoFecha < today) return { error: 'No se puede mover a una fecha pasada' }

  // 3. Buscar si ya existe bitácora en destino
  const { data: destino } = await supabase
    .from('bitacora_clase')
    .select('*')
    .eq('curso_id', cursoId)
    .eq('fecha', destinoFecha)
    .eq('profesor_id', user.id)
    .maybeSingle()

  // ─── MODO MERGE ────────────────────────────────────────────────────────
  if (modo === 'merge') {
    if (!destino) {
      // No hay conflicto, simplemente mover
      const { error } = await supabase
        .from('bitacora_clase')
        .update({ fecha: destinoFecha })
        .eq('id', origen.id)
      if (error) return { error: error.message }
      revalidatePath('/dashboard/agenda')
      return { success: true, modo: 'merge' }
    }

    // Fusionar: concatenar actividades_json, borrar origen
    const origenActs = Array.isArray(origen.actividades_json) ? origen.actividades_json : []
    const destinoActs = Array.isArray(destino.actividades_json) ? destino.actividades_json : []
    const mergedActs = [...origenActs, ...destinoActs]

    const mergedTema = `${origen.tema} + ${destino.tema}`

    const { error: errUpd } = await supabase
      .from('bitacora_clase')
      .update({
        tema: mergedTema,
        actividades_json: mergedActs,
        observaciones: destino.observaciones
          ? `${destino.observaciones}\n---\n${origen.observaciones ?? ''}`.trim()
          : origen.observaciones,
      })
      .eq('id', destino.id)

    if (errUpd) return { error: errUpd.message }

    const { error: errDel } = await supabase
      .from('bitacora_clase')
      .delete()
      .eq('id', origen.id)

    if (errDel) return { error: errDel.message }

    revalidatePath('/dashboard/agenda')
    return { success: true, modo: 'merge', mergedOriginId: origen.id }
  }

  // ─── MODO SHIFT ────────────────────────────────────────────────────────

  if (!destino) {
    // No hay conflicto, simplemente mover
    const { error } = await supabase
      .from('bitacora_clase')
      .update({ fecha: destinoFecha })
      .eq('id', origen.id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/agenda')
    return { success: true, modo: 'shift' }
  }

  // Hay conflicto → shift en cascada
  // 1. Obtener fecha_fin del curso para saber hasta dónde desplazar
  const { data: curso } = await supabase
    .from('cursos')
    .select('fecha_fin, fecha_inicio')
    .eq('id', cursoId)
    .single()

  if (!curso?.fecha_fin) return { error: 'El curso no tiene fecha_fin definida. No se puede hacer shift.' }

  // 2. Obtener horarios del curso para generar slots válidos
  const { data: horarios } = await supabase
    .from('horarios_clases')
    .select('dia_semana')
    .eq('curso_id', cursoId)

  if (!horarios || horarios.length === 0) return { error: 'El curso no tiene horarios definidos.' }

  const diasSemana = horarios.map((h) => h.dia_semana)

  // 3. Generar todas las fechas válidas entre destinoFecha y fecha_fin
  const validSlots: string[] = []
  const current = new Date(destinoFecha)
  const end = new Date(curso.fecha_fin)

  while (current <= end) {
    const dayName = DIAS_ES[current.getDay()]
    if (diasSemana.includes(dayName)) {
      validSlots.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }

  // 4. Encontrar índice del destino y recolectar bitácoras en cascada
  const destIdx = validSlots.indexOf(destinoFecha)
  if (destIdx === -1) return { error: 'La fecha destino no coincide con un horario del curso.' }

  // Recolectar bitácoras existentes desde destino en adelante
  const { data: bitacorasEnRango } = await supabase
    .from('bitacora_clase')
    .select('id, fecha')
    .eq('curso_id', cursoId)
    .eq('profesor_id', user.id)
    .in('fecha', validSlots.slice(destIdx))

  const bitacorasMap = new Map<string, string>() // fecha -> id
  for (const b of (bitacorasEnRango ?? [])) {
    bitacorasMap.set(b.fecha, b.id)
  }

  // 5. Buscar primer hueco vacío después del destino
  let primerHuecoIdx = -1
  for (let i = destIdx; i < validSlots.length; i++) {
    if (!bitacorasMap.has(validSlots[i])) {
      primerHuecoIdx = i
      break
    }
  }

  if (primerHuecoIdx === -1) {
    return { error: 'No hay slots vacíos restantes en el semestre para hacer el desplazamiento.' }
  }

  // 6. Desplazar en cascada desde el último ocupado hacia adelante
  const occupiedSlots = validSlots.slice(destIdx, primerHuecoIdx).filter(f => bitacorasMap.has(f))
  const shiftedIds: string[] = []

  // Desplazar de atrás hacia adelante para evitar conflictos de FK
  for (let i = occupiedSlots.length - 1; i >= 0; i--) {
    const fechaActual = occupiedSlots[i]
    const fechaSiguiente = validSlots[destIdx + i + 1]
    const bitacoraId = bitacorasMap.get(fechaActual)

    if (bitacoraId && fechaSiguiente) {
      const { error } = await supabase
        .from('bitacora_clase')
        .update({ fecha: fechaSiguiente })
        .eq('id', bitacoraId)
      if (error) return { error: `Error desplazando ${fechaActual}: ${error.message}` }
      shiftedIds.push(bitacoraId)
    }
  }

  // 7. Ahora mover origen a destino (que quedó libre)
  const { error: errMove } = await supabase
    .from('bitacora_clase')
    .update({ fecha: destinoFecha })
    .eq('id', origen.id)

  if (errMove) return { error: errMove.message }

  revalidatePath('/dashboard/agenda')
  return { success: true, modo: 'shift', shiftedIds }
}

// Mapa de día JS → nombre en español (como está en horarios_clases)
const DIAS_ES: Record<number, string> = {
  0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miércoles',
  4: 'jueves', 5: 'viernes', 6: 'sábado',
}

// ─── Copiar planificación ─────────────────────────────────────────────────────

/**
 * Copia la planificación de una clase (curso+fecha fuente) a otro curso+fecha.
 * Valida que el curso destino tenga clase el día de la semana de destFecha.
 */
export async function copiarPlanificacion(params: {
  sourceCursoId: string
  sourceFecha: string
  destCursoId: string
  destFecha: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { sourceCursoId, sourceFecha, destCursoId, destFecha } = params

  // 1. Leer bitácora fuente
  const { data: fuente, error: errFuente } = await supabase
    .from('bitacora_clase')
    .select('tema, actividades_json, observaciones')
    .eq('curso_id', sourceCursoId)
    .eq('fecha', sourceFecha)
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errFuente) return { error: errFuente.message }
  if (!fuente) return { error: 'No hay plan en la fecha de origen' }

  // 2. Validar que el curso destino tiene clase el día de la semana de destFecha
  // new Date(YYYY-MM-DD) en UTC → getUTCDay() evita desfase de zona horaria
  const fechaDestObj = new Date(destFecha + 'T12:00:00')
  const diaDestino = DIAS_ES[fechaDestObj.getDay()]

  const { data: horarios, error: errHorarios } = await supabase
    .from('horarios_clases')
    .select('id')
    .eq('curso_id', destCursoId)
    .eq('dia_semana', diaDestino)
    .neq('tipo', 'tutoria_curso')
    .limit(1)

  if (errHorarios) return { error: errHorarios.message }
  if (!horarios || horarios.length === 0) {
    return { error: 'El curso destino no tiene clase ese día' }
  }

  // 3. Copiar usando guardarPlanificacion
  const actividadesJson = Array.isArray(fuente.actividades_json)
    ? (fuente.actividades_json as ActividadPlanificada[])
    : []

  return guardarPlanificacion(destCursoId, destFecha, {
    tema: fuente.tema ?? '',
    actividades_json: actividadesJson,
    observaciones: fuente.observaciones,
  })
}

/**
 * Mueve la planificación de una clase a otro curso+fecha (copia y elimina el original).
 */
export async function moverPlanificacion(params: {
  sourceCursoId: string
  sourceFecha: string
  destCursoId: string
  destFecha: string
}): Promise<{ error?: string; id?: string }> {
  const result = await copiarPlanificacion(params)
  if (result.error) return result

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  await supabase
    .from('bitacora_clase')
    .delete()
    .eq('curso_id', params.sourceCursoId)
    .eq('fecha', params.sourceFecha)
    .eq('profesor_id', user.id)

  revalidatePath('/dashboard/agenda')
  return result
}
