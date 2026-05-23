'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, fuente, updated_at')
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
