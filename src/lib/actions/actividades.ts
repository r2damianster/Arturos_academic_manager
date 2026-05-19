'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Database } from '@/types/database.types'

type ActividadRow = Database['public']['Tables']['actividades_inbox']['Row']
type ActividadConCurso = ActividadRow & {
  cursos: { asignatura: string } | null
}

const ActividadSchema = z.object({
  titulo: z.string().min(1).max(500),
  descripcion: z.string().optional().nullable(),
  tipo: z.enum(['idea', 'tarea', 'recordatorio']).default('tarea'),
  prioridad: z.enum(['baja', 'normal', 'alta']).default('normal'),
  curso_id: z.string().uuid().optional().nullable(),
  etiquetas: z.array(z.string()).optional().default([]),
  fecha_vencimiento: z.string().optional().nullable(),
  origen: z.string().optional().nullable(),
})

type ActividadInput = z.input<typeof ActividadSchema>

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function crearActividad(input: ActividadInput) {
  const parsed = ActividadSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('actividades_inbox')
    .insert({ ...parsed.data, profesor_id: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
  return { ok: true, id: data.id }
}

export async function actualizarActividad(id: string, patch: Partial<ActividadInput>) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update(patch as Database['public']['Tables']['actividades_inbox']['Update'])
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function marcarCumplida(id: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ estado: 'cumplida', fecha_cumplimiento: new Date().toISOString() })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function desmarcarCumplida(id: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ estado: 'pendiente', fecha_cumplimiento: null })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  return { ok: true }
}

export async function marcarEnProgreso(id: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ estado: 'en_progreso' })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  return { ok: true }
}

export async function archivarActividad(id: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ estado: 'archivada' })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  return { ok: true }
}

export async function eliminarActividad(id: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .delete()
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── LECTURA ──────────────────────────────────────────────────────────────────

export async function getActividades(filtros: {
  estado?: string
  tipo?: string
  cursoId?: string
  prioridad?: string
  search?: string
} = {}): Promise<ActividadConCurso[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  let query = supabase
    .from('actividades_inbox')
    .select('*, cursos(asignatura)')
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })

  if (filtros.estado) query = query.eq('estado', filtros.estado)
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.cursoId) query = query.eq('curso_id', filtros.cursoId)
  if (filtros.prioridad) query = query.eq('prioridad', filtros.prioridad)
  if (filtros.search) query = query.ilike('titulo', `%${filtros.search}%`)

  const { data } = await query
  return (data ?? []) as ActividadConCurso[]
}

export async function getCountsPorEstado(): Promise<{
  pendiente: number
  en_progreso: number
  cumplida: number
  convertida: number
  archivada: number
}> {
  const { supabase, user } = await getUser()
  if (!user) return { pendiente: 0, en_progreso: 0, cumplida: 0, convertida: 0, archivada: 0 }

  const { data } = await supabase
    .from('actividades_inbox')
    .select('estado')
    .eq('profesor_id', user.id)

  const counts = { pendiente: 0, en_progreso: 0, cumplida: 0, convertida: 0, archivada: 0 }
  for (const row of data ?? []) {
    const e = row.estado as keyof typeof counts
    if (e in counts) counts[e]++
  }
  return counts
}

export async function getActividadesPendientesDelCurso(cursoId: string): Promise<ActividadRow[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  const { data } = await supabase
    .from('actividades_inbox')
    .select('*')
    .eq('profesor_id', user.id)
    .eq('curso_id', cursoId)
    .in('estado', ['pendiente', 'en_progreso'])
    .order('created_at', { ascending: false })

  return (data ?? []) as ActividadRow[]
}

export async function getActividadesParaHoy(): Promise<ActividadConCurso[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  const hoy = new Date()
  hoy.setHours(23, 59, 59, 999)

  const { data } = await supabase
    .from('actividades_inbox')
    .select('*, cursos(asignatura)')
    .eq('profesor_id', user.id)
    .in('tipo', ['tarea', 'recordatorio'])
    .in('estado', ['pendiente', 'en_progreso'])
    .lte('fecha_vencimiento', hoy.toISOString())
    .order('fecha_vencimiento', { ascending: true })

  return (data ?? []) as ActividadConCurso[]
}
