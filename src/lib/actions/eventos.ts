'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EventoSchema = z.object({
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(1000).optional().nullable(),
  tipo: z.enum(['personal', 'académico', 'laboral', 'social', 'otro']),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().optional().nullable(),
  hora_fin: z.string().optional().nullable(),
  todo_el_dia: z.boolean().default(false),
  recurrente: z.boolean().default(false),
  recurrencia: z.enum(['diaria', 'semanal', 'mensual']).optional().nullable(),
  recurrencia_dias: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  recurrencia_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export type EventoInput = z.infer<typeof EventoSchema>

export type Evento = {
  id: string
  titulo: string
  descripcion: string | null
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  hora_inicio: string | null
  hora_fin: string | null
  todo_el_dia: boolean
  recurrente: boolean
  recurrencia: string | null
  recurrencia_dias: number[] | null
  recurrencia_hasta: string | null
  created_at: string
}

export async function crearEvento(data: EventoInput): Promise<{ error?: string; id?: string }> {
  const parsed = EventoSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from('eventos_profesor')
    .insert({ ...parsed.data, profesor_id: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard')
  return { id: row.id }
}

export async function eliminarEvento(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('eventos_profesor')
    .delete()
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard')
  return {}
}
