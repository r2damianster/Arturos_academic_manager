'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

const TrabajoSchema = z.object({
  tipo:             z.string().min(1),
  tema:             z.string().optional(),
  descripcion:      z.string().optional(),
  estado:           z.enum(['Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado']).default('Pendiente'),
  fecha_asignacion: z.string().optional(),
})

export async function asignarTrabajoMasivo(
  cursoId: string,
  estudianteIds: string[],
  data: { tipo: string; tema?: string; descripcion?: string; estado: string; fecha_asignacion: string }
): Promise<{ error?: string }> {
  if (estudianteIds.length === 0) return { error: 'Selecciona al menos un estudiante' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const rows = estudianteIds.map(id => ({
    ...data,
    profesor_id: user.id,
    curso_id: cursoId,
    estudiante_id: id,
  }))

  const { error } = await (supabase as AnySupabase).from('trabajos_asignados').insert(rows)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

export async function asignarTrabajo(
  cursoId: string,
  estudianteId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const parsed = TrabajoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await (supabase as AnySupabase).from('trabajos_asignados').insert({
    ...parsed.data,
    profesor_id: user.id,
    curso_id: cursoId,
    estudiante_id: estudianteId,
    fecha_asignacion: parsed.data.fecha_asignacion || new Date().toISOString().split('T')[0],
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/estudiantes/${estudianteId}`)
  return {}
}

export async function actualizarEstadoTrabajo(
  trabajoId: string,
  estudianteId: string,
  estado: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await (supabase as AnySupabase).from('trabajos_asignados')
    .update({ estado })
    .eq('id', trabajoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/estudiantes/${estudianteId}`)
  return {}
}

export async function agregarObservacionTrabajo(
  trabajoId: string,
  estudianteId: string,
  observacion: string,
  cursoId?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await (supabase as AnySupabase).from('observaciones_trabajo').insert({
    profesor_id: user.id,
    trabajo_id: trabajoId,
    observacion,
    fecha: new Date().toISOString().split('T')[0],
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/estudiantes/${estudianteId}`)
  if (cursoId) revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

export async function actualizarTrabajo(
  trabajoId: string,
  cursoId: string,
  data: { tipo: string; tema?: string; descripcion?: string; estado: string; fecha_asignacion: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await (supabase as AnySupabase).from('trabajos_asignados')
    .update({
      tipo: data.tipo,
      tema: data.tema || null,
      descripcion: data.descripcion || null,
      estado: data.estado,
      fecha_asignacion: data.fecha_asignacion,
    })
    .eq('id', trabajoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

export async function eliminarTrabajo(
  trabajoId: string,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await (supabase as AnySupabase).from('trabajos_asignados')
    .delete()
    .eq('id', trabajoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}
