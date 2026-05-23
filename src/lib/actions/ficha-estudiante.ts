'use server'

import { createClient } from '@/lib/supabase/server'

export type FichaEstudianteData = {
  estudiante: {
    id: string
    nombre: string
    email: string
    auth_user_id: string | null
    tutoria: boolean
    estado: string
    nota_incidencia: string | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encuesta: Record<string, any> | null
  asistencia: {
    totalSesiones: number
    presentes: number
    ausentes: number
    atrasos: number
    pct: number | null
    ultimaObs: { fecha: string; obs: string } | null
  }
  participacion: {
    ultimas: { fecha: string; nivel: number | null; observacion: string | null }[]
    promedio: number | null
  }
  trabajos: {
    activos: number
    ultimo: {
      tipo: string
      tema: string | null
      estado: string | null
      progreso: number
      ultimaObs: string | null
    } | null
  }
  citaciones: {
    pendientes: number
    ultima: { razon: string; detalle_razon: string | null; estado: string } | null
  }
  grupoActual: { nombre: string; categoria: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encuestaParcial: Record<string, any> | null
}

export async function getFichaEstudiante(
  estudianteId: string,
  cursoId: string,
  bitacoraId?: string
): Promise<FichaEstudianteData | { error: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const [estRes, asistRes, partRes, trabajosRes, citRes] = await Promise.all([
    db.from('estudiantes')
      .select('id, nombre, email, auth_user_id, tutoria, estado, nota_incidencia')
      .eq('id', estudianteId)
      .eq('profesor_id', user.id)
      .single(),
    db.from('asistencia')
      .select('estado, observacion_part, fecha')
      .eq('estudiante_id', estudianteId)
      .eq('curso_id', cursoId)
      .order('fecha', { ascending: false })
      .limit(100),
    db.from('participacion')
      .select('fecha, nivel, observacion')
      .eq('estudiante_id', estudianteId)
      .eq('curso_id', cursoId)
      .order('fecha', { ascending: false })
      .limit(5),
    db.from('trabajos_asignados')
      .select('id, tipo, tema, estado, progreso, fecha_asignacion, observaciones_trabajo(observacion, fecha)')
      .eq('estudiante_id', estudianteId)
      .eq('curso_id', cursoId)
      .order('fecha_asignacion', { ascending: false })
      .limit(10),
    db.from('citaciones_tutoria')
      .select('razon, detalle_razon, estado, fecha_citacion')
      .eq('estudiante_id', estudianteId)
      .eq('curso_id', cursoId)
      .order('fecha_citacion', { ascending: false })
      .limit(10),
  ])

  if (estRes.error || !estRes.data) return { error: 'Estudiante no encontrado' }

  const estudiante = estRes.data as FichaEstudianteData['estudiante']

  // Encuesta completa (if has auth_user_id)
  let encuesta: Record<string, unknown> | null = null
  if (estudiante.auth_user_id) {
    const encRes = await db
      .from('encuesta_estudiante')
      .select('*')
      .eq('auth_user_id', estudiante.auth_user_id)
      .maybeSingle()
    encuesta = encRes.data ?? null
  }

  // Asistencia stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asistRows: any[] = asistRes.data ?? []
  const presentes = asistRows.filter((r: { estado: string }) => r.estado === 'Presente').length
  const ausentes = asistRows.filter((r: { estado: string }) => r.estado === 'Ausente').length
  const atrasos = asistRows.filter((r: { estado: string }) => r.estado === 'Atraso').length
  const total = asistRows.length
  const pct = total > 0 ? Math.round(presentes / total * 100) : null
  const ultObs = asistRows.find((r: { observacion_part: string | null }) => r.observacion_part)
  const ultimaObs = ultObs
    ? { fecha: ultObs.fecha as string, obs: ultObs.observacion_part as string }
    : null

  // Participacion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partRows: any[] = partRes.data ?? []
  const nivelesValidos = partRows.map((r: { nivel: number | null }) => r.nivel).filter((n): n is number => n !== null)
  const promedio = nivelesValidos.length > 0
    ? Math.round(nivelesValidos.reduce((a: number, b: number) => a + b, 0) / nivelesValidos.length * 10) / 10
    : null

  // Trabajos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trabajosRows: any[] = trabajosRes.data ?? []
  const activos = trabajosRows.filter((t: { estado: string }) => t.estado === 'Pendiente' || t.estado === 'En progreso').length
  const ultTrabajo = trabajosRows.find((t: { estado: string }) =>
    t.estado === 'Pendiente' || t.estado === 'En progreso'
  ) ?? trabajosRows[0] ?? null
  const ultimo = ultTrabajo
    ? {
        tipo: ultTrabajo.tipo as string,
        tema: ultTrabajo.tema as string | null,
        estado: ultTrabajo.estado as string | null,
        progreso: (ultTrabajo.progreso ?? 0) as number,
        ultimaObs: (ultTrabajo.observaciones_trabajo?.[0]?.observacion ?? null) as string | null,
      }
    : null

  // Citaciones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const citRows: any[] = citRes.data ?? []
  const pendientes = citRows.filter((c: { estado: string }) => c.estado === 'pendiente' || c.estado === 'agendada').length
  const ultCit = citRows[0] ?? null
  const ultimaCit = ultCit
    ? { razon: ultCit.razon as string, detalle_razon: ultCit.detalle_razon as string | null, estado: ultCit.estado as string }
    : null

  // Grupo actual (solo si hay bitacoraId)
  let grupoActual: FichaEstudianteData['grupoActual'] = null
  if (bitacoraId) {
    const grupoRes = await db
      .from('grupo_integrantes')
      .select('grupos_clase(nombre, grupo_categorias(nombre))')
      .eq('estudiante_id', estudianteId)
      .limit(1)
      .maybeSingle()
    if (grupoRes.data?.grupos_clase) {
      grupoActual = {
        nombre: grupoRes.data.grupos_clase.nombre as string,
        categoria: (grupoRes.data.grupos_clase.grupo_categorias?.nombre ?? '') as string,
      }
    }
  }

  // Encuesta parcial (si existe)
  const encuestaParcialRes = await db
    .from('encuesta_parcial')
    .select('trabaja_actual, tipo_trabajo_actual, horas_trabajo_actual, tiene_laptop_actual, situacion_vivienda_actual, carrera_sigue_deseada, horas_dedicacion_estudio, cambios_perfil, autopercepcion_aprendizaje, esfuerzo_dedicado, comprension_temas_propia, dificultades, created_at, semana_iso, porcentaje_curso')
    .eq('estudiante_id', estudianteId)
    .eq('curso_id', cursoId)
    .eq('tipo', 'mitad')
    .maybeSingle()
  const encuestaParcial = encuestaParcialRes.data ?? null

  return {
    estudiante,
    encuesta,
    asistencia: { totalSesiones: total, presentes, ausentes, atrasos, pct, ultimaObs },
    participacion: { ultimas: partRows, promedio },
    trabajos: { activos, ultimo },
    citaciones: { pendientes, ultima: ultimaCit },
    grupoActual,
    encuestaParcial,
  }
}
