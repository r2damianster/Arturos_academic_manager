'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado', supabase: null, user: null }

  const { data: profesor } = await supabase.from('profesores')
    .select('rol').eq('id', user.id).single()

  if (profesor?.rol !== 'admin') return { error: 'Acceso denegado: se requiere rol admin', supabase: null, user: null }

  return { error: null, supabase, user }
}

export async function cambiarRolProfesor(
  profesorId: string,
  nuevoRol: 'profesor' | 'admin'
): Promise<{ error?: string }> {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Error' }

  const { error: dbError } = await supabase.from('profesores')
    .update({ rol: nuevoRol })
    .eq('id', profesorId)

  if (dbError) return { error: dbError.message }
  revalidatePath('/dashboard/admin')
  return {}
}
