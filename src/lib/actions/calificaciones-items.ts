'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const ComentarioItemSchema = z.object({
  cursoId: z.string().uuid(),
  estudianteId: z.string().uuid(),
  parcial: z.number().int().min(1).max(4),
  nombreItem: z.string().min(1),
  comentario: z.string().max(1000, 'Máximo 1000 caracteres'),
})

/**
 * Guarda el comentario del profesor ("qué falta") de una celda estudiante × columna.
 * Un comentario guardado aquí es siempre manual: la rúbrica ya no lo sobrescribe al recalcular.
 * Si se vacía un comentario que era automático, queda como "" (vaciado a propósito) para que
 * la rúbrica no lo vuelva a generar; en cualquier otro caso, vacío → null.
 * Si la celda aún no tiene fila, la crea con nota null.
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

  const textoLimpio = comentario.trim()
  const ahora = new Date().toISOString()

  const { data: filaExistente, error: errorLectura } = await supabase
    .from('calificaciones_items' as any)
    .select('id, comentario_auto')
    .eq('curso_id', cursoId)
    .eq('estudiante_id', estudianteId)
    .eq('parcial', parcial)
    .eq('nombre_item', nombreItem)
    .eq('profesor_id', user.id)
    .maybeSingle()
  if (errorLectura) return { error: errorLectura.message }

  if (filaExistente) {
    const vaciadoDeAutomatico = textoLimpio === '' && (filaExistente as any).comentario_auto === true
    const comentarioAGuardar = textoLimpio !== '' ? textoLimpio : vaciadoDeAutomatico ? '' : null
    const { error: errorUpdate } = await supabase
      .from('calificaciones_items' as any)
      .update({ comentario: comentarioAGuardar, comentario_auto: false, updated_at: ahora })
      .eq('id', (filaExistente as any).id)
      .eq('profesor_id', user.id)
    if (errorUpdate) return { error: errorUpdate.message }
  } else if (textoLimpio !== '') {
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
        comentario: textoLimpio,
        comentario_auto: false,
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
    .select('id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, comentario, comentario_auto, fuente, updated_at')
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
