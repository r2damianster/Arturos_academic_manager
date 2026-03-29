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
  await (supabase as any).from('cursos').insert({
    ...parsed.data,
    profesor_id: user.id,
    fecha_inicio: parsed.data.fecha_inicio || null,
    fecha_fin: parsed.data.fecha_fin || null,
  })

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
