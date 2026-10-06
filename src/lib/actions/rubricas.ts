'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { GuardarRubricaSchema, type GuardarRubricaInput } from '@/lib/rubrica-schema'
import {
  borradorComentarioDesdeResultado,
  calcularRubrica,
  type DatosEstudianteRubrica,
  type DefinicionRubrica,
} from '@/lib/rubrica-calculo'

export interface RubricaGuardada {
  id: string
  curso_id: string
  parcial: number
  nombre_columna: string
  escala_salida: number | null
  definicion: DefinicionRubrica
}

const rutaCalificaciones = (cursoId: string) => `/dashboard/cursos/${cursoId}/calificaciones`

export async function getRubricas(cursoId: string): Promise<{ rubricas?: RubricaGuardada[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data, error } = await supabase
    .from('calificacion_rubricas' as any)
    .select('id, curso_id, parcial, nombre_columna, escala_salida, definicion')
    .eq('curso_id', cursoId)
    .order('parcial')
    .order('nombre_columna')
  if (error) return { error: error.message }
  return { rubricas: (data ?? []) as unknown as RubricaGuardada[] }
}

/**
 * Crea o actualiza la definición de una rúbrica. No calcula notas: usar recalcularRubrica.
 * Rechaza el nombre si ya lo usa una columna que NO es de rúbrica (evita pisar notas de Moodle).
 */
export async function guardarRubrica(
  params: GuardarRubricaInput
): Promise<{ rubricaId?: string; error?: string }> {
  const parsed = GuardarRubricaSchema.safeParse(params)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { cursoId, parcial, nombreColumna, escalaSalida, definicion } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: colisiones, error: errorColision } = await supabase
    .from('calificaciones_items' as any)
    .select('id')
    .eq('curso_id', cursoId)
    .eq('parcial', parcial)
    .eq('nombre_item', nombreColumna)
    .neq('fuente', 'rubrica')
    .limit(1)
  if (errorColision) return { error: errorColision.message }
  if (colisiones && colisiones.length > 0) {
    return { error: `Ya existe una columna "${nombreColumna}" en el Parcial ${parcial} que no es de rúbrica` }
  }

  const { data, error } = await supabase
    .from('calificacion_rubricas' as any)
    .upsert(
      {
        profesor_id: user.id,
        curso_id: cursoId,
        parcial,
        nombre_columna: nombreColumna,
        escala_salida: escalaSalida ?? null,
        definicion,
      },
      { onConflict: 'curso_id,parcial,nombre_columna' }
    )
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath(rutaCalificaciones(cursoId))
  return { rubricaId: (data as any).id }
}

/**
 * Borra la rúbrica y sus notas calculadas. Las celdas con un comentario escrito a mano se conservan
 * sin nota; los comentarios automáticos se borran junto con la rúbrica.
 */
export async function eliminarRubrica(rubricaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: rubrica, error: errorCarga } = await supabase
    .from('calificacion_rubricas' as any)
    .select('curso_id, parcial, nombre_columna')
    .eq('id', rubricaId)
    .eq('profesor_id', user.id)
    .single()
  if (errorCarga || !rubrica) return { error: 'Rúbrica no encontrada' }
  const { curso_id: cursoId, parcial, nombre_columna: nombreColumna } = rubrica as any

  const filtroItemsDeRubrica = (consulta: any) =>
    consulta
      .eq('curso_id', cursoId)
      .eq('parcial', parcial)
      .eq('nombre_item', nombreColumna)
      .eq('fuente', 'rubrica')
      .eq('profesor_id', user.id)

  const { error: errorBorrado } = await filtroItemsDeRubrica(
    supabase.from('calificaciones_items' as any).delete()
  ).or('comentario.is.null,comentario.eq.,comentario_auto.eq.true')
  if (errorBorrado) return { error: errorBorrado.message }

  const { error: errorConservar } = await filtroItemsDeRubrica(
    supabase.from('calificaciones_items' as any).update({ nota: null, fuente: 'manual' })
  )
  if (errorConservar) return { error: errorConservar.message }

  const { error } = await supabase
    .from('calificacion_rubricas' as any)
    .delete()
    .eq('id', rubricaId)
    .eq('profesor_id', user.id)
  if (error) return { error: error.message }

  revalidatePath(rutaCalificaciones(cursoId))
  return {}
}

/**
 * Calcula la rúbrica para todos los estudiantes activos y guarda el resultado como ítems fuente='rubrica'.
 * Comentarios: si la rúbrica tiene `comentarioAutomatico` (por defecto sí), cada celda recibe el borrador
 * "qué falta", salvo que ya tenga un comentario escrito o vaciado a propósito por el profesor, que se conserva.
 * Los comentarios automáticos previos se actualizan con los datos nuevos.
 */
export async function recalcularRubrica(rubricaId: string): Promise<{ actualizados?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: rubrica, error: errorRubrica } = await supabase
    .from('calificacion_rubricas' as any)
    .select('curso_id, parcial, nombre_columna, escala_salida, definicion')
    .eq('id', rubricaId)
    .eq('profesor_id', user.id)
    .single()
  if (errorRubrica || !rubrica) return { error: 'Rúbrica no encontrada' }
  const { curso_id: cursoId, parcial, nombre_columna: nombreColumna, escala_salida: escalaSalida } = rubrica as any
  const definicion = (rubrica as any).definicion as DefinicionRubrica

  const [estudiantesRes, itemsRes, participacionRes, asistenciaRes, bitacorasRes, comentariosRes] = await Promise.all([
    supabase.from('estudiantes').select('id').eq('curso_id', cursoId).eq('estado', 'activo'),
    supabase
      .from('calificaciones_items' as any)
      .select('estudiante_id, parcial, nombre_item, nota')
      .eq('curso_id', cursoId)
      .neq('fuente', 'rubrica'),
    supabase.from('participacion').select('estudiante_id, fecha, nivel').eq('curso_id', cursoId),
    supabase.from('asistencia').select('estudiante_id, fecha, estado').eq('curso_id', cursoId),
    supabase.from('bitacora_clase').select('fecha').eq('curso_id', cursoId).eq('estado', 'cumplido'),
    supabase
      .from('calificaciones_items' as any)
      .select('estudiante_id, comentario, comentario_auto')
      .eq('curso_id', cursoId)
      .eq('parcial', parcial)
      .eq('nombre_item', nombreColumna),
  ])
  const errorCarga = [estudiantesRes, itemsRes, participacionRes, asistenciaRes, bitacorasRes, comentariosRes].find(
    res => res.error
  )
  if (errorCarga?.error) return { error: errorCarga.error.message }

  const estudiantes = (estudiantesRes.data ?? []) as { id: string }[]
  if (estudiantes.length === 0) return { actualizados: 0 }

  const datosPorEstudiante = new Map<string, DatosEstudianteRubrica>(
    estudiantes.map(estudiante => [estudiante.id, { estudianteId: estudiante.id, items: [], participacion: [], asistencia: [] }])
  )
  for (const item of (itemsRes.data ?? []) as any[]) {
    datosPorEstudiante.get(item.estudiante_id)?.items.push({
      nombre: item.nombre_item,
      parcial: item.parcial,
      nota: item.nota === null ? null : Number(item.nota),
    })
  }
  for (const registro of (participacionRes.data ?? []) as any[]) {
    datosPorEstudiante.get(registro.estudiante_id)?.participacion.push({ fecha: registro.fecha, nivel: registro.nivel })
  }
  for (const registro of (asistenciaRes.data ?? []) as any[]) {
    datosPorEstudiante.get(registro.estudiante_id)?.asistencia.push({ fecha: registro.fecha, estado: registro.estado })
  }

  const fechasClase = Array.from(
    new Set([
      ...((asistenciaRes.data ?? []) as any[]).map(registro => registro.fecha),
      ...((bitacorasRes.data ?? []) as any[]).map(bitacora => bitacora.fecha),
    ].filter(Boolean))
  ).sort() as string[]

  const comentarioAutomatico = definicion.comentarioAutomatico !== false
  const comentarioPrevioPorEstudiante = new Map<string, { comentario: string | null; automatico: boolean }>(
    ((comentariosRes.data ?? []) as any[]).map(fila => [
      fila.estudiante_id,
      { comentario: fila.comentario ?? null, automatico: fila.comentario_auto === true },
    ])
  )

  const ahora = new Date().toISOString()
  const filas = estudiantes.map(estudiante => {
    const resultado = calcularRubrica(
      definicion,
      datosPorEstudiante.get(estudiante.id)!,
      { fechasClase },
      escalaSalida ?? undefined
    )

    // Un comentario escrito (o vaciado a propósito, "") por el profesor no se toca
    const previo = comentarioPrevioPorEstudiante.get(estudiante.id)
    const comentarioEsDelProfesor = !!previo && previo.comentario !== null && !previo.automatico
    let comentario: string | null = previo?.comentario ?? null
    let comentarioAuto = previo?.automatico ?? false
    if (!comentarioEsDelProfesor && comentarioAutomatico) {
      const borrador = borradorComentarioDesdeResultado(resultado)
      comentario = borrador === '' ? null : borrador
      comentarioAuto = borrador !== ''
    }

    return {
      profesor_id: user.id,
      curso_id: cursoId,
      estudiante_id: estudiante.id,
      parcial,
      categoria: null,
      nombre_item: nombreColumna,
      tipo: 'tarea',
      nota: resultado.notaSalida,
      comentario,
      comentario_auto: comentarioAuto,
      fuente: 'rubrica',
      import_id: null,
      updated_at: ahora,
    }
  })

  const { error } = await supabase
    .from('calificaciones_items' as any)
    .upsert(filas, { onConflict: 'curso_id,estudiante_id,parcial,nombre_item' })
  if (error) return { error: error.message }

  revalidatePath(rutaCalificaciones(cursoId))
  return { actualizados: filas.length }
}

/** Crea una columna manual vacía (nota null) para todos los estudiantes activos. Falla si el nombre ya existe. */
export async function crearColumnaManual(params: {
  cursoId: string
  parcial: number
  nombreColumna: string
}): Promise<{ error?: string }> {
  const nombreColumna = params.nombreColumna.trim()
  if (!nombreColumna) return { error: 'Escribe el nombre de la columna' }
  if (nombreColumna.length > 80) return { error: 'Máximo 80 caracteres' }
  if (!Number.isInteger(params.parcial) || params.parcial < 1 || params.parcial > 4) return { error: 'Parcial inválido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('calificaciones_items' as any)
    .select('id')
    .eq('curso_id', params.cursoId)
    .eq('parcial', params.parcial)
    .eq('nombre_item', nombreColumna)
    .limit(1)
  if (errorExistentes) return { error: errorExistentes.message }
  if (existentes && existentes.length > 0) return { error: `Ya existe una columna "${nombreColumna}" en el Parcial ${params.parcial}` }

  const { data: estudiantes, error: errorEstudiantes } = await supabase
    .from('estudiantes')
    .select('id')
    .eq('curso_id', params.cursoId)
    .eq('estado', 'activo')
  if (errorEstudiantes) return { error: errorEstudiantes.message }

  const ahora = new Date().toISOString()
  const { error } = await supabase.from('calificaciones_items' as any).insert(
    (estudiantes ?? []).map(estudiante => ({
      profesor_id: user.id,
      curso_id: params.cursoId,
      estudiante_id: estudiante.id,
      parcial: params.parcial,
      categoria: null,
      nombre_item: nombreColumna,
      tipo: 'tarea',
      nota: null,
      fuente: 'manual',
      import_id: null,
      updated_at: ahora,
    }))
  )
  if (error) return { error: error.message }

  revalidatePath(rutaCalificaciones(params.cursoId))
  return {}
}
