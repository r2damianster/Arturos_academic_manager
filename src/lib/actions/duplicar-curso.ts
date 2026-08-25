'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ─── Datos para armar el wizard de duplicación ────────────────────────────────

export type EstudianteParaMatricular = {
  id: string
  nombre: string
  email: string
  persona_id: string
  auth_user_id: string | null
  tutorado?: {
    modalidad_trabajo: string | null
    tipo_trabajo: string | null
    titulo_trabajo: string | null
    etapa: string | null
    progreso_pct: number | null
  } | null
}

export async function getCursoParaDuplicar(cursoId: string): Promise<{
  curso?: {
    id: string
    codigo: string
    asignatura: string
    periodo: string
    tipo: string
    institucion: string | null
    aula: string | null
  }
  estudiantes?: EstudianteParaMatricular[]
  error?: string
}> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: curso, error: cursoError } = await db.from('cursos')
    .select('id, codigo, asignatura, periodo, tipo, institucion, aula')
    .eq('id', cursoId).eq('profesor_id', user.id).single()
  if (cursoError || !curso) return { error: 'Curso no encontrado' }

  const { data: estudiantes, error: estError } = await supabase.from('estudiantes')
    .select('id, nombre, email, persona_id, auth_user_id')
    .eq('curso_id', cursoId).eq('estado', 'activo')
    .order('nombre', { ascending: true })
  if (estError) return { error: estError.message }

  let tutoradosMap: Record<string, EstudianteParaMatricular['tutorado']> = {}
  if (curso.tipo === 'tutorados' && estudiantes && estudiantes.length > 0) {
    const { data: perfiles } = await db.from('tutorado_perfil')
      .select('estudiante_id, modalidad_trabajo, tipo_trabajo, titulo_trabajo, etapa, progreso_pct')
      .eq('curso_id', cursoId)
      .in('estudiante_id', estudiantes.map((e: { id: string }) => e.id))
    tutoradosMap = Object.fromEntries(
      (perfiles ?? []).map((p: { estudiante_id: string } & Record<string, unknown>) => [p.estudiante_id, p])
    )
  }

  return {
    curso,
    estudiantes: (estudiantes ?? []).map(e => ({
      ...e,
      tutorado: tutoradosMap[e.id] ?? null,
    })),
  }
}

// ─── Duplicar curso ────────────────────────────────────────────────────────────

const DuplicarCursoSchema = z.object({
  codigo: z.string().min(2).max(30),
  periodo: z.string().min(3).max(20),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
  institucion: z.string().max(200).optional(),
  aula: z.string().max(100).optional(),
})

type DuplicarCursoInput = z.infer<typeof DuplicarCursoSchema> & {
  cursoOrigenId: string
  estudianteIdsContinuar: string[]
  estudiantesNuevos: { nombre: string; email: string }[]
}

export async function duplicarCurso(
  input: DuplicarCursoInput
): Promise<{ cursoId?: string; error?: string }> {
  const parsed = DuplicarCursoSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Curso origen — config a clonar
  const { data: origen, error: origenError } = await db.from('cursos')
    .select('asignatura, tipo, num_parciales, nombres_tareas, horas_semana, num_sesiones, horas_teoricas, observacion, encuesta_inicial_habilitada, encuesta_parcial_habilitada')
    .eq('id', input.cursoOrigenId).eq('profesor_id', user.id).single()
  if (origenError || !origen) return { error: 'Curso origen no encontrado' }

  // 2. Insertar curso nuevo
  const { data: nuevoCurso, error: cursoError } = await db.from('cursos')
    .insert({
      profesor_id: user.id,
      codigo: parsed.data.codigo,
      asignatura: origen.asignatura,
      periodo: parsed.data.periodo,
      tipo: origen.tipo,
      institucion: parsed.data.institucion || null,
      aula: parsed.data.aula || null,
      fecha_inicio: parsed.data.fecha_inicio || null,
      fecha_fin: parsed.data.fecha_fin || null,
      num_parciales: origen.num_parciales,
      nombres_tareas: origen.nombres_tareas,
      horas_semana: origen.horas_semana,
      num_sesiones: origen.num_sesiones,
      horas_teoricas: origen.horas_teoricas,
      observacion: origen.observacion,
      encuesta_inicial_habilitada: origen.encuesta_inicial_habilitada,
      encuesta_parcial_habilitada: origen.encuesta_parcial_habilitada,
    })
    .select('id').single()
  if (cursoError || !nuevoCurso) return { error: cursoError?.message || 'No se pudo crear el curso' }
  const nuevoCursoId = nuevoCurso.id as string

  // 3. Clonar horarios_clases
  const { data: horarios } = await supabase.from('horarios_clases')
    .select('dia_semana, hora_inicio, hora_fin, tipo, centro_computo, obligatoria')
    .eq('curso_id', input.cursoOrigenId)
  if (horarios && horarios.length > 0) {
    await supabase.from('horarios_clases').insert(
      horarios.map(h => ({ ...h, curso_id: nuevoCursoId, profesor_id: user.id }))
    )
  }

  // 4. Clonar logros de aprendizaje
  const { data: logros } = await db.from('logros_aprendizaje')
    .select('descripcion, orden')
    .eq('curso_id', input.cursoOrigenId)
  if (logros && logros.length > 0) {
    await db.from('logros_aprendizaje').insert(
      logros.map((l: { descripcion: string; orden: number }) => ({ ...l, curso_id: nuevoCursoId }))
    )
  }

  // 5. Matricular estudiantes que continúan — mismo persona_id, fila nueva (asistencia/notas empiezan en blanco)
  const idMapOrigenANuevo: Record<string, string> = {}
  if (input.estudianteIdsContinuar.length > 0) {
    const { data: continuan } = await supabase.from('estudiantes')
      .select('id, nombre, email, persona_id, auth_user_id')
      .eq('curso_id', input.cursoOrigenId)
      .in('id', input.estudianteIdsContinuar)

    if (continuan && continuan.length > 0) {
      const filas = continuan.map(e => {
        const nuevoId = randomUUID()
        idMapOrigenANuevo[e.id] = nuevoId
        return {
          id: nuevoId,
          profesor_id: user.id,
          curso_id: nuevoCursoId,
          nombre: e.nombre,
          email: e.email,
          persona_id: e.persona_id,
          auth_user_id: e.auth_user_id,
          estado: 'activo',
        }
      })
      const { error: matriculaError } = await supabase.from('estudiantes').insert(filas)
      if (matriculaError) return { error: matriculaError.message }
    }
  }

  // 6. Estudiantes nuevos (sin historial previo — persona_id se genera solo)
  const nuevos = input.estudiantesNuevos.filter(e => e.nombre?.trim() && e.email?.trim())
  if (nuevos.length > 0) {
    await supabase.from('estudiantes').upsert(
      nuevos.map(e => ({
        profesor_id: user.id,
        curso_id: nuevoCursoId,
        nombre: e.nombre.trim(),
        email: e.email.trim().toLowerCase(),
        estado: 'activo',
      })),
      { onConflict: 'curso_id,email', ignoreDuplicates: true }
    )
  }

  // 7. Tutorados — arrastrar perfil académico del periodo anterior (progreso, etapa, institución)
  if (origen.tipo === 'tutorados' && Object.keys(idMapOrigenANuevo).length > 0) {
    const { data: perfiles } = await db.from('tutorado_perfil')
      .select('estudiante_id, modalidad_trabajo, titulo_trabajo, etapa, progreso_pct, dia_semana, hora_inicio, hora_fin, modalidad_sesion, nota_horario, fecha_asignacion, num_periodos, fecha_proyectada_fin, numero_oficio, universidad, facultad, carrera_tutorado, asignatura_tutorado, tipo_trabajo, publicado, fecha_publicacion, referencia_publicacion')
      .eq('curso_id', input.cursoOrigenId)
      .in('estudiante_id', Object.keys(idMapOrigenANuevo))

    if (perfiles && perfiles.length > 0) {
      const nuevosPerfiles = perfiles.map((p: { estudiante_id: string; num_periodos: number | null } & Record<string, unknown>) => {
        const { estudiante_id, num_periodos, ...resto } = p
        return {
          ...resto,
          profesor_id: user.id,
          curso_id: nuevoCursoId,
          estudiante_id: idMapOrigenANuevo[estudiante_id],
          num_periodos: (num_periodos ?? 1) + 1,
          estado: 'activo',
        }
      })
      await db.from('tutorado_perfil').insert(nuevosPerfiles)
    }
  }

  revalidatePath('/dashboard/cursos')
  revalidatePath('/dashboard')
  return { cursoId: nuevoCursoId }
}
