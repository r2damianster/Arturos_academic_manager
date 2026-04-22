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

  const [estudiantesRes, asistenciaRes] = await Promise.all([
    db
      .from('estudiantes')
      .select('id, nombre, apellido')
      .eq('curso_id', bitacora.curso_id)
      .order('apellido'),
    db
      .from('asistencia')
      .select('estudiante_id, estado, atraso')
      .eq('curso_id', bitacora.curso_id)
      .eq('fecha', bitacora.fecha),
  ])

  const students = (estudiantesRes.data ?? []) as { id: string; nombre: string; apellido: string }[]
  const asistenciaInicial = (asistenciaRes.data ?? []) as { estudiante_id: string; estado: string; atraso: boolean }[]
  const actividades: ActividadPlanificada[] = (bitacora.actividades_json as ActividadPlanificada[] | null) ?? []

  return (
    <ModoClaseClient
      bitacoraId={bitacoraId}
      cursoId={bitacora.curso_id}
      cursoNombre={bitacora.cursos?.asignatura ?? 'Clase'}
      cursoCodigo={bitacora.cursos?.codigo ?? ''}
      fecha={bitacora.fecha}
      tema={bitacora.tema}
      horaInicioReal={bitacora.hora_inicio_real ?? null}
      actividadesIniciales={actividades}
      students={students}
      asistenciaInicial={asistenciaInicial}
    />
  )
}
