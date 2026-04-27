'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RegistroAsistenciaInput = {
  estudiante_id: string
  estado: 'Presente' | 'Ausente' | 'Atraso'
  atraso: boolean
  horas: number
  participacion?: number | null       // nivel 1-3 para tabla participacion
  observacion_participacion?: string | null
  observacion_part?: string | null    // observacion en tabla asistencia
  obs_trabajo?: string | null
  trabajo_id?: string | null
}

export async function registrarAsistenciaMasiva(
  cursoId: string,
  fecha: string,
  registros: RegistroAsistenciaInput[],
  bitacoraId?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: semanaData } = await supabase.rpc('calcular_semana', { p_curso_id: cursoId })
  const semana = semanaData ?? null

  const asistenciaRows = registros.map(r => ({
    profesor_id: user.id,
    curso_id: cursoId,
    estudiante_id: r.estudiante_id,
    fecha,
    semana,
    estado: r.estado,
    atraso: r.atraso,
    horas: r.horas,
    observacion_part: r.observacion_part?.trim() || null,
    bitacora_id: bitacoraId ?? null,
  }))

  const { error: errAsis } = await supabase
    .from('asistencia')
    .upsert(asistenciaRows, { onConflict: 'curso_id,estudiante_id,fecha' })

  if (errAsis) return { error: errAsis.message }

  const partRows = registros
    .filter(r => r.participacion != null || r.observacion_participacion)
    .map(r => ({
      profesor_id: user.id,
      curso_id: cursoId,
      estudiante_id: r.estudiante_id,
      fecha,
      semana,
      nivel: r.participacion ?? null,
      observacion: r.observacion_participacion ?? null,
    }))

  if (partRows.length > 0) {
    await supabase.from('participacion')
      .upsert(partRows, { onConflict: 'curso_id,estudiante_id,fecha' })
  }

  const obsTrabajoRows = registros
    .filter(r => r.obs_trabajo?.trim() && r.trabajo_id)
    .map(r => ({
      profesor_id: user.id,
      trabajo_id: r.trabajo_id!,
      observacion: r.obs_trabajo!.trim(),
      fecha,
    }))

  if (obsTrabajoRows.length > 0) {
    await supabase.from('observaciones_trabajo').insert(obsTrabajoRows)
  }

  revalidatePath(`/dashboard/cursos/${cursoId}/asistencia`)
  revalidatePath('/dashboard/agenda')
  return {}
}

export async function registrarParticipacion(
  cursoId: string,
  fecha: string,
  datos: { estudianteId: string; nivel: number | null; observacion: string | null }[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: semanaData } = await supabase.rpc('calcular_semana', { p_curso_id: cursoId })
  const semana = semanaData ?? null

  const rows = datos
    .filter(d => d.nivel != null || d.observacion)
    .map(d => ({
      profesor_id: user.id,
      curso_id: cursoId,
      estudiante_id: d.estudianteId,
      fecha,
      semana,
      nivel: d.nivel,
      observacion: d.observacion,
    }))

  if (rows.length === 0) return {}
  const { error } = await supabase
    .from('participacion')
    .upsert(rows, { onConflict: 'curso_id,estudiante_id,fecha' })
  return error ? { error: error.message } : {}
}
