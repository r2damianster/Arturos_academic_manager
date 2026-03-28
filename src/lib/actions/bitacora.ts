'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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
