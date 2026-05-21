'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Database } from '@/types/database.types'

export type ChecklistItem = { id: string; texto: string; done: boolean }
export type ActividadRow = Database['public']['Tables']['actividades_inbox']['Row']
export type ActividadConCurso = ActividadRow & { cursos: { asignatura: string } | null }

const COLORES_VALIDOS = ['rojo','naranja','amarillo','verde','teal','azul','morado'] as const
export type NoteColor = typeof COLORES_VALIDOS[number] | null

const ActividadSchema = z.object({
  titulo: z.string().min(1).max(500),
  descripcion: z.string().optional().nullable(),
  tipo: z.enum(['nota', 'tarea', 'recordatorio']).default('nota'),
  prioridad: z.enum(['baja', 'normal', 'alta']).default('normal'),
  curso_id: z.string().uuid().optional().nullable(),
  etiquetas: z.array(z.string()).optional().default([]),
  fecha_vencimiento: z.string().optional().nullable(),
  color: z.enum(['rojo','naranja','amarillo','verde','teal','azul','morado']).optional().nullable(),
  origen: z.string().optional().nullable(),
})

type ActividadInput = z.input<typeof ActividadSchema>

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function revalidate() {
  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
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
  revalidate()
  return { ok: true, id: data.id }
}

export async function actualizarActividad(id: string, patch: Database['public']['Tables']['actividades_inbox']['Update']) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update(patch)
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidate()
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
  revalidate()
  return { ok: true }
}

// ─── ESTADO KEEP ──────────────────────────────────────────────────────────────

export async function togglePin(id: string, currentValue: boolean) {
  return actualizarActividad(id, { pinned: !currentValue })
}

export async function setColor(id: string, color: NoteColor) {
  return actualizarActividad(id, { color })
}

export async function toggleArchivada(id: string, currentValue: boolean) {
  return actualizarActividad(id, { archivada: !currentValue })
}

export async function marcarCompletada(id: string) {
  return actualizarActividad(id, { completada: true, fecha_cumplimiento: new Date().toISOString() })
}

export async function desmarcarCompletada(id: string) {
  return actualizarActividad(id, { completada: false, fecha_cumplimiento: null })
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────

async function getChecklistItems(supabase: Awaited<ReturnType<typeof createClient>>, id: string, profesorId: string): Promise<ChecklistItem[] | null> {
  const { data } = await supabase
    .from('actividades_inbox')
    .select('checklist_items')
    .eq('id', id)
    .eq('profesor_id', profesorId)
    .single()
  return data ? (data.checklist_items as ChecklistItem[]) : null
}

export async function addChecklistItem(id: string, texto: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const items = await getChecklistItems(supabase, id, user.id)
  if (items === null) return { error: 'No encontrada' }

  const newItem: ChecklistItem = {
    id: crypto.randomUUID(),
    texto: texto.trim(),
    done: false,
  }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ checklist_items: [...items, newItem] })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidate()
  return { ok: true, item: newItem }
}

export async function toggleChecklistItem(id: string, itemId: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const items = await getChecklistItems(supabase, id, user.id)
  if (items === null) return { error: 'No encontrada' }

  const updated = items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ checklist_items: updated })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidate()
  return { ok: true }
}

export async function removeChecklistItem(id: string, itemId: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const items = await getChecklistItems(supabase, id, user.id)
  if (items === null) return { error: 'No encontrada' }

  const { error } = await supabase
    .from('actividades_inbox')
    .update({ checklist_items: items.filter(i => i.id !== itemId) })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidate()
  return { ok: true }
}

export async function saveChecklistItems(id: string, items: ChecklistItem[]) {
  return actualizarActividad(id, { checklist_items: items })
}

// ─── LECTURA ──────────────────────────────────────────────────────────────────

export async function getActividades(filtros: {
  archivada?: boolean
  tipo?: string
  cursoId?: string
  color?: string
  etiqueta?: string
  search?: string
} = {}): Promise<ActividadConCurso[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  let query = supabase
    .from('actividades_inbox')
    .select('*, cursos(asignatura)')
    .eq('profesor_id', user.id)
    .eq('archivada', filtros.archivada ?? false)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.cursoId) query = query.eq('curso_id', filtros.cursoId)
  if (filtros.color) query = query.eq('color', filtros.color)
  if (filtros.search) query = query.ilike('titulo', `%${filtros.search}%`)

  const { data } = await query
  return (data ?? []) as ActividadConCurso[]
}

export async function getCounts(): Promise<{ total: number; archivadas: number; fijadas: number }> {
  const { supabase, user } = await getUser()
  if (!user) return { total: 0, archivadas: 0, fijadas: 0 }

  const { data } = await supabase
    .from('actividades_inbox')
    .select('archivada, pinned')
    .eq('profesor_id', user.id)

  let total = 0, archivadas = 0, fijadas = 0
  for (const row of data ?? []) {
    if (row.archivada) archivadas++
    else {
      total++
      if (row.pinned) fijadas++
    }
  }
  return { total, archivadas, fijadas }
}

export async function getActividadesPendientesDelCurso(cursoId: string): Promise<ActividadRow[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  const { data } = await supabase
    .from('actividades_inbox')
    .select('*')
    .eq('profesor_id', user.id)
    .eq('curso_id', cursoId)
    .eq('archivada', false)
    .eq('completada', false)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []) as ActividadRow[]
}

export async function getUltimasNotas(n = 8): Promise<ActividadConCurso[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  const { data } = await supabase
    .from('actividades_inbox')
    .select('*, cursos(asignatura)')
    .eq('profesor_id', user.id)
    .eq('archivada', false)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(n)

  return (data ?? []) as ActividadConCurso[]
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
    .eq('archivada', false)
    .eq('completada', false)
    .lte('fecha_vencimiento', hoy.toISOString())
    .order('fecha_vencimiento', { ascending: true })

  return (data ?? []) as ActividadConCurso[]
}

// ─── CONVERSIÓN ───────────────────────────────────────────────────────────────

export async function convertirAEvento(
  id: string,
  opts: { fecha: string; horaInicio?: string; horaFin?: string },
): Promise<{ ok?: boolean; eventoId?: string; error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: actividad } = await supabase
    .from('actividades_inbox')
    .select('titulo, descripcion')
    .eq('id', id)
    .eq('profesor_id', user.id)
    .single()

  if (!actividad) return { error: 'No encontrada' }

  const { data: evento, error: evError } = await supabase
    .from('eventos_profesor')
    .insert({
      profesor_id: user.id,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion,
      tipo: 'tarea',
      fecha_inicio: opts.fecha,
      fecha_fin: opts.fecha,
      hora_inicio: opts.horaInicio ?? null,
      hora_fin: opts.horaFin ?? null,
      todo_el_dia: !opts.horaInicio,
    })
    .select('id')
    .single()

  if (evError) return { error: evError.message }

  const { error: actError } = await supabase
    .from('actividades_inbox')
    .update({
      conversion_destino: 'evento',
      conversion_ref_id: evento.id,
      conversion_fecha: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('profesor_id', user.id)

  if (actError) return { error: actError.message }

  revalidatePath('/dashboard/actividades')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/agenda')
  return { ok: true, eventoId: evento.id }
}
