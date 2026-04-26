import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ModoClaseClient } from './modo-clase-client'
import type { ActividadPlanificada } from '@/types/domain'

export default async function ModoClaseActivaPage({
  params,
}: {
  params: Promise<{ bitacoraId: string }>
}) {
  const { bitacoraId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bitacora } = await db
    .from('bitacora_clase')
    .select('id, curso_id, fecha, tema, estado, hora_inicio_real, actividades_json, observaciones, cursos(asignatura, codigo)')
    .eq('id', bitacoraId)
    .eq('profesor_id', user.id)
    .single()

  if (!bitacora) notFound()

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const dow = new Date(bitacora.fecha + 'T12:00:00').getDay()
  const diaSemana = dayNames[dow]
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const [estudiantesRes, asistenciaRes, horariosRes] = await Promise.all([
    db
      .from('estudiantes')
      .select('id, nombre, email')
      .eq('curso_id', bitacora.curso_id)
      .order('nombre'),
    db
      .from('asistencia')
      .select('estudiante_id, estado, atraso')
      .eq('curso_id', bitacora.curso_id)
      .eq('fecha', bitacora.fecha),
    db
      .from('horarios_clases')
      .select('hora_inicio, hora_fin, dia_semana')
      .eq('curso_id', bitacora.curso_id),
  ])

  const students = (estudiantesRes.data ?? []) as { id: string; nombre: string; email: string }[]
  const asistenciaInicial = (asistenciaRes.data ?? []) as { estudiante_id: string; estado: string; atraso: boolean }[]
  const actividades: ActividadPlanificada[] = (bitacora.actividades_json as ActividadPlanificada[] | null) ?? []

  type HorarioRow = { hora_inicio: string; hora_fin: string; dia_semana: string }
  const horarioDelDia = (horariosRes.data ?? [] as HorarioRow[]).find(
    (h: HorarioRow) => normalize(h.dia_semana) === normalize(diaSemana)
  )
  let horasClase = 1
  if (horarioDelDia) {
    const [startH, startM] = horarioDelDia.hora_inicio.split(':').map(Number)
    const [endH, endM] = horarioDelDia.hora_fin.split(':').map(Number)
    const mins = (endH * 60 + endM) - (startH * 60 + startM)
    horasClase = Math.max(1, Math.round(mins / 60))
  }

  return (
    <ModoClaseClient
      bitacoraId={bitacoraId}
      cursoId={bitacora.curso_id}
      cursoNombre={bitacora.cursos?.asignatura ?? 'Clase'}
      cursoCodigo={bitacora.cursos?.codigo ?? ''}
      fecha={bitacora.fecha}
      tema={bitacora.tema}
      estadoClase={bitacora.estado}
      horaInicioReal={bitacora.hora_inicio_real ?? null}
      actividadesIniciales={actividades}
      students={students}
      asistenciaInicial={asistenciaInicial}
      horasClase={horasClase}
    />
  )
}
