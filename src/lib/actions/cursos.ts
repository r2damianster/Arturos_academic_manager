'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CursoSchema = z.object({
  codigo:         z.string().min(2).max(30),
  asignatura:     z.string().min(3).max(100),
  periodo:        z.string().min(3).max(20),
  aula:           z.string().max(100).optional(),
  fecha_inicio:   z.string().optional(),
  fecha_fin:      z.string().optional(),
  horas_semana:   z.coerce.number().int().min(1).max(200).default(64),
  num_sesiones:   z.coerce.number().int().min(1).max(200).default(32),
  horas_teoricas: z.coerce.number().int().min(1).max(200).default(64),
  num_parciales:  z.coerce.number().int().min(2).max(4).default(2),
})

type HorarioInput = { dia_semana: string; hora_inicio: string; hora_fin: string; tipo?: string; centro_computo?: boolean }

function buildHorariosInserts(horarios: HorarioInput[], cursoId: string, profesorId: string) {
  return horarios.map(h => ({
    curso_id: cursoId,
    profesor_id: profesorId,
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fin: h.hora_fin,
    tipo: h.tipo || 'clase',
    centro_computo: h.centro_computo ?? false,
  }))
}

function parseCursoData(raw: z.infer<typeof CursoSchema>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { aula: _aula, ...data } = raw
  return {
    ...data,
    fecha_inicio: data.fecha_inicio || null,
    fecha_fin: data.fecha_fin || null,
  }
}

// Las Server Actions usadas en <form action={}> deben retornar void | Promise<void>
// Para manejo de errores usamos state con useActionState o redireccionamos

export async function crearCurso(_prev: unknown, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const parsed = CursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { error } = await supabase.from('cursos').insert({ ...parseCursoData(parsed.data), profesor_id: user.id })
  if (error) return

  revalidatePath('/dashboard/cursos')
  redirect('/dashboard/cursos')
}

export async function crearCursoAction(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const parsed = CursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { data: curso, error } = await supabase.from('cursos')
    .insert({ ...parseCursoData(parsed.data), profesor_id: user.id })
    .select('id').single()

  if (error || !curso) return

  const horariosJson = formData.get('horarios_clases') as string
  if (horariosJson) {
    try {
      const horarios: HorarioInput[] = JSON.parse(horariosJson)
      if (Array.isArray(horarios) && horarios.length > 0) {
        await supabase.from('horarios_clases').insert(buildHorariosInserts(horarios, curso.id, user.id))
      }
    } catch (e) {
      console.error('Error parsing horarios_clases JSON:', e)
    }
  }

  revalidatePath('/dashboard/cursos')
  redirect('/dashboard/cursos')
}

export async function actualizarCurso(cursoId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const parsed = CursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  await supabase.from('cursos')
    .update(parseCursoData(parsed.data))
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard/cursos')
}

export async function eliminarCurso(cursoId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('cursos')
    .delete()
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  revalidatePath('/dashboard/cursos')
  redirect('/dashboard/cursos')
}

const DetallesCursoSchema = z.object({
  asignatura:   z.string().min(3).max(100),
  codigo:       z.string().min(2).max(30),
  periodo:      z.string().min(3).max(20),
  fecha_inicio: z.string().optional(),
  fecha_fin:    z.string().optional(),
})

export async function actualizarDetallesCurso(cursoId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = DetallesCursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { error } = await supabase.from('cursos')
    .update({
      asignatura:   parsed.data.asignatura,
      codigo:       parsed.data.codigo,
      periodo:      parsed.data.periodo,
      fecha_inicio: parsed.data.fecha_inicio || null,
      fecha_fin:    parsed.data.fecha_fin || null,
    })
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/cursos')
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  return {}
}

export async function actualizarHorariosCurso(cursoId: string, horarios: { dia_semana: string, hora_inicio: string, hora_fin: string, tipo?: string, centro_computo?: boolean }[]): Promise<{ok: boolean, error?: string}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // 1. Verify ownership of the course
  const { data: curso } = await supabase.from('cursos').select('id').eq('id', cursoId).eq('profesor_id', user.id).single()
  if (!curso) return { ok: false, error: 'Course not found or unauthorized' }

  // 2. Delete all existing horarios for this course
  await supabase.from('horarios_clases').delete().eq('curso_id', cursoId)

  // 3. Insert new horarios
  if (horarios && horarios.length > 0) {
    const { error } = await supabase.from('horarios_clases').insert(buildHorariosInserts(horarios, cursoId, user.id))
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard/tutorias')
  revalidatePath('/dashboard')

  return { ok: true }
}
