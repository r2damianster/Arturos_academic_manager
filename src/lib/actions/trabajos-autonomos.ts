'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { semanasEntre } from '@/lib/trabajos-autonomos-semanas'

export interface FaseTrabajoAutonomo {
  semana_offset: number
  descripcion: string
}

export interface TrabajoAutonomo {
  id: string
  codigo: string
  titulo: string
  descripcion: string | null
  fecha_asignacion: string
  num_semanas: number
  activo: boolean
  fases: FaseTrabajoAutonomo[]
}

export interface TrabajoAutonomoDeClase {
  codigo: string
  titulo: string
  descripcion: string | null
  semanaActual: number
  totalSemanas: number
  faseTexto: string | null
}

export interface GuardarTrabajoAutonomoInput {
  id?: string
  cursoId: string
  titulo: string
  descripcion?: string
  fechaAsignacion: string
  fases: FaseTrabajoAutonomo[]   // semana_offset 0..N; num_semanas = mayor offset (mín. 1)
}

function revalidarVistas() {
  revalidatePath('/dashboard/planificacion')
  revalidatePath('/dashboard/modo-clase')
}

export async function listarTrabajosAutonomos(cursoId: string): Promise<TrabajoAutonomo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('trabajo_autonomo')
    .select('id, codigo, titulo, descripcion, fecha_asignacion, num_semanas, activo, trabajo_autonomo_fase ( semana_offset, descripcion )')
    .eq('curso_id', cursoId)
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row: TrabajoAutonomo & { trabajo_autonomo_fase: FaseTrabajoAutonomo[] }) => ({
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    descripcion: row.descripcion,
    fecha_asignacion: row.fecha_asignacion,
    num_semanas: row.num_semanas,
    activo: row.activo,
    fases: [...(row.trabajo_autonomo_fase ?? [])].sort((first, second) => first.semana_offset - second.semana_offset),
  }))
}

export async function guardarTrabajoAutonomo(
  input: GuardarTrabajoAutonomoInput
): Promise<{ error?: string; id?: string; codigo?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const titulo = input.titulo.trim()
  if (!titulo) return { error: 'El título es obligatorio' }
  const fases = input.fases
    .filter(fase => fase.descripcion.trim())
    .map(fase => ({ semana_offset: fase.semana_offset, descripcion: fase.descripcion.trim() }))
  const numSemanas = Math.min(12, Math.max(1, ...input.fases.map(fase => fase.semana_offset), 1))

  let trabajoId = input.id
  let codigo: string | undefined

  if (trabajoId) {
    const { data, error } = await db
      .from('trabajo_autonomo')
      .update({
        titulo,
        descripcion: input.descripcion?.trim() || null,
        fecha_asignacion: input.fechaAsignacion,
        num_semanas: numSemanas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trabajoId)
      .eq('profesor_id', user.id)
      .select('codigo')
      .single()
    if (error) return { error: error.message }
    codigo = data.codigo
  } else {
    const { count } = await db
      .from('trabajo_autonomo')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', input.cursoId)
    codigo = `TA-${String((count ?? 0) + 1).padStart(2, '0')}`

    const { data, error } = await db
      .from('trabajo_autonomo')
      .insert({
        profesor_id: user.id,
        curso_id: input.cursoId,
        codigo,
        titulo,
        descripcion: input.descripcion?.trim() || null,
        fecha_asignacion: input.fechaAsignacion,
        num_semanas: numSemanas,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    trabajoId = data.id
  }

  await db.from('trabajo_autonomo_fase').delete().eq('trabajo_id', trabajoId)
  if (fases.length > 0) {
    const { error } = await db
      .from('trabajo_autonomo_fase')
      .insert(fases.map(fase => ({ ...fase, trabajo_id: trabajoId })))
    if (error) return { error: error.message }
  }

  revalidarVistas()
  return { id: trabajoId, codigo }
}

export async function alternarTrabajoAutonomoActivo(id: string, activo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('trabajo_autonomo')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('profesor_id', user.id)
  if (error) return { error: error.message }
  revalidarVistas()
  return {}
}

export async function eliminarTrabajoAutonomo(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('trabajo_autonomo')
    .delete()
    .eq('id', id)
    .eq('profesor_id', user.id)
  if (error) return { error: error.message }
  revalidarVistas()
  return {}
}

/** Trabajos autónomos que corresponden a una clase: la semana de la clase cae dentro de [1..num_semanas] tras la asignación. */
export async function getTrabajosAutonomosDeClase(cursoId: string, fecha: string): Promise<TrabajoAutonomoDeClase[]> {
  const trabajos = (await listarTrabajosAutonomos(cursoId)).filter(trabajo => trabajo.activo)
  const deClase: TrabajoAutonomoDeClase[] = []
  for (const trabajo of trabajos) {
    const semanaActual = semanasEntre(trabajo.fecha_asignacion, fecha)
    // Semana 0 = clases posteriores a la asignación dentro de la misma semana
    if (semanaActual < 0 || semanaActual > trabajo.num_semanas) continue
    if (semanaActual === 0 && fecha <= trabajo.fecha_asignacion) continue
    deClase.push({
      codigo: trabajo.codigo,
      titulo: trabajo.titulo,
      descripcion: trabajo.descripcion,
      semanaActual,
      totalSemanas: trabajo.num_semanas,
      faseTexto: trabajo.fases.find(fase => fase.semana_offset === semanaActual)?.descripcion ?? null,
    })
  }
  return deClase
}
