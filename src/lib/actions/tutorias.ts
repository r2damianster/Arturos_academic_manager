'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enviarEmail } from '@/lib/email'

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

function calcHorasSlot(h1: string, h2: string): number {
  const [a, b] = [h1, h2].map(t => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm })
  return Math.max(0, (b - a) / 60)
}

function getMondayStr(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

export async function activarHorario(
  horarioId: number,
  duracion: string,
  opciones?: { permitirMultiples?: boolean; bufferMinutos?: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let disponible_hasta: string | null = null
  if (duracion.startsWith('hasta_')) {
    disponible_hasta = duracion.replace('hasta_', '')
  } else {
    disponible_hasta = calcDisponibleHasta(duracion as DuracionTutoria)
  }

  const activado_el = new Date().toISOString().split('T')[0]

  const updatePayload: Record<string, unknown> = {
    estado: 'disponible',
    disponible_hasta,
    activado_el,
  }

  if (opciones?.permitirMultiples !== undefined) {
    updatePayload.permitir_multiples = opciones.permitirMultiples
  }
  if (opciones?.bufferMinutos !== undefined) {
    updatePayload.buffer_minutos = opciones.bufferMinutos
  }

  const { data, error } = await db
    .from('horarios')
    .update(updatePayload)
    .eq('id', horarioId)
    .select('id, hora_inicio, hora_fin')

  if (error) return { error: `Supabase Error: ${error.message}` }
  if (!data || data.length === 0) return { error: `Error: No se pudo actualizar en BD (permisos RLS o ID '${horarioId}' incorrecto).` }

  return { ok: true, disponible_hasta }
}

// ─── Auto-expire slots past disponible_hasta ─────────────────────────────────

export async function limpiarHorariosVencidos() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const hoy = new Date().toISOString().split('T')[0]

  const [slotsRes, cursosRes, horariosCursoRes] = await Promise.all([
    db.from('horarios').select('id, dia_semana, hora_inicio, hora_fin, activado_el, disponible_hasta')
      .eq('profesor_id', user.id).eq('estado', 'disponible'),
    db.from('cursos').select('id, fecha_inicio, fecha_fin')
      .eq('profesor_id', user.id)
      .not('fecha_inicio', 'is', null).not('fecha_fin', 'is', null),
    // Tutorías asignadas al horario del curso (tipo tutoria_curso) — fijas cada semana
    db.from('horarios_clases').select('curso_id, hora_inicio, hora_fin')
      .eq('profesor_id', user.id).eq('tipo', 'tutoria_curso'),
  ])

  const slots: { id: number; dia_semana: string; hora_inicio: string; hora_fin: string; activado_el: string | null; disponible_hasta: string | null }[] = slotsRes.data ?? []
  const cursos: { id: string; fecha_inicio: string; fecha_fin: string }[] = cursosRes.data ?? []
  const horariosCurso: { curso_id: string; hora_inicio: string; hora_fin: string }[] = horariosCursoRes.data ?? []

  // Horas fijas de tutoria_curso por curso (constantes por semana)
  const horasFijasPorCurso: Record<string, number> = {}
  for (const hc of horariosCurso) {
    horasFijasPorCurso[hc.curso_id] = (horasFijasPorCurso[hc.curso_id] ?? 0) + calcHorasSlot(hc.hora_inicio, hc.hora_fin)
  }

  // Para cada curso, calcular el total de horas por semana pasada (SET idempotente)
  for (const curso of cursos) {
    const fi = curso.fecha_inicio.slice(0, 10)
    const ff = curso.fecha_fin.slice(0, 10)

    // Generar semanas desde inicio del curso hasta hoy (sin futuras)
    const limite = ff < hoy ? ff : hoy
    const semanas: string[] = []
    const cur = new Date(getMondayStr(new Date(fi + 'T12:00:00')) + 'T12:00:00')
    while (cur.toISOString().split('T')[0] <= limite) {
      semanas.push(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 7)
    }

    for (const semana of semanas) {
      let totalHoras = 0

      // Slots adicionales activos en esa semana (incluyendo expirados en el pasado)
      for (const slot of slots) {
        const desde = slot.activado_el ?? fi
        if (desde <= semana) {
          totalHoras += calcHorasSlot(slot.hora_inicio, slot.hora_fin)
        }
      }

      // Tutorías fijas del horario del curso (se repiten cada semana del curso)
      totalHoras += horasFijasPorCurso[curso.id] ?? 0

      if (totalHoras > 0) {
        await db.rpc('acumular_horas_tutoria_semana', {
          p_profesor_id: user.id, p_curso_id: curso.id,
          p_fecha_semana: semana, p_horas: totalHoras,
        })
      }
    }
  }

  // Expirar reservas pendientes/confirmadas de fechas pasadas (no-show automático)
  await db.from('reservas')
    .update({ estado: 'completada', asistio: false })
    .in('horario_id', slots.map((s: { id: number }) => s.id))
    .lt('fecha', hoy)
    .in('estado', ['pendiente', 'confirmada'])

  // Expirar slots cuyo disponible_hasta ya pasó
  await db.from('horarios')
    .update({ estado: 'no_disponible', disponible_hasta: null, activado_el: null })
    .eq('profesor_id', user.id).eq('estado', 'disponible')
    .not('disponible_hasta', 'is', null).lt('disponible_hasta', hoy)

  // Expirar slots "muertos": próxima ocurrencia del día > disponible_hasta
  const DIA_TO_DOW: Record<string, number> = {
    'lunes': 1, 'martes': 2, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6,
  }
  const todayD = new Date(hoy + 'T12:00:00')
  const deadIds: number[] = slots
    .filter((s: { id: number; dia_semana: string; disponible_hasta: string | null }) => {
      if (!s.disponible_hasta) return false
      const dow = DIA_TO_DOW[s.dia_semana]
      if (!dow) return false
      const daysAhead = ((dow - todayD.getDay() + 7) % 7) || 7
      const next = new Date(todayD)
      next.setDate(next.getDate() + daysAhead)
      return next.toISOString().split('T')[0] > s.disponible_hasta
    })
    .map((s: { id: number }) => s.id)

  if (deadIds.length > 0) {
    await db.from('horarios')
      .update({ estado: 'no_disponible', disponible_hasta: null, activado_el: null })
      .in('id', deadIds)
  }
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
  tipoTutoriaId?: number | null
}) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch horario to check permitir_multiples
  const { data: horario } = await db
    .from('horarios')
    .select('id, hora_inicio, hora_fin, permitir_multiples, profesores(nombre)')
    .eq('id', params.horarioId)
    .single()

  // If permitir_multiples, delegate to RPC which handles sub-slot calculation
  if (horario?.permitir_multiples && params.tipoTutoriaId) {
    const { data: rpcData, error: rpcError } = await db.rpc('reservar_tutoria', {
      p_horario_id:       params.horarioId,
      p_fecha:            params.fecha,
      p_auth_user_id:     params.authUserId,
      p_nombre:           params.estudianteNombre,
      p_carrera:          params.estudianteCarrera ?? '',
      p_email:            params.estudianteEmail,
      p_telefono:         params.estudianteTelefono ?? '',
      p_notas:            params.nota ?? null,
      p_tipo_tutoria_id:  params.tipoTutoriaId,
    })
    if (rpcError) return { error: rpcError.message }
    // Update estado to confirmada (RPC creates as 'pendiente')
    if (rpcData) {
      await db.from('reservas').update({ estado: 'confirmada' }).eq('id', rpcData)
    }
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tutorias')
    return { ok: true, reservaId: rpcData }
  }

  // Single-booking path: check for existing reserva at same slot+date
  const { data: existing } = await db
    .from('reservas')
    .select('id, estado')
    .eq('horario_id', params.horarioId)
    .eq('fecha', params.fecha)
    .in('estado', ['pendiente', 'confirmada'])
    .maybeSingle()

  if (existing) return { error: 'Ya existe una reserva para este horario y fecha.' }

  const insertPayload: Record<string, unknown> = {
    horario_id:         params.horarioId,
    fecha:              params.fecha,
    auth_user_id:       params.authUserId,
    estudiante_nombre:  params.estudianteNombre,
    estudiante_carrera: params.estudianteCarrera ?? '',
    email:              params.estudianteEmail,
    telefono:           params.estudianteTelefono ?? '',
    notas:              params.nota ?? null,
    estado:             'confirmada',
  }

  if (params.tipoTutoriaId) {
    insertPayload.tipo_tutoria_id = params.tipoTutoriaId
  }

  const { data: reserva, error } = await db
    .from('reservas')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Send email notification (Resend) — non-blocking
  try {
    const { horarioId, fecha, estudianteNombre, estudianteEmail, nota } = params
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

    await enviarEmail({
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
    })
  } catch {
    // Email failure is non-blocking
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/tutorias')
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
  revalidatePath('/dashboard')
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
  revalidatePath('/dashboard')
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
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/tutorias')
  return {}
}

export async function marcarAsistenciaReserva(reservaId: number, asistio: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('reservas')
    .update({
      estado: 'completada',
      asistio,
      completada_at: now
    })
    .eq('id', reservaId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/tutorias')
  return {}
}

// ─── Register a manual (non-booked) tutoring session ─────────────────────────

export async function registrarTutoriaManual(params: {
  estudianteNombre: string
  estudianteEmail?: string
  estudianteCarrera?: string
  cursoId: string
  fecha: string           // YYYY-MM-DD
  horaInicio: string      // HH:MM
  horaFin?: string        // HH:MM
  estado: 'asistio' | 'no_asistio' | 'cancelado'
  notas?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('reservas').insert({
    horario_id:          null,
    fecha:               params.fecha,
    auth_user_id:        user.id,
    estudiante_nombre:   params.estudianteNombre,
    estudiante_carrera:  params.estudianteCarrera ?? '',
    email:               params.estudianteEmail ?? '',
    telefono:            '',
    notas:               params.notas ?? null,
    estado:              params.estado === 'asistio'    ? 'completada'
                       : params.estado === 'no_asistio' ? 'completada'
                       : 'cancelado',
    profesor_id:         user.id,
    origen:              'manual',
    curso_id:            params.cursoId,
    hora_inicio_manual:  params.horaInicio,
    hora_fin_manual:     params.horaFin ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/tutorias')
  return { ok: true }
}

// ─── Fetch enriched historial for the historial tab ──────────────────────────

export type ReservaHistorial = {
  id: number
  fecha: string
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  notas: string | null
  estado: string
  origen: string
  curso_id: string | null
  hora_inicio_manual: string | null
  hora_fin_manual: string | null
  horario_hora_inicio: string | null
  horario_hora_fin: string | null
  asignatura: string | null
  institucion: string | null
  citacion_razon: string | null
}

export async function getHistorialTutorias(): Promise<ReservaHistorial[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from('reservas')
    .select(`
      id, fecha, estudiante_nombre, estudiante_carrera, email, notas, estado, origen,
      auth_user_id, curso_id, hora_inicio_manual, hora_fin_manual,
      horarios ( hora_inicio, hora_fin ),
      cursos ( asignatura, institucion ),
      citaciones_tutoria ( razon )
    `)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('getHistorialTutorias:', error)
    return []
  }

  // Derive curso_id for student-booked reservas (RPC doesn't store it)
  // by looking up the student's enrollment via auth_user_id
  const sinCurso = (data ?? []).filter((r: { curso_id: string | null; auth_user_id: string | null }) =>
    !r.curso_id && r.auth_user_id
  )
  const authIds = [...new Set(sinCurso.map((r: { auth_user_id: string }) => r.auth_user_id))]

  const cursoByAuthId: Record<string, string> = {}
  if (authIds.length > 0) {
    const { data: ests } = await db
      .from('estudiantes')
      .select('auth_user_id, curso_id')
      .in('auth_user_id', authIds)
      .eq('profesor_id', user.id)
      .not('curso_id', 'is', null)
    for (const e of (ests ?? []) as { auth_user_id: string; curso_id: string }[]) {
      if (e.auth_user_id && e.curso_id) cursoByAuthId[e.auth_user_id] = e.curso_id
    }
  }

  return (data ?? []).map((r: {
    id: number
    fecha: string
    estudiante_nombre: string
    estudiante_carrera: string
    email: string
    notas: string | null
    estado: string
    origen: string
    auth_user_id: string | null
    curso_id: string | null
    hora_inicio_manual: string | null
    hora_fin_manual: string | null
    horarios: { hora_inicio: string; hora_fin: string } | null
    cursos: { asignatura: string; institucion: string } | null
    citaciones_tutoria: { razon: string }[] | null
  }) => ({
    id:                  r.id,
    fecha:               r.fecha,
    estudiante_nombre:   r.estudiante_nombre,
    estudiante_carrera:  r.estudiante_carrera,
    email:               r.email,
    notas:               r.notas,
    estado:              r.estado,
    origen:              r.origen ?? 'agendada',
    curso_id:            r.curso_id ?? (r.auth_user_id ? cursoByAuthId[r.auth_user_id] ?? null : null),
    hora_inicio_manual:  r.hora_inicio_manual,
    hora_fin_manual:     r.hora_fin_manual,
    horario_hora_inicio: r.horarios?.hora_inicio ?? null,
    horario_hora_fin:    r.horarios?.hora_fin ?? null,
    asignatura:          r.cursos?.asignatura ?? null,
    institucion:         r.cursos?.institucion ?? null,
    citacion_razon:      r.citaciones_tutoria?.[0]?.razon ?? null,
  }))
}

// ─── Tipos de tutoría ─────────────────────────────────────────────────────────

export type TipoTutoria = {
  id: number
  nombre: string
  duracion_minutos: number
  descripcion: string | null
  activo: boolean
  orden: number
  es_global: boolean
}

/**
 * Retorna los tipos de tutoría globales (profesor_id IS NULL) más los
 * tipos propios del profesor autenticado (o del profesorId indicado).
 */
export async function getTiposTutoria(profesorId?: string): Promise<{
  tipos: TipoTutoria[]
  error?: string
}> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tipos: [], error: 'No autenticado' }

  const targetProfesorId = profesorId ?? user.id

  // Traer globales + propios del profesor en una sola query
  const { data, error } = await db
    .from('tipos_tutoria')
    .select('id, nombre, duracion_minutos, descripcion, activo, orden, profesor_id')
    .or(`profesor_id.is.null,profesor_id.eq.${targetProfesorId}`)
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (error) return { tipos: [], error: error.message }

  const tipos: TipoTutoria[] = (data ?? []).map((t: {
    id: number
    nombre: string
    duracion_minutos: number
    descripcion: string | null
    activo: boolean
    orden: number
    profesor_id: string | null
  }) => ({
    id:               t.id,
    nombre:           t.nombre,
    duracion_minutos: t.duracion_minutos,
    descripcion:      t.descripcion,
    activo:           t.activo,
    orden:            t.orden,
    es_global:        t.profesor_id === null,
  }))

  return { tipos }
}

/**
 * Crea un tipo de tutoría propio del profesor autenticado.
 */
export async function crearTipoTutoria(input: {
  nombre: string
  duracion_minutos: number
  descripcion?: string
}): Promise<{ id?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.nombre?.trim()) return { error: 'El nombre es obligatorio' }
  if (!input.duracion_minutos || input.duracion_minutos < 5) {
    return { error: 'La duración mínima es 5 minutos' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Obtener el mayor orden actual para este profesor
  const { data: last } = await db
    .from('tipos_tutoria')
    .select('orden')
    .eq('profesor_id', user.id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nuevoOrden = (last?.orden ?? 0) + 1

  const { data, error } = await db
    .from('tipos_tutoria')
    .insert({
      profesor_id:      user.id,
      nombre:           input.nombre.trim(),
      duracion_minutos: input.duracion_minutos,
      descripcion:      input.descripcion?.trim() ?? null,
      activo:           true,
      orden:            nuevoOrden,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/tutorias')
  return { id: data?.id }
}

/**
 * Actualiza un tipo de tutoría propio del profesor.
 * No permite modificar tipos globales (profesor_id IS NULL).
 */
export async function actualizarTipoTutoria(
  id: number,
  input: {
    nombre?: string
    duracion_minutos?: number
    descripcion?: string
    activo?: boolean
    orden?: number
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar que el tipo pertenece al profesor (protección extra sobre RLS)
  const { data: existing } = await db
    .from('tipos_tutoria')
    .select('profesor_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return { error: 'Tipo no encontrado' }
  if (existing.profesor_id === null) return { error: 'No puedes editar tipos globales' }
  if (existing.profesor_id !== user.id) return { error: 'Sin permiso para editar este tipo' }

  const updatePayload: Record<string, unknown> = {}
  if (input.nombre !== undefined)           updatePayload.nombre = input.nombre.trim()
  if (input.duracion_minutos !== undefined) updatePayload.duracion_minutos = input.duracion_minutos
  if (input.descripcion !== undefined)      updatePayload.descripcion = input.descripcion.trim() || null
  if (input.activo !== undefined)           updatePayload.activo = input.activo
  if (input.orden !== undefined)            updatePayload.orden = input.orden

  if (Object.keys(updatePayload).length === 0) return {}

  const { error } = await db
    .from('tipos_tutoria')
    .update(updatePayload)
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/tutorias')
  return {}
}

/**
 * Elimina un tipo de tutoría propio del profesor.
 * No permite eliminar tipos globales.
 */
export async function eliminarTipoTutoria(id: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar propiedad antes de eliminar
  const { data: existing } = await db
    .from('tipos_tutoria')
    .select('profesor_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return { error: 'Tipo no encontrado' }
  if (existing.profesor_id === null) return { error: 'No puedes eliminar tipos globales' }
  if (existing.profesor_id !== user.id) return { error: 'Sin permiso para eliminar este tipo' }

  const { error } = await db
    .from('tipos_tutoria')
    .delete()
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/tutorias')
  return {}
}

/**
 * Reordena los tipos de tutoría propios del profesor en batch.
 * `ids` es el array de IDs en el orden deseado (índice 0 → orden 1).
 */
export async function reordenarTiposTutoria(ids: number[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const updates = ids.map((id, index) =>
    db
      .from('tipos_tutoria')
      .update({ orden: index + 1 })
      .eq('id', id)
      .eq('profesor_id', user.id) // solo puede reordenar los suyos
  )

  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)
  if (firstError?.error) return { error: firstError.error.message }

  revalidatePath('/dashboard/tutorias')
  return {}
}
