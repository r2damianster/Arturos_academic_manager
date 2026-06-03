import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InasistenciaForm } from './inasistencia-form'

type Props = { params: Promise<{ reservaId: string }> }

export default async function InasistenciaPage({ params }: Props) {
  const { reservaId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: reserva } = await db
    .from('reservas')
    .select('id, fecha, hora_inicio_reserva, profesor_id, curso_id, horarios(hora_inicio, hora_fin, profesor_id)')
    .eq('id', Number(reservaId))
    .eq('auth_user_id', user.id)
    .single()

  if (!reserva) redirect('/student')

  const profesorId = reserva.profesor_id ?? reserva.horarios?.profesor_id
  const [profesorRes, cursoRes] = await Promise.all([
    profesorId
      ? db.from('profesores').select('nombre').eq('id', profesorId).single()
      : Promise.resolve({ data: null }),
    reserva.curso_id
      ? db.from('cursos').select('asignatura').eq('id', reserva.curso_id).single()
      : Promise.resolve({ data: null }),
  ])

  // Noon avoids timezone-off-by-one on date display
  const fecha = new Date(reserva.fecha + 'T12:00:00')
  const fechaStr = fecha.toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hora = reserva.hora_inicio_reserva ?? reserva.horarios?.hora_inicio
  const horaStr = hora ? (hora as string).slice(0, 5) : null

  return (
    <InasistenciaForm
      reservaId={Number(reservaId)}
      fechaStr={fechaStr}
      horaStr={horaStr}
      profesorNombre={profesorRes.data?.nombre ?? null}
      cursoNombre={cursoRes.data?.asignatura ?? null}
    />
  )
}
