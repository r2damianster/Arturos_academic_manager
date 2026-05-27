'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export interface Reemplazante {
  id: string
  email_reemplazante: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

const ReemplazanteSchema = z.object({
  email_reemplazante: z.string().email('Email inválido'),
  nombre: z.string().min(2, 'Nombre requerido').max(100),
  fecha_inicio: z.string().min(1, 'Fecha inicio requerida'),
  fecha_fin: z.string().min(1, 'Fecha fin requerida'),
})

export async function getReemplazantes(): Promise<Reemplazante[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('reemplazantes')
    .select('id, email_reemplazante, nombre, fecha_inicio, fecha_fin, activo')
    .order('fecha_inicio', { ascending: false })
  return (data ?? []) as Reemplazante[]
}

export async function agregarReemplazante(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = ReemplazanteSchema.safeParse({
    email_reemplazante: formData.get('email_reemplazante'),
    nombre: formData.get('nombre'),
    fecha_inicio: formData.get('fecha_inicio'),
    fecha_fin: formData.get('fecha_fin'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { fecha_inicio, fecha_fin } = parsed.data
  if (new Date(fecha_fin) < new Date(fecha_inicio)) {
    return { error: 'La fecha de fin debe ser posterior a la fecha de inicio' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('reemplazantes').insert({
    profesor_id: user.id,
    ...parsed.data,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/config')
  return {}
}

export async function toggleReemplazante(id: string, activo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('reemplazantes')
    .update({ activo })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/config')
  return {}
}

export async function eliminarReemplazante(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('reemplazantes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/config')
  return {}
}

export async function verificarEsReemplazante(email: string): Promise<{ profesorId: string; nombre: string } | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db.rpc('get_reemplazante_info', { p_email: email })
  if (!data || data.length === 0) return null
  return { profesorId: data[0].profesor_id, nombre: data[0].nombre }
}
