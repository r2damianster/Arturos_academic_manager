'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function clearProblemas(authUserId: string, cursoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify the student belongs to this professor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: est } = await db
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('profesor_id', user.id)
    .maybeSingle()
  if (!est) return { error: 'Sin permiso' }

  // encuesta_estudiante only allows student UPDATE via RLS → use admin client
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('encuesta_estudiante')
    .update({ problemas_reportados: null })
    .eq('auth_user_id', authUserId)

  if (updateError) return { error: updateError.message }

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
