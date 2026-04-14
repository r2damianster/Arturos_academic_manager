'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RegistroAsistenciaInput = {
  estudiante_id: string
  estado: 'Presente' | 'Ausente' | 'Atraso'
  atraso: boolean
  horas: number
  participacion?: number | null
  observacion_part?: string | null
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
    .filter(r => r.participacion != null)
    .map(r => ({
      profesor_id: user.id,
      curso_id: cursoId,
      estudiante_id: r.estudiante_id,
      fecha,
      semana,
      nivel: r.participacion,
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
