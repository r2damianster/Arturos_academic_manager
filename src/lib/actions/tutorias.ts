'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Duration options ─────────────────────────────────────────────────────────

export type DuracionTutoria = '1s' | '2s' | '1m' | '2m' | '3m' | '4m' | 'permanente'

function calcDisponibleHasta(duracion: DuracionTutoria): string | null {
  if (duracion === 'permanente') return null
  const hoy = new Date()
  const dias: Record<DuracionTutoria, number> = {
    '1s': 7, '2s': 14, '1m': 30, '2m': 60, '3m': 90, '4m': 120, permanente: 0,
  }
  hoy.setDate(hoy.getDate() + dias[duracion])
  return hoy.toISOString().split('T')[0]
}

// ─── Activate a slot with duration ───────────────────────────────────────────

export async function activarHorario(horarioId: number, duracion: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let disponible_hasta: string | null = null
  if (duracion.startsWith('hasta_')) {
    disponible_hasta = duracion.replace('hasta_', '')
  } else {
    disponible_hasta = calcDisponibleHasta(duracion as DuracionTutoria)
  }
  const { data, error } = await db
    .from('horarios')
    .update({ estado: 'disponible', disponible_hasta })
    .eq('id', horarioId)
    .select('id')

  if (error) return { error: `Supabase Error: ${error.message}` }
  if (!data || data.length === 0) return { error: `Error: No se pudo actualizar en BD (permisos RLS o ID '${horarioId}' incorrecto).` }

  return { ok: true, disponible_hasta }
}

// ─── Deactivate a slot ────────────────────────────────────────────────────────

export async function desactivarHorario(horarioId: number) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('horarios')
    .update({ estado: 'no_disponible', disponible_hasta: null })
    .eq('id', horarioId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Direct tutoría assignment (profesor → student) ───────────────────────────

export async function asignarTutoriaDirecta(params: {
  horarioId: number
  fecha: string          // YYYY-MM-DD
  authUserId: string     // student's auth_user_id
  estudianteNombre: string
  estudianteEmail: string
  estudianteCarrera?: string | null
  estudianteTelefono?: string | null
  nota?: string | null
}) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Check for existing reserva at same slot+date
  const { data: existing } = await db
    .from('reservas')
    .select('id, estado')
    .eq('horario_id', params.horarioId)
    .eq('fecha', params.fecha)
    .in('estado', ['pendiente', 'confirmada'])
    .maybeSingle()

  if (existing) return { error: 'Ya existe una reserva para este horario y fecha.' }

  const { data: reserva, error } = await db
    .from('reservas')
    .insert({
      horario_id:         params.horarioId,
      fecha:              params.fecha,
      auth_user_id:       params.authUserId,
      estudiante_nombre:  params.estudianteNombre,
      estudiante_carrera: params.estudianteCarrera ?? '',
      email:              params.estudianteEmail,
      telefono:           params.estudianteTelefono ?? '',
      notas:              params.nota ?? null,
      estado:             'confirmada',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Send email notification (Resend)
  try {
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@tutor.app'
    if (resendKey && resendKey !== 'TU_RESEND_API_KEY') {
      const { horarioId, fecha, estudianteNombre, estudianteEmail, nota } = params
      // Fetch horario details for email
      const { data: h } = await db
        .from('horarios')
        .select('dia_semana, hora_inicio, hora_fin, profesores(nombre)')
        .eq('id', horarioId)
        .single()

      const horaInicio = h?.hora_inicio?.slice(0, 5) ?? ''
      const horaFin    = h?.hora_fin?.slice(0, 5) ?? ''
      const profNombre = h?.profesores?.nombre ?? 'tu profesor'
      const fechaFmt   = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: estudianteEmail,
          subject: `Tutoría asignada: ${fechaFmt}`,
          html: `
            <p>Hola <strong>${estudianteNombre}</strong>,</p>
            <p>${profNombre} te ha asignado una sesión de tutoría:</p>
            <ul>
              <li><strong>Fecha:</strong> ${fechaFmt}</li>
              <li><strong>Horario:</strong> ${horaInicio}–${horaFin}</li>
              ${nota ? `<li><strong>Nota:</strong> ${nota}</li>` : ''}
            </ul>
            <p>La sesión está confirmada. Si necesitas cancelarla, hazlo a través del sistema.</p>
          `,
        }),
      })
    }
  } catch {
    // Email failure is non-blocking
  }

  return { ok: true, reservaId: reserva?.id }
}

// ─── Student announces attendance to a group tutoria ─────────────────────────

export async function anunciarAsistenciaTutoria(params: {
  horarioClaseId: string
  estudianteId: string
  fecha: string
}) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('anuncios_tutoria_curso')
    .insert({
      horario_clase_id: params.horarioClaseId,
      estudiante_id:    params.estudianteId,
      fecha:            params.fecha,
    })
  if (error && error.code !== '23505') // ignore duplicate key
    return { error: error.message }
  return { ok: true }
}

export async function cancelarAnuncioTutoria(params: {
  horarioClaseId: string
  estudianteId: string
  fecha: string
}) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('anuncios_tutoria_curso')
    .delete()
    .eq('horario_clase_id', params.horarioClaseId)
    .eq('estudiante_id',    params.estudianteId)
    .eq('fecha',            params.fecha)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function eliminarReserva(reservaId: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('reservas')
    .delete()
    .eq('id', reservaId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  return {}
}
