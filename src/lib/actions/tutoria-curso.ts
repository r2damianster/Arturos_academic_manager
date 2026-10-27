'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Sesión grupal de tutoría de curso (horarios_clases.tipo = 'tutoria_curso').
// Se guarda en `reservas` (origen 'sesion_curso'): es historial de tutorías, NO toca `asistencia`,
// promedios ni riesgo. Faltar no exige justificación; solo los citados tienen seguimiento.

export interface SesionTutoriaCursoInput {
  horarioClaseId: string
  cursoId: string
  fecha: string            // YYYY-MM-DD
  horaInicio: string       // HH:MM
  horaFin: string          // HH:MM
  asistentesIds: string[]  // estudiantes.id que asistieron; el resto queda como "No asistió"
}

export interface EstudianteSesionTutoria {
  id: string
  nombre: string
  citacionId: string | null
  citacionEstado: string | null
  anunciado: boolean
}

export interface ContextoSesionTutoriaCurso {
  asignatura: string
  horaInicio: string
  horaFin: string
  estudiantes: EstudianteSesionTutoria[]
  yaRegistrada: { total: number; asistieron: number } | null
}

export async function getContextoSesionTutoriaCurso(
  horarioClaseId: string,
  fecha: string
): Promise<{ error?: string; contexto?: ContextoSesionTutoriaCurso }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: horario } = await db
    .from('horarios_clases')
    .select('id, curso_id, hora_inicio, hora_fin, tipo, cursos ( asignatura )')
    .eq('id', horarioClaseId)
    .eq('profesor_id', user.id)
    .single()
  if (!horario || horario.tipo !== 'tutoria_curso') return { error: 'Tutoría de curso no encontrada' }

  const [estudiantesRes, citacionesRes, anunciosRes, sesionRes] = await Promise.all([
    db.from('estudiantes').select('id, nombre').eq('curso_id', horario.curso_id).eq('estado', 'activo').order('nombre'),
    db.from('citaciones_tutoria').select('id, estudiante_id, estado')
      .eq('curso_id', horario.curso_id).in('estado', ['pendiente', 'agendada']),
    db.from('anuncios_tutoria_curso').select('estudiante_id')
      .eq('horario_clase_id', horarioClaseId).eq('fecha', fecha),
    db.from('reservas').select('asistio')
      .eq('origen', 'sesion_curso').eq('curso_id', horario.curso_id).eq('fecha', fecha)
      .eq('hora_inicio_manual', horario.hora_inicio),
  ])

  const citacionPorEstudiante = new Map<string, { id: string; estado: string }>()
  for (const citacion of citacionesRes.data ?? []) {
    citacionPorEstudiante.set(citacion.estudiante_id, { id: citacion.id, estado: citacion.estado })
  }
  const anunciados = new Set<string>((anunciosRes.data ?? []).map((a: { estudiante_id: string }) => a.estudiante_id))

  const estudiantes: EstudianteSesionTutoria[] = (estudiantesRes.data ?? []).map((estudiante: { id: string; nombre: string }) => ({
    id: estudiante.id,
    nombre: estudiante.nombre,
    citacionId: citacionPorEstudiante.get(estudiante.id)?.id ?? null,
    citacionEstado: citacionPorEstudiante.get(estudiante.id)?.estado ?? null,
    anunciado: anunciados.has(estudiante.id),
  }))

  const filasSesion = sesionRes.data ?? []
  return {
    contexto: {
      asignatura: horario.cursos?.asignatura ?? '',
      horaInicio: horario.hora_inicio,
      horaFin: horario.hora_fin,
      estudiantes,
      yaRegistrada: filasSesion.length > 0
        ? { total: filasSesion.length, asistieron: filasSesion.filter((fila: { asistio: boolean }) => fila.asistio).length }
        : null,
    },
  }
}

export async function registrarSesionTutoriaCurso(
  input: SesionTutoriaCursoInput
): Promise<{ error?: string; total?: number; asistieron?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: horario } = await db
    .from('horarios_clases')
    .select('id, curso_id, tipo')
    .eq('id', input.horarioClaseId)
    .eq('profesor_id', user.id)
    .single()
  if (!horario || horario.tipo !== 'tutoria_curso' || horario.curso_id !== input.cursoId) {
    return { error: 'Tutoría de curso no válida' }
  }

  const { data: yaRegistrada } = await db
    .from('reservas')
    .select('id')
    .eq('origen', 'sesion_curso').eq('curso_id', input.cursoId).eq('fecha', input.fecha)
    .eq('hora_inicio_manual', input.horaInicio)
    .limit(1)
  if (yaRegistrada && yaRegistrada.length > 0) return { error: 'Esta sesión ya fue registrada' }

  const { data: estudiantes } = await db
    .from('estudiantes')
    .select('id, nombre, email, carrera')
    .eq('curso_id', input.cursoId)
    .eq('estado', 'activo')
  if (!estudiantes || estudiantes.length === 0) return { error: 'El curso no tiene estudiantes activos' }

  const asistentes = new Set(input.asistentesIds)
  const sesionGrupoId = randomUUID()

  const filas = estudiantes.map((estudiante: { id: string; nombre: string; email: string | null; carrera: string | null }) => ({
    horario_id: null,
    fecha: input.fecha,
    auth_user_id: user.id,                       // mismo criterio que registrarTutoriaManual
    estudiante_id: estudiante.id,
    estudiante_nombre: estudiante.nombre,
    estudiante_carrera: estudiante.carrera ?? '',
    email: estudiante.email ?? '',
    telefono: '',
    estado: 'completada',
    asistio: asistentes.has(estudiante.id),
    inasistencia_reconocida: true,               // faltar no exige justificación ni bloquea el portal
    profesor_id: user.id,
    origen: 'sesion_curso',
    curso_id: input.cursoId,
    hora_inicio_manual: input.horaInicio,
    hora_fin_manual: input.horaFin,
    sesion_grupo_id: sesionGrupoId,
    completada_at: new Date().toISOString(),
  }))

  const { data: reservasCreadas, error: errorInsert } = await db
    .from('reservas')
    .insert(filas)
    .select('id, estudiante_id')
  if (errorInsert) return { error: errorInsert.message }

  // Conectar con citaciones: asistió → 'asistida'; no asistió → 'no_asistida' (solo si no tiene cita individual agendada)
  const { data: citaciones } = await db
    .from('citaciones_tutoria')
    .select('id, estudiante_id, estado')
    .eq('curso_id', input.cursoId)
    .in('estado', ['pendiente', 'agendada'])

  const reservaPorEstudiante = new Map<string, number>(
    (reservasCreadas ?? []).map((reserva: { id: number; estudiante_id: string }) => [reserva.estudiante_id, reserva.id])
  )

  for (const citacion of citaciones ?? []) {
    const asistio = asistentes.has(citacion.estudiante_id)
    if (!asistio && citacion.estado === 'agendada') continue
    await db
      .from('citaciones_tutoria')
      .update({
        estado: asistio ? 'asistida' : 'no_asistida',
        reserva_id: asistio ? reservaPorEstudiante.get(citacion.estudiante_id) ?? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', citacion.id)
  }

  revalidatePath('/dashboard/tutorias')
  revalidatePath('/dashboard/planificacion')
  revalidatePath('/dashboard')
  return { total: filas.length, asistieron: asistentes.size }
}
