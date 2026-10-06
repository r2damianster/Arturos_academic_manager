'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const ComentarioItemSchema = z.object({
  cursoId: z.string().uuid(),
  estudianteId: z.string().uuid(),
  parcial: z.number().int().min(1).max(4),
  nombreItem: z.string().min(1),
  /** Texto del profesor. '' = vacío a propósito; null = quitar lo guardado (en rúbricas vuelve el automático). */
  comentario: z.string().max(1000, 'Máximo 1000 caracteres').nullable(),
})

/**
 * Guarda el comentario escrito por el profesor ("qué falta") de una celda estudiante × columna.
 * Solo se guarda lo que escribe el profesor: el comentario automático de una rúbrica se calcula
 * al mostrarlo y no ocupa espacio en la base.
 *  - texto: se guarda tal cual (recortado). '' = vacío a propósito (en rúbricas oculta el automático).
 *  - null: elimina lo guardado (en rúbricas vuelve a mostrarse el automático).
 * Si la celda aún no tiene fila y hay texto, la crea con nota null.
 */
export async function guardarComentarioItem(
  params: z.input<typeof ComentarioItemSchema>
): Promise<{ error?: string }> {
  const parsed = ComentarioItemSchema.safeParse(params)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { cursoId, estudianteId, parcial, nombreItem, comentario } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const comentarioAGuardar = comentario === null ? null : comentario.trim()
  const ahora = new Date().toISOString()

  const { data: filasActualizadas, error: errorUpdate } = await supabase
    .from('calificaciones_items' as any)
    .update({ comentario: comentarioAGuardar, updated_at: ahora })
    .eq('curso_id', cursoId)
    .eq('estudiante_id', estudianteId)
    .eq('parcial', parcial)
    .eq('nombre_item', nombreItem)
    .eq('profesor_id', user.id)
    .select('id')
  if (errorUpdate) return { error: errorUpdate.message }

  if ((!filasActualizadas || filasActualizadas.length === 0) && comentarioAGuardar) {
    const { error: errorInsert } = await supabase
      .from('calificaciones_items' as any)
      .insert({
        profesor_id: user.id,
        curso_id: cursoId,
        estudiante_id: estudianteId,
        parcial,
        categoria: null,
        nombre_item: nombreItem,
        tipo: 'tarea',
        nota: null,
        comentario: comentarioAGuardar,
        fuente: 'manual',
        import_id: null,
        updated_at: ahora,
      })
    if (errorInsert) return { error: errorInsert.message }
  }

  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  return {}
}

export async function upsertItemManual(params: {
  cursoId: string
  estudianteId: string
  parcial: number
  nombreItem: string
  categoria: string | null
  tipo: 'tarea' | 'subtotal_categoria' | 'otro'
  nota: number | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .upsert(
      {
        profesor_id: user.id,
        curso_id: params.cursoId,
        estudiante_id: params.estudianteId,
        parcial: params.parcial,
        categoria: params.categoria,
        nombre_item: params.nombreItem,
        tipo: params.tipo,
        nota: params.nota,
        fuente: 'manual',
        import_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'curso_id,estudiante_id,parcial,nombre_item' }
    )

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${params.cursoId}/calificaciones`)
  return {}
}

export async function eliminarItem(
  itemId: string,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .delete()
    .eq('id', itemId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}/calificaciones`)
  return {}
}

export async function crearColumnaEnCurso(params: {
  cursoId: string
  parcial: number
  nombreActividad: string
  estudianteIds: string[]
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const rows = params.estudianteIds.map(estudianteId => ({
    profesor_id: user.id,
    curso_id: params.cursoId,
    estudiante_id: estudianteId,
    parcial: params.parcial,
    categoria: null,
    nombre_item: params.nombreActividad.trim(),
    tipo: 'tarea',
    nota: null,
    fuente: 'en_curso',
    import_id: null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .upsert(rows, { onConflict: 'curso_id,estudiante_id,parcial,nombre_item' })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${params.cursoId}/calificaciones`)
  return {}
}

export async function renombrarColumnaEnCurso(params: {
  cursoId: string
  parcial: number
  nombreAnterior: string
  nombreNuevo: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .update({ nombre_item: params.nombreNuevo.trim(), updated_at: new Date().toISOString() })
    .eq('curso_id', params.cursoId)
    .eq('profesor_id', user.id)
    .eq('parcial', params.parcial)
    .eq('nombre_item', params.nombreAnterior)
    .eq('fuente', 'en_curso')

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${params.cursoId}/calificaciones`)
  return {}
}

export async function eliminarColumnaEnCurso(params: {
  cursoId: string
  parcial: number
  nombreActividad: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .delete()
    .eq('curso_id', params.cursoId)
    .eq('profesor_id', user.id)
    .eq('parcial', params.parcial)
    .eq('nombre_item', params.nombreActividad)
    .eq('fuente', 'en_curso')

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${params.cursoId}/calificaciones`)
  return {}
}

export async function upsertItemEnCurso(params: {
  cursoId: string
  estudianteId: string
  parcial: number
  nombreItem: string
  nota: number | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .upsert(
      {
        profesor_id: user.id,
        curso_id: params.cursoId,
        estudiante_id: params.estudianteId,
        parcial: params.parcial,
        categoria: null,
        nombre_item: params.nombreItem,
        tipo: 'tarea',
        nota: params.nota,
        fuente: 'en_curso',
        import_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'curso_id,estudiante_id,parcial,nombre_item' }
    )

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${params.cursoId}/calificaciones`)
  return {}
}

export async function getItemsPorCurso(
  cursoId: string,
  parcial?: number
): Promise<{ items?: any[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let query = supabase
    .from('calificaciones_items' as any)
    .select('id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, comentario, fuente, updated_at')
    .eq('curso_id', cursoId)
    .order('parcial', { ascending: true })
    .order('nombre_item', { ascending: true })

  if (parcial !== undefined) {
    query = query.eq('parcial', parcial)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { items: data ?? [] }
}
