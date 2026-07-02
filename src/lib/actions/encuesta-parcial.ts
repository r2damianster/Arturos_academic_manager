'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const EncuestaParcialSchema = z.object({
  curso_id: z.string().uuid(),

  // S1: perfil
  trabaja_actual: z.string().optional(),
  tipo_trabajo_actual: z.string().optional(),
  horas_trabajo_actual: z.coerce.number().int().min(1).max(24).optional().nullable(),
  tiene_laptop_actual: z.boolean().optional(),
  tiene_pc_escritorio_actual: z.boolean().optional(),
  comparte_pc_actual: z.boolean().optional(),
  sin_computadora_actual: z.boolean().optional(),
  dispositivo_movil_actual: z.string().optional(),
  nivel_tecnologia_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  situacion_vivienda_actual: z.string().optional(),
  es_foraneo_actual: z.boolean().optional(),
  carrera_sigue_deseada: z.coerce.number().int().min(1).max(5).optional().nullable(),
  gusto_escritura_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_comprension_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_resumen_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_ideas_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_redaccion_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_tareas_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_verificacion_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_critico_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_traduccion_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  uso_ia_idiomas_actual: z.coerce.number().int().min(1).max(5).optional().nullable(),
  horas_dedicacion_estudio: z.string().optional(),

  // S2: autopercepción
  autopercepcion_aprendizaje: z.coerce.number().int().min(1).max(5).optional().nullable(),
  esfuerzo_dedicado: z.coerce.number().int().min(1).max(5).optional().nullable(),
  comprension_temas_propia: z.coerce.number().int().min(1).max(5).optional().nullable(),
  preparacion_evaluacion: z.coerce.number().int().min(1).max(5).optional().nullable(),
  cumplimiento_entregas: z.coerce.number().int().min(1).max(5).optional().nullable(),
  dificultades: z.array(z.string()).optional(),
  detalle_dificultades: z.string().max(1000).optional(),

  // S3: relevancia
  utilidad_profesional: z.coerce.number().int().min(1).max(5).optional().nullable(),
  aplicacion_practica: z.coerce.number().int().min(1).max(5).optional().nullable(),
  actualidad_contenidos: z.coerce.number().int().min(1).max(5).optional().nullable(),
  motivacion_post_curso: z.coerce.number().int().min(1).max(5).optional().nullable(),

  // S4: feedback docente
  claridad_explicaciones: z.coerce.number().int().min(1).max(5).optional().nullable(),
  pertinencia_tareas: z.coerce.number().int().min(1).max(5).optional().nullable(),
  claridad_instrucciones: z.coerce.number().int().min(1).max(5).optional().nullable(),
  ritmo_clase: z.coerce.number().int().min(1).max(5).optional().nullable(),
  calidad_recursos: z.coerce.number().int().min(1).max(5).optional().nullable(),
  justicia_evaluacion: z.coerce.number().int().min(1).max(5).optional().nullable(),
  retroalimentacion_recibida: z.coerce.number().int().min(1).max(5).optional().nullable(),
  puntualidad_docente: z.coerce.number().int().min(1).max(5).optional().nullable(),
  trato_docente: z.coerce.number().int().min(1).max(5).optional().nullable(),
  dominio_tema: z.coerce.number().int().min(1).max(5).optional().nullable(),
  estrategias_didacticas: z.coerce.number().int().min(1).max(5).optional().nullable(),
  disponibilidad_docente: z.coerce.number().int().min(1).max(5).optional().nullable(),
  satisfaccion_tutorias: z.coerce.number().int().min(1).max(5).optional().nullable(),
  facilidad_reserva_tutoria: z.coerce.number().int().min(1).max(5).optional().nullable(),

  // S5: texto libre
  fortalezas_curso: z.string().max(2000).optional(),
  sugerencias_mejora: z.string().max(2000).optional(),
  comentario_libre: z.string().max(2000).optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularPorcentajeCurso(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio).getTime()
  const fin = new Date(fechaFin).getTime()
  const ahora = Date.now()
  if (fin <= inicio) return 0
  return Math.min(100, Math.max(0, ((ahora - inicio) / (fin - inicio)) * 100))
}

// ─── Obtener encuesta existente del estudiante ────────────────────────────────

export async function getEncuestaParcialExistente(cursoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: estudiante } = await db
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('curso_id', cursoId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (!estudiante) return null

  const { data } = await db
    .from('encuesta_parcial')
    .select('*')
    .eq('estudiante_id', estudiante.id)
    .eq('curso_id', cursoId)
    .eq('tipo', 'mitad')
    .maybeSingle()

  return data ?? null
}

// ─── Guardar encuesta parcial ─────────────────────────────────────────────────

export async function guardarEncuestaParcial(
  rawData: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = EncuestaParcialSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const { curso_id, ...campos } = parsed.data

  // Obtener estudiante
  const { data: estudiante } = await db
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('curso_id', curso_id)
    .eq('estado', 'activo')
    .maybeSingle()

  if (!estudiante) return { error: 'Estudiante no encontrado en este curso' }

  // Obtener curso para calcular porcentaje
  const { data: curso } = await db
    .from('cursos')
    .select('fecha_inicio, fecha_fin')
    .eq('id', curso_id)
    .maybeSingle()

  const porcentaje_curso = curso?.fecha_inicio && curso?.fecha_fin
    ? calcularPorcentajeCurso(curso.fecha_inicio, curso.fecha_fin)
    : null

  const semana_iso = new Date().getUTCDay() === 0
    ? Math.ceil(new Date().getDate() / 7)
    : null

  // Obtener datos actuales de encuesta_estudiante para detectar cambios
  const { data: encuestaActual } = await db
    .from('encuesta_estudiante')
    .select('trabaja, tipo_trabajo, horas_trabajo_diarias, tiene_laptop, tiene_pc_escritorio, comparte_pc, sin_computadora, dispositivo_movil, nivel_tecnologia, situacion_vivienda, es_foraneo, carrera_actual_deseada, gusto_escritura, uso_ia_comprension, uso_ia_resumen, uso_ia_ideas, uso_ia_redaccion, uso_ia_tareas, uso_ia_verificacion, uso_ia_critico, uso_ia_traduccion, uso_ia_idiomas')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // Construir cambios_perfil (solo campos que cambiaron)
  const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}

  if (encuestaActual && campos.trabaja_actual !== undefined) {
    const trabajaAnterior = encuestaActual.trabaja ? (encuestaActual.tipo_trabajo ?? 'trabaja') : 'sin_trabajo'
    const trabajaNuevo = campos.trabaja_actual
    if (trabajaAnterior !== trabajaNuevo) {
      cambios.trabajo = {
        anterior: { trabaja: encuestaActual.trabaja, tipo: encuestaActual.tipo_trabajo, horas: encuestaActual.horas_trabajo_diarias },
        nuevo: { trabaja_actual: campos.trabaja_actual, tipo: campos.tipo_trabajo_actual, horas: campos.horas_trabajo_actual },
      }
    }
  }

  if (encuestaActual) {
    const tecAnterior = { laptop: encuestaActual.tiene_laptop, pc: encuestaActual.tiene_pc_escritorio, comparte: encuestaActual.comparte_pc, sin: encuestaActual.sin_computadora, movil: encuestaActual.dispositivo_movil }
    const tecNuevo = { laptop: campos.tiene_laptop_actual, pc: campos.tiene_pc_escritorio_actual, comparte: campos.comparte_pc_actual, sin: campos.sin_computadora_actual, movil: campos.dispositivo_movil_actual }
    if (JSON.stringify(tecAnterior) !== JSON.stringify(tecNuevo) &&
        campos.tiene_laptop_actual !== undefined) {
      cambios.tecnologia = { anterior: tecAnterior, nuevo: tecNuevo }
    }
    if (campos.situacion_vivienda_actual !== undefined &&
        campos.situacion_vivienda_actual !== encuestaActual.situacion_vivienda) {
      cambios.vivienda = { anterior: encuestaActual.situacion_vivienda, nuevo: campos.situacion_vivienda_actual }
    }
    if (campos.carrera_sigue_deseada !== undefined && campos.carrera_sigue_deseada !== null &&
        campos.carrera_sigue_deseada !== encuestaActual.carrera_actual_deseada) {
      cambios.carrera_deseada = { anterior: encuestaActual.carrera_actual_deseada, nuevo: campos.carrera_sigue_deseada }
    }

    // Uso IA: comparar los 9 campos
    const iaKeys = ['comprension', 'resumen', 'ideas', 'redaccion', 'tareas', 'verificacion', 'critico', 'traduccion', 'idiomas'] as const
    const iaAnterior: Record<string, unknown> = {}
    const iaNuevo: Record<string, unknown> = {}
    let iaChanged = false
    for (const k of iaKeys) {
      iaAnterior[k] = encuestaActual[`uso_ia_${k}`]
      const nuevaKey = `uso_ia_${k}_actual` as keyof typeof campos
      iaNuevo[k] = campos[nuevaKey]
      if (campos[nuevaKey] !== undefined && campos[nuevaKey] !== encuestaActual[`uso_ia_${k}`]) iaChanged = true
    }
    if (iaChanged) cambios.uso_ia = { anterior: iaAnterior, nuevo: iaNuevo }
  }

  // Actualizar encuesta_estudiante con nuevos valores si hubo cambios
  if (encuestaActual && Object.keys(cambios).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateEst: Record<string, any> = {}
    if (cambios.trabajo) {
      updateEst.trabaja = campos.trabaja_actual !== 'sin_trabajo'
      updateEst.tipo_trabajo = campos.tipo_trabajo_actual ?? null
      updateEst.horas_trabajo_diarias = campos.horas_trabajo_actual ?? null
    }
    if (cambios.tecnologia) {
      if (campos.tiene_laptop_actual !== undefined) updateEst.tiene_laptop = campos.tiene_laptop_actual
      if (campos.tiene_pc_escritorio_actual !== undefined) updateEst.tiene_pc_escritorio = campos.tiene_pc_escritorio_actual
      if (campos.comparte_pc_actual !== undefined) updateEst.comparte_pc = campos.comparte_pc_actual
      if (campos.sin_computadora_actual !== undefined) updateEst.sin_computadora = campos.sin_computadora_actual
      if (campos.dispositivo_movil_actual !== undefined) updateEst.dispositivo_movil = campos.dispositivo_movil_actual
      if (campos.nivel_tecnologia_actual !== undefined) updateEst.nivel_tecnologia = campos.nivel_tecnologia_actual
    }
    if (cambios.vivienda) updateEst.situacion_vivienda = campos.situacion_vivienda_actual
    if (cambios.carrera_deseada) updateEst.carrera_actual_deseada = campos.carrera_sigue_deseada
    if (cambios.uso_ia) {
      const iaKeys = ['comprension', 'resumen', 'ideas', 'redaccion', 'tareas', 'verificacion', 'critico', 'traduccion', 'idiomas'] as const
      for (const k of iaKeys) {
        const key = `uso_ia_${k}_actual` as keyof typeof campos
        if (campos[key] !== undefined) updateEst[`uso_ia_${k}`] = campos[key]
      }
    }
    if (Object.keys(updateEst).length > 0) {
      await db.from('encuesta_estudiante').update(updateEst).eq('auth_user_id', user.id)
    }
  }

  // UPSERT encuesta_parcial
  const { error } = await db
    .from('encuesta_parcial')
    .upsert({
      estudiante_id: estudiante.id,
      curso_id,
      auth_user_id: user.id,
      tipo: 'mitad',
      porcentaje_curso,
      semana_iso,
      cambios_perfil: cambios,
      ...campos,
    }, { onConflict: 'estudiante_id,curso_id,tipo' })

  if (error) return { error: error.message }

  revalidatePath('/student')
  return {}
}

// ─── Resultados para el profesor ─────────────────────────────────────────────

export async function getResultadosEncuestaParcial(cursoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [totalRes, encuestasRes] = await Promise.all([
    db.from('estudiantes').select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId).eq('profesor_id', user.id).eq('estado', 'activo'),
    db.from('encuesta_parcial')
      .select(`*, estudiantes!inner(nombre, email, auth_user_id)`)
      .eq('curso_id', cursoId)
      .eq('tipo', 'mitad'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encuestas: any[] = encuestasRes.data ?? []
  const total_activos = totalRes.count ?? 0

  // encuesta_estudiante no tiene FK hacia estudiantes (ambas apuntan a users vía
  // auth_user_id), así que no se puede embeber via PostgREST. Se resuelve aparte.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authIds = encuestas.map((e: any) => e.estudiantes?.auth_user_id).filter(Boolean)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iaInicialPorAuthId = new Map<string, any>()
  if (authIds.length > 0) {
    const { data: iaInicialData } = await db
      .from('encuesta_estudiante')
      .select('auth_user_id, uso_ia_comprension, uso_ia_resumen, uso_ia_ideas, uso_ia_redaccion, uso_ia_tareas, uso_ia_verificacion, uso_ia_critico, uso_ia_traduccion, uso_ia_idiomas')
      .in('auth_user_id', authIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (iaInicialData ?? []) as any[]) {
      iaInicialPorAuthId.set(row.auth_user_id, row)
    }
  }
  const total_respondieron = encuestas.length
  const porcentaje_respuesta = total_activos > 0
    ? Math.round(total_respondieron / total_activos * 100) : 0

  // Promedios por campo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function avg(campo: string): number | null {
    const vals = encuestas.map((e: any) => e[campo]).filter((v: any): v is number => v !== null && v !== undefined)
    return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10 : null
  }

  const promedios = {
    autopercepcion: {
      autopercepcion_aprendizaje: avg('autopercepcion_aprendizaje'),
      esfuerzo_dedicado: avg('esfuerzo_dedicado'),
      comprension_temas_propia: avg('comprension_temas_propia'),
      preparacion_evaluacion: avg('preparacion_evaluacion'),
      cumplimiento_entregas: avg('cumplimiento_entregas'),
    },
    relevancia: {
      utilidad_profesional: avg('utilidad_profesional'),
      aplicacion_practica: avg('aplicacion_practica'),
      actualidad_contenidos: avg('actualidad_contenidos'),
      motivacion_post_curso: avg('motivacion_post_curso'),
    },
    contenido: {
      claridad_explicaciones: avg('claridad_explicaciones'),
      pertinencia_tareas: avg('pertinencia_tareas'),
      claridad_instrucciones: avg('claridad_instrucciones'),
      ritmo_clase: avg('ritmo_clase'),
      calidad_recursos: avg('calidad_recursos'),
    },
    evaluacion: {
      justicia_evaluacion: avg('justicia_evaluacion'),
      retroalimentacion_recibida: avg('retroalimentacion_recibida'),
    },
    docente: {
      puntualidad_docente: avg('puntualidad_docente'),
      trato_docente: avg('trato_docente'),
      dominio_tema: avg('dominio_tema'),
      estrategias_didacticas: avg('estrategias_didacticas'),
      disponibilidad_docente: avg('disponibilidad_docente'),
    },
    tutorias: {
      satisfaccion_tutorias: avg('satisfaccion_tutorias'),
      facilidad_reserva_tutoria: avg('facilidad_reserva_tutoria'),
    },
  }

  // Distribucion dificultades
  const distDificultades: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of encuestas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of (e.dificultades ?? []) as string[]) {
      distDificultades[d] = (distDificultades[d] ?? 0) + 1
    }
  }

  // Cambios de perfil
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cambios_situacion = encuestas.filter((e: any) =>
    e.cambios_perfil && Object.keys(e.cambios_perfil).length > 0
  ).length

  // Comparativa uso IA
  const iaKeys = ['comprension', 'resumen', 'ideas', 'redaccion', 'tareas', 'verificacion', 'critico', 'traduccion', 'idiomas'] as const
  const comparativa_ia: Record<string, { anterior: number | null; actual: number | null }> = {}
  for (const k of iaKeys) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valsAnterior = encuestas
      .map((e: any) => iaInicialPorAuthId.get(e.estudiantes?.auth_user_id)?.[`uso_ia_${k}`])
      .filter((v: unknown): v is number => v !== null && v !== undefined)
    const valsActual = encuestas
      .map((e: any) => e[`uso_ia_${k}_actual`])
      .filter((v: unknown): v is number => v !== null && v !== undefined)
    comparativa_ia[k] = {
      anterior: valsAnterior.length > 0 ? Math.round(valsAnterior.reduce((a: number, b: number) => a + b, 0) / valsAnterior.length * 10) / 10 : null,
      actual: valsActual.length > 0 ? Math.round(valsActual.reduce((a: number, b: number) => a + b, 0) / valsActual.length * 10) / 10 : null,
    }
  }

  return {
    total_activos,
    total_respondieron,
    porcentaje_respuesta,
    promedios,
    distribucion_dificultades: distDificultades,
    cambios_situacion,
    comparativa_ia,
  }
}

// ─── Detalle por estudiante (para tabla del profesor) ────────────────────────

export async function getDetalleEncuestaParcial(cursoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await db
    .from('encuesta_parcial')
    .select('*, estudiantes!inner(nombre, email)')
    .eq('curso_id', cursoId)
    .eq('tipo', 'mitad')
    .order('estudiantes(nombre)')

  return data ?? []
}

// ─── Para FichaEstudianteDrawer ───────────────────────────────────────────────

export async function getEncuestaParcialParaDrawer(estudianteId: string, cursoId: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('encuesta_parcial')
    .select('trabaja_actual, tipo_trabajo_actual, horas_trabajo_actual, tiene_laptop_actual, situacion_vivienda_actual, carrera_sigue_deseada, horas_dedicacion_estudio, cambios_perfil, autopercepcion_aprendizaje, esfuerzo_dedicado, comprension_temas_propia, dificultades, created_at, semana_iso, porcentaje_curso')
    .eq('estudiante_id', estudianteId)
    .eq('curso_id', cursoId)
    .eq('tipo', 'mitad')
    .maybeSingle()

  return data ?? null
}

// ─── Estado de encuesta para student/page.tsx ─────────────────────────────────

export async function getEstadoEncuestasParciales(cursoIds: string[]): Promise<Record<string, boolean>> {
  if (cursoIds.length === 0) return {}
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Obtener todos los estudiante_ids del usuario para esos cursos
  const { data: estRows } = await db
    .from('estudiantes')
    .select('id, curso_id')
    .eq('auth_user_id', user.id)
    .in('curso_id', cursoIds)

  if (!estRows || estRows.length === 0) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudianteIds = estRows.map((e: any) => e.id)

  const { data: encuestas } = await db
    .from('encuesta_parcial')
    .select('estudiante_id, curso_id')
    .in('estudiante_id', estudianteIds)
    .in('curso_id', cursoIds)
    .eq('tipo', 'mitad')

  // Mapa curso_id → respondió?
  const resultado: Record<string, boolean> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (encuestas ?? []) as any[]) {
    resultado[e.curso_id] = true
  }
  return resultado
}

export async function getComparativaAutopercepcion(cursoId: string): Promise<{
  campos: { key: string; label: string }[]
  inicial: Record<string, number | null>
  parcial: Record<string, number | null>
} | null> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Verificar que el curso pertenece al profesor
    const { data: curso } = await db
      .from('cursos')
      .select('id')
      .eq('id', cursoId)
      .eq('profesor_id', user.id)
      .single()
    if (!curso) return null

    // Promedio de autopercepción en encuesta_parcial (tipo='mitad')
    const { data: parcialData } = await db
      .from('encuesta_parcial')
      .select('autopercepcion_aprendizaje, esfuerzo_dedicado, comprension_temas_propia, preparacion_evaluacion, cumplimiento_entregas')
      .eq('curso_id', cursoId)
      .eq('tipo', 'mitad')

    const parcial: Record<string, number | null> = {
      autopercepcion_aprendizaje: null,
      esfuerzo_dedicado: null,
      comprension_temas_propia: null,
      preparacion_evaluacion: null,
      cumplimiento_entregas: null,
    }

    if (parcialData && parcialData.length > 0) {
      for (const key of Object.keys(parcial)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vals = (parcialData as any[]).map((r: any) => r[key]).filter((v: any): v is number => typeof v === 'number')
        parcial[key] = vals.length > 0
          ? Math.round(vals.reduce((s: number, n: number) => s + n, 0) / vals.length * 10) / 10
          : null
      }
    }

    // Intentar obtener autopercepción inicial desde encuesta_estudiante
    const { data: estudiantesData } = await db
      .from('estudiantes')
      .select('auth_user_id')
      .eq('curso_id', cursoId)
      .not('auth_user_id', 'is', null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authIds = ((estudiantesData ?? []) as any[]).map((e: any) => e.auth_user_id).filter(Boolean)

    const inicial: Record<string, number | null> = {
      autopercepcion_aprendizaje: null,
      esfuerzo_dedicado: null,
      comprension_temas_propia: null,
      preparacion_evaluacion: null,
      cumplimiento_entregas: null,
    }

    if (authIds.length > 0) {
      try {
        // Verificar qué campos existen en encuesta_estudiante tomando una fila de muestra
        const { data: inicialSample } = await db
          .from('encuesta_estudiante')
          .select('*')
          .in('auth_user_id', authIds)
          .limit(1)

        if (inicialSample && inicialSample.length > 0) {
          const sampleRow = inicialSample[0]
          const campoMapping: Record<string, string> = {
            autopercepcion_aprendizaje: 'autopercepcion_aprendizaje',
            esfuerzo_dedicado: 'esfuerzo_dedicado',
            comprension_temas_propia: 'comprension_temas_propia',
            preparacion_evaluacion: 'preparacion_evaluacion',
            cumplimiento_entregas: 'cumplimiento_entregas',
          }

          // Solo leer campos que realmente existen en la tabla
          const camposExistentes = Object.entries(campoMapping)
            .filter(([, srcKey]) => srcKey in sampleRow)
            .map(([destKey, srcKey]) => ({ destKey, srcKey }))

          if (camposExistentes.length > 0) {
            const selectFields = camposExistentes.map(c => c.srcKey).join(', ')
            const { data: allInicialData } = await db
              .from('encuesta_estudiante')
              .select(selectFields)
              .in('auth_user_id', authIds)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (allInicialData && (allInicialData as any[]).length > 0) {
              for (const { destKey, srcKey } of camposExistentes) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const vals = (allInicialData as any[]).map((r: any) => r[srcKey]).filter((v: any): v is number => typeof v === 'number')
                if (vals.length > 0) {
                  inicial[destKey] = Math.round(vals.reduce((s: number, n: number) => s + n, 0) / vals.length * 10) / 10
                }
              }
            }
          }
        }
      } catch {
        // encuesta_estudiante no tiene estos campos — inicial queda en null
      }
    }

    const campos = [
      { key: 'autopercepcion_aprendizaje', label: 'Nivel de aprendizaje percibido' },
      { key: 'esfuerzo_dedicado', label: 'Esfuerzo dedicado al curso' },
      { key: 'comprension_temas_propia', label: 'Comprensión de los temas' },
      { key: 'preparacion_evaluacion', label: 'Preparación para evaluaciones' },
      { key: 'cumplimiento_entregas', label: 'Cumplimiento de entregas' },
    ]

    return { campos, inicial, parcial }
  } catch {
    return null
  }
}
