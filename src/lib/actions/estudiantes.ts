'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EstudianteSchema = z.object({
  nombre: z.string().min(2).max(100),
  email:  z.string().email(),
})

const EstudianteEstadoSchema = z.enum(['activo', 'retirado'])

type EstudianteEstado = z.infer<typeof EstudianteEstadoSchema>

export async function setTutoria(estudianteId: string, activar: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase.from('estudiantes')
    .update({ tutoria: activar })
    .eq('id', estudianteId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export async function importarEstudiantesMasivo(
  cursoId: string,
  estudiantes: Array<{ nombre: string; email: string }>
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const rows = estudiantes
    .filter(e => e.nombre && e.email)
    .map(e => ({
      nombre: e.nombre.trim(),
      email: e.email.trim().toLowerCase(),
      curso_id: cursoId,
      profesor_id: user.id,
      estado: 'activo',
    }))

  if (rows.length === 0) return { error: 'No se encontraron estudiantes válidos.' }

  const { error, data } = await supabase
    .from('estudiantes')
    .upsert(rows, { onConflict: 'curso_id,email', ignoreDuplicates: true })
    .select()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  return { count: data?.length ?? rows.length }
}

export async function setEstadoEstudiante(
  estudianteId: string,
  estado: EstudianteEstado,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase.from('estudiantes')
    .update({
      estado,
      retirado_at: estado === 'retirado' ? new Date().toISOString() : null,
    })
    .eq('id', estudianteId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  return {}
}

export async function eliminarEstudiante(estudianteId: string, cursoId: string): Promise<{ error?: string }> {
  return setEstadoEstudiante(estudianteId, 'retirado', cursoId)
}
