'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function upsertCalificaciones(
  cursoId: string,
  estudianteId: string,
  data: Partial<{
    acd1: number; ta1: number; pe1: number; ex1: number
    acd2: number; ta2: number; pe2: number; ex2: number
    acd3: number; ta3: number; pe3: number; ex3: number
    acd4: number; ta4: number; pe4: number; ex4: number
  }>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones')
    .upsert(
      { profesor_id: user.id, curso_id: cursoId, estudiante_id: estudianteId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'curso_id,estudiante_id' }
    )

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  return {}
}
