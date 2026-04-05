'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CursoSchema = z.object({
  codigo:         z.string().min(2).max(30),
  asignatura:     z.string().min(3).max(100),
  periodo:        z.string().min(3).max(20),
  fecha_inicio:   z.string().optional(),
  fecha_fin:      z.string().optional(),
  horas_semana:   z.coerce.number().int().min(1).max(200).default(64),
  num_sesiones:   z.coerce.number().int().min(1).max(200).default(32),
  horas_teoricas: z.coerce.number().int().min(1).max(200).default(64),
  num_parciales:  z.coerce.number().int().min(2).max(4).default(2),
})

// Las Server Actions usadas en <form action={}> deben retornar void | Promise<void>
// Para manejo de errores usamos state con useActionState o redireccionamos

export async function crearCurso(_prev: unknown, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const parsed = CursoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('cursos').insert({
    ...parsed.data,
    profesor_id: user.id,
    fecha_inicio: parsed.data.fecha_inicio || null,
    fecha_fin: parsed.data.fecha_fin || null,
  })

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curso, error } = await (supabase as any).from('cursos').insert({
    ...parsed.data,
    profesor_id: user.id,
    fecha_inicio: parsed.data.fecha_inicio || null,
    fecha_fin: parsed.data.fecha_fin || null,
  }).select('id').single()

  if (error || !curso) return

  // Parse horarios_clases if present
  const horariosJson = formData.get('horarios_clases') as string
  if (horariosJson) {
    try {
      const horarios = JSON.parse(horariosJson)
      if (Array.isArray(horarios) && horarios.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inserts = horarios.map((h: any) => ({
          curso_id: curso.id,
          profesor_id: user.id,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          tipo: h.tipo || 'clase'
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('horarios_clases').insert(inserts)
      }
    } catch {
      // Ignorar errores de parseo
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('cursos')
    .update({ ...parsed.data, fecha_inicio: parsed.data.fecha_inicio || null, fecha_fin: parsed.data.fecha_fin || null })
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard/cursos')
}

export async function eliminarCurso(cursoId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('cursos')
    .delete()
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  revalidatePath('/dashboard/cursos')
  redirect('/dashboard/cursos')
}

export async function actualizarHorariosCurso(cursoId: string, horarios: { dia_semana: string, hora_inicio: string, hora_fin: string, tipo?: string }[]): Promise<{ok: boolean, error?: string}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // 1. Verify ownership of the course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curso } = await (supabase as any).from('cursos').select('id').eq('id', cursoId).eq('profesor_id', user.id).single()
  if (!curso) return { ok: false, error: 'Course not found or unauthorized' }

  // 2. Delete all existing horarios for this course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('horarios_clases').delete().eq('curso_id', cursoId)

  // 3. Insert new horarios
  if (horarios && horarios.length > 0) {
    const inserts = horarios.map(h => ({
      curso_id: cursoId,
      profesor_id: user.id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      tipo: h.tipo || 'clase'
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('horarios_clases').insert(inserts)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard/tutorias')
  revalidatePath('/dashboard')
  
  return { ok: true }
}
