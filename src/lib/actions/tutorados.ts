'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TutoradoPerfilSchema = z.object({
  modalidad_trabajo:    z.enum(['pregrado', 'maestria', 'doctorado', 'tecnologia', 'otro']).optional(),
  tipo_trabajo:         z.enum(['articulo_cientifico', 'sistematizacion_experiencias', 'creacion_productos', 'examen_complexivo', 'proyecto_investigacion', 'otro']).optional(),
  titulo_trabajo:       z.string().max(300).optional(),
  etapa:                z.string().max(100).optional(),
  progreso_pct:         z.coerce.number().int().min(0).max(100).optional(),
  fecha_asignacion:     z.string().optional(),
  num_periodos:         z.coerce.number().int().min(1).max(10).optional(),
  fecha_proyectada_fin: z.string().optional(),
  numero_oficio:        z.string().max(100).optional(),
  universidad:          z.string().max(200).optional(),
  facultad:             z.string().max(200).optional(),
  carrera_tutorado:     z.string().max(200).optional(),
  asignatura_tutorado:  z.string().max(200).optional(),
  publicado:            z.coerce.boolean().optional(),
  fecha_publicacion:    z.string().optional(),
  referencia_publicacion: z.string().max(500).optional(),
  dia_semana:           z.string().optional(),
  hora_inicio:          z.string().optional(),
  hora_fin:             z.string().optional(),
  modalidad_sesion:     z.enum(['presencial', 'virtual', 'whatsapp', 'telefono', 'otro']).optional(),
  nota_horario:         z.string().max(300).optional(),
})

const SesionSchema = z.object({
  fecha:            z.string(),
  modalidad:        z.enum(['presencial', 'virtual', 'whatsapp', 'telefono', 'otro']),
  duracion_minutos: z.coerce.number().int().min(1).optional(),
  lo_realizado:     z.string().max(2000).optional(),
  proximo_paso:     z.string().max(2000).optional(),
})

export type TutoradoPerfil = z.infer<typeof TutoradoPerfilSchema>
export type Sesion = z.infer<typeof SesionSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type TutoradoItem = {
  id: string
  nombre: string
  email: string
  curso_id: string
  asignatura: string
  periodo: string
  perfil: {
    modalidad_trabajo: string | null
    tipo_trabajo: string | null
    titulo_trabajo: string | null
    etapa: string | null
    progreso_pct: number
    fecha_asignacion: string | null
    num_periodos: number | null
    fecha_proyectada_fin: string | null
    numero_oficio: string | null
    universidad: string | null
    facultad: string | null
    carrera_tutorado: string | null
    asignatura_tutorado: string | null
    dia_semana: string | null
    hora_inicio: string | null
    hora_fin: string | null
    modalidad_sesion: string
    nota_horario: string | null
    publicado: boolean
    fecha_publicacion: string | null
    referencia_publicacion: string | null
    estado: string
    finalizado_at: string | null
    resultado: string | null
    nota_final: string | null
  } | null
  ultima_sesion: {
    fecha: string
    modalidad: string
    proximo_paso: string | null
  } | null
  total_sesiones: number
}

export type SesionItem = {
  id: string
  fecha: string
  modalidad: string
  duracion_minutos: number | null
  lo_realizado: string | null
  proximo_paso: string | null
  created_at: string
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTodosTutorados(): Promise<{ data: TutoradoItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'No autenticado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: cursos, error: cErr } = await db
    .from('cursos')
    .select('id, asignatura, periodo')
    .eq('profesor_id', user.id)
    .eq('tipo', 'tutorados')

  if (cErr) return { data: [], error: cErr.message }
  if (!cursos || cursos.length === 0) return { data: [] }

  const cursoIds = cursos.map((c: { id: string }) => c.id)
  const cursoMap = Object.fromEntries(cursos.map((c: { id: string; asignatura: string; periodo: string }) => [c.id, c]))

  const [estudiantesRes, perfilesRes, sesionesRes] = await Promise.all([
    db.from('estudiantes')
      .select('id, nombre, email, curso_id')
      .in('curso_id', cursoIds)
      .eq('estado', 'activo')
      .order('nombre'),
    db.from('tutorado_perfil')
      .select('*')
      .in('curso_id', cursoIds),
    db.from('tutorado_sesiones')
      .select('estudiante_id, fecha, modalidad, proximo_paso, created_at')
      .in('curso_id', cursoIds)
      .order('fecha', { ascending: false }),
  ])

  const perfilMap = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (perfilesRes.data ?? []).map((p: any) => [`${p.estudiante_id}:${p.curso_id}`, p])
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesionesMap: Record<string, { fecha: string; modalidad: string; proximo_paso: string | null; count: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conteoMap: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sesionesRes.data ?? []) as any[]) {
    const key = `${s.estudiante_id}:${s.curso_id ?? ''}`
    conteoMap[s.estudiante_id] = (conteoMap[s.estudiante_id] ?? 0) + 1
    if (!sesionesMap[s.estudiante_id]) {
      sesionesMap[s.estudiante_id] = { fecha: s.fecha, modalidad: s.modalidad, proximo_paso: s.proximo_paso, count: 1 }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: TutoradoItem[] = (estudiantesRes.data ?? []).map((e: any) => ({
    id: e.id,
    nombre: e.nombre,
    email: e.email,
    curso_id: e.curso_id,
    asignatura: cursoMap[e.curso_id]?.asignatura ?? '',
    periodo: cursoMap[e.curso_id]?.periodo ?? '',
    perfil: perfilMap[`${e.id}:${e.curso_id}`] ?? null,
    ultima_sesion: sesionesMap[e.id] ?? null,
    total_sesiones: conteoMap[e.id] ?? 0,
  }))

  return { data }
}

export async function getTutorados(cursoId: string): Promise<{ data: TutoradoItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'No autenticado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: curso } = await db
    .from('cursos').select('asignatura, periodo').eq('id', cursoId).single()

  const [estudiantesRes, perfilesRes, sesionesRes] = await Promise.all([
    db.from('estudiantes')
      .select('id, nombre, email, curso_id')
      .eq('curso_id', cursoId)
      .eq('estado', 'activo')
      .order('nombre'),
    db.from('tutorado_perfil')
      .select('*')
      .eq('curso_id', cursoId),
    db.from('tutorado_sesiones')
      .select('estudiante_id, fecha, modalidad, proximo_paso')
      .eq('curso_id', cursoId)
      .order('fecha', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfilMap = Object.fromEntries((perfilesRes.data ?? []).map((p: any) => [p.estudiante_id, p]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesionesMap: Record<string, { fecha: string; modalidad: string; proximo_paso: string | null }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conteoMap: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sesionesRes.data ?? []) as any[]) {
    conteoMap[s.estudiante_id] = (conteoMap[s.estudiante_id] ?? 0) + 1
    if (!sesionesMap[s.estudiante_id]) {
      sesionesMap[s.estudiante_id] = { fecha: s.fecha, modalidad: s.modalidad, proximo_paso: s.proximo_paso }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: TutoradoItem[] = (estudiantesRes.data ?? []).map((e: any) => ({
    id: e.id,
    nombre: e.nombre,
    email: e.email,
    curso_id: cursoId,
    asignatura: curso?.asignatura ?? '',
    periodo: curso?.periodo ?? '',
    perfil: perfilMap[e.id] ?? null,
    ultima_sesion: sesionesMap[e.id] ?? null,
    total_sesiones: conteoMap[e.id] ?? 0,
  }))

  return { data }
}

export async function getSesionesTutorado(
  estudianteId: string,
  cursoId: string
): Promise<{ data: SesionItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'No autenticado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tutorado_sesiones')
    .select('id, fecha, modalidad, duracion_minutos, lo_realizado, proximo_paso, created_at')
    .eq('estudiante_id', estudianteId)
    .eq('curso_id', cursoId)
    .order('fecha', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: data ?? [] }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertTutoradoPerfil(
  estudianteId: string,
  cursoId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const raw = Object.fromEntries(formData)
  const parsed = TutoradoPerfilSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tutorado_perfil')
    .upsert({
      profesor_id:         user.id,
      estudiante_id:       estudianteId,
      curso_id:            cursoId,
      modalidad_trabajo:   d.modalidad_trabajo ?? null,
      tipo_trabajo:        d.tipo_trabajo ?? null,
      titulo_trabajo:      d.titulo_trabajo || null,
      etapa:               d.etapa || null,
      progreso_pct:        d.progreso_pct ?? 0,
      fecha_asignacion:    d.fecha_asignacion || null,
      num_periodos:        d.num_periodos ?? 1,
      fecha_proyectada_fin: d.fecha_proyectada_fin || null,
      numero_oficio:        d.numero_oficio || null,
      universidad:          d.universidad || null,
      facultad:             d.facultad || null,
      carrera_tutorado:     d.carrera_tutorado || null,
      asignatura_tutorado:  d.asignatura_tutorado || null,
      publicado:            d.publicado ?? false,
      fecha_publicacion:    d.fecha_publicacion || null,
      referencia_publicacion: d.referencia_publicacion || null,
      dia_semana:           d.dia_semana || null,
      hora_inicio:         d.hora_inicio || null,
      hora_fin:            d.hora_fin || null,
      modalidad_sesion:    d.modalidad_sesion ?? 'presencial',
      nota_horario:        d.nota_horario || null,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'estudiante_id,curso_id' })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/tutorados`)
  revalidatePath('/dashboard/tutorados')
  return {}
}

export async function registrarSesionTutorado(
  estudianteId: string,
  cursoId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = SesionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tutorado_sesiones')
    .insert({
      profesor_id:      user.id,
      estudiante_id:    estudianteId,
      curso_id:         cursoId,
      fecha:            d.fecha,
      modalidad:        d.modalidad,
      duracion_minutos: d.duracion_minutos ?? null,
      lo_realizado:     d.lo_realizado || null,
      proximo_paso:     d.proximo_paso || null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/tutorados`)
  revalidatePath('/dashboard/tutorados')
  return {}
}

export async function eliminarSesion(
  sesionId: string,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tutorado_sesiones')
    .delete()
    .eq('id', sesionId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/tutorados`)
  revalidatePath('/dashboard/tutorados')
  return {}
}

const FinalizarSchema = z.object({
  resultado: z.enum(['graduado', 'aprobado', 'abandono', 'otro']),
  nota_final: z.string().max(1000).optional(),
})

export async function finalizarTutorado(
  estudianteId: string,
  cursoId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = FinalizarSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tutorado_perfil')
    .upsert({
      profesor_id:    user.id,
      estudiante_id:  estudianteId,
      curso_id:       cursoId,
      estado:         'finalizado',
      finalizado_at:  new Date().toISOString(),
      resultado:      d.resultado,
      nota_final:     d.nota_final || null,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'estudiante_id,curso_id' })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/tutorados`)
  revalidatePath('/dashboard/tutorados')
  return {}
}

export async function reactivarTutorado(
  estudianteId: string,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tutorado_perfil')
    .upsert({
      profesor_id:    user.id,
      estudiante_id:  estudianteId,
      curso_id:       cursoId,
      estado:         'activo',
      finalizado_at:  null,
      resultado:      null,
      nota_final:     null,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'estudiante_id,curso_id' })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/tutorados`)
  revalidatePath('/dashboard/tutorados')
  return {}
}
