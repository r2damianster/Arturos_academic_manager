'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ActividadPlanificada } from '@/types/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

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

  const { data: semanaData } = await (supabase as AnySupabase).rpc('calcular_semana', { p_curso_id: cursoId })

  const { error } = await (supabase as AnySupabase).from('bitacora_clase').insert({
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

  const { data: semanaData } = await (supabase as AnySupabase).rpc('calcular_semana', { p_curso_id: cursoId })

  await (supabase as AnySupabase).from('bitacora_clase').insert({
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

  const db = supabase as AnySupabase

  const { data: semanaData } = await db.rpc('calcular_semana', { p_curso_id: cursoId })

  // Buscar bitácora existente para este curso+fecha
  const { data: existing } = await db
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
    const { error } = await db
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
  const { data: created, error } = await db
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

  const { error } = await (supabase as AnySupabase)
    .from('bitacora_clase')
    .update(update)
    .eq('id', bitacoraId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  return {}
}
