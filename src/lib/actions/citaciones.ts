'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Interfaz para la entrada de citación
export interface CitacionInput {
  cursoId: string
  estudianteId: string
  razon: string
  detalleRazon?: string
}

export async function citarEstudiante(input: CitacionInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'No autenticado' }
  }

  // 1. Crear el registro en citaciones_tutoria
  const { error: citacionError } = await supabase
    .from('citaciones_tutoria')
    .insert({
      profesor_id: user.id,
      curso_id: input.cursoId,
      estudiante_id: input.estudianteId,
      razon: input.razon,
      detalle_razon: input.detalleRazon || null,
      estado: 'pendiente'
    })

  if (citacionError) {
    console.error('Error al citar estudiante:', citacionError)
    return { error: 'No se pudo registrar la citación' }
  }

  // 2. Actualizar el flag 'tutoria' en estudiantes por retrocompatibilidad
  const { error: updateError } = await supabase
    .from('estudiantes')
    .update({ tutoria: true })
    .eq('id', input.estudianteId)
    .eq('profesor_id', user.id)

  if (updateError) {
    console.error('Error actualizando flag en estudiantes:', updateError)
  }

  revalidatePath(`/dashboard/cursos/${input.cursoId}`)
  revalidatePath(`/dashboard/cursos/${input.cursoId}/citaciones`)
  return { success: true }
}

export async function actualizarEstadoCitacion(citacionId: string, nuevoEstado: string, cursoId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'No autenticado' }
  }

  // Actualizar el estado de la citación
  const { data, error } = await supabase
    .from('citaciones_tutoria')
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq('id', citacionId)
    .eq('profesor_id', user.id)
    .select('estudiante_id')
    .single()

  if (error) {
    console.error('Error actualizando estado citacion:', error)
    return { error: 'Error al actualizar el estado' }
  }

  // Si el nuevo estado es "cumplida" o "mejorado", quitar el flag "tutoria" del estudiante
  // Siempre y cuando NO tenga otras citaciones pendientes o agendadas.
  if (data && (nuevoEstado === 'cumplida' || nuevoEstado === 'mejorado')) {
    const { count } = await supabase
      .from('citaciones_tutoria')
      .select('*', { count: 'exact', head: true })
      .eq('estudiante_id', data.estudiante_id)
      .in('estado', ['pendiente', 'agendada', 'asistida'])

    if (count === 0) {
      await supabase
        .from('estudiantes')
        .update({ tutoria: false })
        .eq('id', data.estudiante_id)
        .eq('profesor_id', user.id)
    }
  }

  revalidatePath(`/dashboard/cursos/${cursoId}/citaciones`)
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  
  return { success: true }
}

export async function obtenerCitacionesPendientesEstudiante() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'No autenticado', data: [] }
  }

  // Identificar al estudiante logueado (usamos el auth_user_id)
  const { data: estudianteData } = await supabase
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .single()

  if (!estudianteData) {
    return { data: [] }
  }

  // Buscar citaciones pendientes para ese estudiante
  const { data, error } = await supabase
    .from('citaciones_tutoria')
    .select(`
      *,
      cursos ( asignatura, codigo ),
      profesores ( nombre, email )
    `)
    .eq('estudiante_id', estudianteData.id)
    .eq('estado', 'pendiente')

  if (error) {
    console.error('Error fetching citaciones:', error)
    return { error: 'Error consultando citaciones', data: [] }
  }

  return { data }
}

export async function getCitacionesPorCurso(cursoId: string, mes?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('citaciones_tutoria')
    .select(`
      *,
      estudiantes ( id, nombre, email ),
      reservas ( id, fecha, estado )
    `)
    .eq('curso_id', cursoId)
    .eq('profesor_id', user.id)
    .order('fecha_citacion', { ascending: false })

  if (mes) {
    // mes en formato YYYY-MM
    const startDate = `${mes}-01`
    // calcular el fin de mes asumiendo año bisiesto si aplica o usar lte
    // forma simple: gte primero de mes, lte último del mes
    const date = new Date(startDate)
    const y = date.getFullYear()
    const m = date.getMonth()
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0]
    
    query = query.gte('fecha_citacion', startDate).lte('fecha_citacion', lastDay)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error consultando citaciones por curso:', error)
    return []
  }

  return data
}
