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

export async function enviarEmailCitacion(citacionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: c }, { data: prof }] = await Promise.all([
    db.from('citaciones_tutoria')
      .select('id, razon, detalle_razon, fecha_citacion, estudiantes ( nombre, email ), cursos ( asignatura )')
      .eq('id', citacionId)
      .eq('profesor_id', user.id)
      .single(),
    db.from('profesores').select('nombre').eq('id', user.id).single(),
  ])

  if (!c) return { error: 'Citación no encontrada' }
  if (!c.estudiantes?.email) return { error: 'El estudiante no tiene email registrado' }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@tutor.app'
  if (!resendKey || resendKey === 'TU_RESEND_API_KEY') return { error: 'Email no configurado' }

  const RAZONES: Record<string, string> = {
    inasistencia: 'Inasistencia', 'bajo_desempeño': 'Bajo desempeño',
    asignacion_trabajo: 'Asignación de trabajo', otro: 'Otro',
  }
  const fechaFmt = new Date(c.fecha_citacion + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: c.estudiantes.email,
      subject: `Citación a tutoría — ${c.cursos?.asignatura ?? ''}`,
      html: `
        <p>Hola <strong>${c.estudiantes.nombre}</strong>,</p>
        <p><strong>${prof?.nombre ?? 'Tu profesor'}</strong> te ha citado a una sesión de tutoría.</p>
        <ul>
          <li><strong>Materia:</strong> ${c.cursos?.asignatura ?? '—'}</li>
          <li><strong>Motivo:</strong> ${RAZONES[c.razon] ?? c.razon}</li>
          ${c.detalle_razon ? `<li><strong>Detalle:</strong> ${c.detalle_razon}</li>` : ''}
          <li><strong>Fecha de citación:</strong> ${fechaFmt}</li>
        </ul>
        <p>Por favor comunícate con tu profesor para coordinar el horario.</p>
      `,
    }),
  })

  if (!res.ok) return { error: 'Error al enviar el correo' }
  return { success: true }
}

export async function agendarCitacion(params: {
  citacionId: string
  cursoId: string
  horarioId: number
  fecha: string
  estudianteId: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: est } = await db
    .from('estudiantes')
    .select('id, nombre, email, auth_user_id, carrera, telefono')
    .eq('id', params.estudianteId)
    .eq('profesor_id', user.id)
    .single()

  if (!est) return { error: 'Estudiante no encontrado' }
  if (!est.auth_user_id) return { error: 'El estudiante aún no tiene cuenta activa en el portal' }

  const { data: existing } = await db
    .from('reservas')
    .select('id')
    .eq('horario_id', params.horarioId)
    .eq('fecha', params.fecha)
    .in('estado', ['pendiente', 'confirmada'])
    .maybeSingle()

  if (existing) return { error: 'Ya existe una reserva para ese horario y fecha' }

  const { error: rErr } = await db.from('reservas').insert({
    horario_id: params.horarioId,
    fecha: params.fecha,
    auth_user_id: est.auth_user_id,
    estudiante_nombre: est.nombre,
    estudiante_carrera: est.carrera ?? '',
    email: est.email,
    telefono: est.telefono ?? '',
    estado: 'confirmada',
  })

  if (rErr) return { error: 'No se pudo crear la reserva' }

  const { error: cErr } = await db
    .from('citaciones_tutoria')
    .update({ estado: 'agendada', updated_at: new Date().toISOString() })
    .eq('id', params.citacionId)
    .eq('profesor_id', user.id)

  if (cErr) return { error: 'Reserva creada pero no se actualizó la citación' }

  revalidatePath('/dashboard/tutorias')
  return { success: true }
}
