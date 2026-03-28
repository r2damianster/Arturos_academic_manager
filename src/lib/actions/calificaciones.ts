'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export async function upsertCalificaciones(
  cursoId: string,
  estudianteId: string,
  data: {
    acd1?: number; ta1?: number; pe1?: number; ex1?: number
    acd2?: number; ta2?: number; pe2?: number; ex2?: number
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await (supabase as AnySupabase)
    .from('calificaciones')
    .upsert({
      profesor_id: user.id,
      curso_id: cursoId,
      estudiante_id: estudianteId,
      ...data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'curso_id,estudiante_id' })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  return {}
}
