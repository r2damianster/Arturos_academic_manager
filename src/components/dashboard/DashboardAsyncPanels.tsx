import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getNotificacionesProactivas } from '@/lib/actions/notificaciones'
import { NotificacionesPanel } from '@/components/dashboard/NotificacionesPanel'
import { TutoriasPendientesPanel } from '@/components/dashboard/TutoriasPendientesPanel'

// Paneles del dashboard que se cargan con streaming (dentro de <Suspense>):
// no bloquean el primer pintado del resto de la página.

export async function NotificacionesLoader() {
  const notificaciones = await getNotificacionesProactivas()
  return <NotificacionesPanel notificaciones={notificaciones} />
}

export async function TutoriasPendientesLoader() {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const hoy = new Date().toISOString().split('T')[0]

  // El filtro por profesor va en el join (horarios!inner) → no depende de una
  // consulta previa de ids de horarios.
  const { data } = await db
    .from('reservas')
    .select('id, fecha, estudiante_nombre, estado, asistio, horarios!inner(profesor_id, hora_inicio, hora_fin)')
    .eq('horarios.profesor_id', user.id)
    .lt('fecha', hoy)
    .is('asistio', null)
    .order('fecha', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reservasPendientes = (data ?? []).map((reserva: any) => ({
    id: reserva.id,
    fecha: reserva.fecha,
    estudiante_nombre: reserva.estudiante_nombre,
    estado: reserva.estado,
    asistio: reserva.asistio,
    hora_inicio: reserva.horarios?.hora_inicio ?? '',
    hora_fin: reserva.horarios?.hora_fin ?? '',
  }))

  return <TutoriasPendientesPanel reservas={reservasPendientes} />
}
