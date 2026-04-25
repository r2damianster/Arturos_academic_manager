'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function clearProblemas(authUserId: string, cursoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // SECURITY DEFINER function validates ownership and clears the field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('clear_problemas_estudiante', {
    p_auth_user_id: authUserId,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/encuesta`)
  return null
}

export async function saveNotaIncidencia(estudianteId: string, nota: string, cursoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('estudiantes')
    .update({ nota_incidencia: nota.trim() || null })
    .eq('id', estudianteId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/encuesta`)
  return null
}
