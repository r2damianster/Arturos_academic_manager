'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const DescripcionSchema = z.string().min(5).max(500)

export async function getLogros(cursoId: string): Promise<{
  logros: { id: string; descripcion: string; orden: number }[]
  error?: string
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('logros_aprendizaje')
    .select('id, descripcion, orden')
    .eq('curso_id', cursoId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { logros: [], error: error.message }
  return { logros: data ?? [] }
}

export async function addLogro(
  cursoId: string,
  descripcion: string
): Promise<{ id?: string; error?: string }> {
  const parsed = DescripcionSchema.safeParse(descripcion)
  if (!parsed.success) return { error: 'Descripción inválida (mínimo 5 caracteres)' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('logros_aprendizaje')
    .select('orden')
    .eq('curso_id', cursoId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrden = (existing?.orden ?? -1) + 1

  const { data, error } = await supabase
    .from('logros_aprendizaje')
    .insert({ curso_id: cursoId, descripcion: parsed.data, orden: nextOrden })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/editar`)
  return { id: data.id }
}

export async function updateLogro(
  id: string,
  descripcion: string
): Promise<{ error?: string }> {
  const parsed = DescripcionSchema.safeParse(descripcion)
  if (!parsed.success) return { error: 'Descripción inválida (mínimo 5 caracteres)' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('logros_aprendizaje')
    .update({ descripcion: parsed.data })
    .eq('id', id)

  if (error) return { error: error.message }
  return {}
}

export async function deleteLogro(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('logros_aprendizaje')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return {}
}

export async function reorderLogros(
  cursoId: string,
  orderedIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const updates = orderedIds.map((id, i) =>
    supabase.from('logros_aprendizaje').update({ orden: i }).eq('id', id)
  )
  await Promise.all(updates)
  revalidatePath(`/dashboard/cursos/${cursoId}/editar`)
  return {}
}
