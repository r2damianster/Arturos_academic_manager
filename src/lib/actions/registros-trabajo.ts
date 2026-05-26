'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export type Criterio = { texto: string; peso?: number }

export type RegistroTrabajo = {
  id: string
  profesor_id: string
  curso_id: string
  titulo: string
  tipo: string
  instrucciones: string | null
  criterios: Criterio[]
  validacion_automatica: boolean
  activo: boolean
  created_at: string
}

export type EnvioRegistro = {
  id: string
  registro_id: string
  estudiante_id: string
  titulo: string
  descripcion: string | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  comentario_profesor: string | null
  submitted_at: string
  revisado_at: string | null
}

const RegistroSchema = z.object({
  titulo:               z.string().min(1, 'Título requerido'),
  tipo:                 z.string().min(1),
  instrucciones:        z.string().optional(),
  criterios:            z.array(z.object({ texto: z.string(), peso: z.number().optional() })).default([]),
  validacion_automatica: z.boolean().default(false),
})

// ── PROFESOR ────────────────────────────────────────────────────────────────

export async function crearRegistroTrabajo(
  cursoId: string,
  data: {
    titulo: string
    tipo: string
    instrucciones?: string
    criterios?: Criterio[]
    validacion_automatica: boolean
  }
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const parsed = RegistroSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: row, error } = await db.from('registros_trabajo').insert({
    profesor_id: user.id,
    curso_id: cursoId,
    titulo: parsed.data.titulo,
    tipo: parsed.data.tipo,
    instrucciones: parsed.data.instrucciones || null,
    criterios: parsed.data.criterios,
    validacion_automatica: parsed.data.validacion_automatica,
    activo: true,
  }).select('id').single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return { id: row.id }
}

export async function actualizarRegistroTrabajo(
  registroId: string,
  cursoId: string,
  data: Partial<{
    titulo: string
    tipo: string
    instrucciones: string
    criterios: Criterio[]
    validacion_automatica: boolean
    activo: boolean
  }>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('registros_trabajo')
    .update(data)
    .eq('id', registroId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

export async function getRegistrosPorCurso(cursoId: string): Promise<RegistroTrabajo[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db.from('registros_trabajo')
    .select('*')
    .eq('curso_id', cursoId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getEnviosPorRegistro(registroId: string): Promise<(EnvioRegistro & { estudiante: { nombre: string } | null })[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db.from('envios_registro')
    .select('*, estudiante:estudiante_id(nombre)')
    .eq('registro_id', registroId)
    .order('submitted_at', { ascending: false })
  return data ?? []
}

export async function revisarEnvio(
  envioId: string,
  cursoId: string,
  estado: 'aprobado' | 'rechazado',
  comentario?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar que el envío pertenece a un registro del profesor
  const { data: envio } = await db.from('envios_registro')
    .select('*, registro:registro_id(profesor_id, tipo, titulo, curso_id, instrucciones)')
    .eq('id', envioId)
    .single()

  if (!envio || envio.registro?.profesor_id !== user.id) return { error: 'Sin permiso' }

  if (estado === 'rechazado') {
    const { error } = await db.from('envios_registro')
      .update({
        estado: 'rechazado',
        comentario_profesor: comentario || null,
        revisado_at: new Date().toISOString(),
      })
      .eq('id', envioId)
    if (error) return { error: error.message }
    revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
    return {}
  }

  const { error } = await db.from('envios_registro')
    .update({
      estado,
      comentario_profesor: comentario || null,
      revisado_at: new Date().toISOString(),
    })
    .eq('id', envioId)

  if (error) return { error: error.message }

  // Si aprobado → crear trabajo_asignado con estado Pendiente
  if (estado === 'aprobado') {
    await supabase.from('trabajos_asignados').insert({
      profesor_id: user.id,
      curso_id: envio.registro.curso_id,
      estudiante_id: envio.estudiante_id,
      tipo: envio.registro.tipo,
      tema: envio.titulo,
      descripcion: envio.descripcion || envio.registro.instrucciones || null,
      estado: 'Pendiente',
      fecha_asignacion: new Date().toISOString().split('T')[0],
    })
  }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

export async function revertirEnvio(
  envioId: string,
  cursoId: string,
  estadoActual: 'aprobado' | 'rechazado'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: envio } = await db.from('envios_registro')
    .select('*, registro:registro_id(profesor_id, curso_id, tipo)')
    .eq('id', envioId)
    .single()

  if (!envio || envio.registro?.profesor_id !== user.id) return { error: 'Sin permiso' }

  const { error } = await db.from('envios_registro')
    .update({ estado: 'pendiente', comentario_profesor: null, revisado_at: null })
    .eq('id', envioId)

  if (error) return { error: error.message }

  // Si estaba aprobado, eliminar el trabajo_asignado correspondiente
  if (estadoActual === 'aprobado') {
    await supabase.from('trabajos_asignados')
      .delete()
      .eq('profesor_id', user.id)
      .eq('curso_id', envio.registro.curso_id)
      .eq('estudiante_id', envio.estudiante_id)
      .eq('tipo', envio.registro.tipo)
      .eq('tema', envio.titulo)
      .eq('estado', 'Pendiente')
  }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

// ── ESTUDIANTE ───────────────────────────────────────────────────────────────

export async function getRegistrosActivosParaEstudiante(
  cursoIds: string[]
): Promise<{ registros: RegistroTrabajo[]; misEnvios: Record<string, EnvioRegistro> }> {
  if (cursoIds.length === 0) return { registros: [], misEnvios: {} }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { registros: [], misEnvios: {} }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: estudianteData } = await db.from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .in('curso_id', cursoIds)

  const estudianteIds: string[] = (estudianteData ?? []).map((e: { id: string }) => e.id)
  if (estudianteIds.length === 0) return { registros: [], misEnvios: {} }

  const [registrosRes, enviosRes] = await Promise.all([
    db.from('registros_trabajo').select('*').in('curso_id', cursoIds).eq('activo', true),
    db.from('envios_registro').select('*').in('estudiante_id', estudianteIds),
  ])

  const registros: RegistroTrabajo[] = registrosRes.data ?? []
  const envios: EnvioRegistro[] = enviosRes.data ?? []

  // Indexar envíos por registro_id
  const misEnvios: Record<string, EnvioRegistro> = {}
  for (const e of envios) misEnvios[e.registro_id] = e

  return { registros, misEnvios }
}

export async function enviarRegistro(
  registroId: string,
  estudianteId: string,
  titulo: string,
  descripcion: string
): Promise<{ error?: string; autoAprobado?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Leer registro para saber si es auto-aprobado
  const { data: registro } = await db.from('registros_trabajo')
    .select('*')
    .eq('id', registroId)
    .eq('activo', true)
    .single()

  if (!registro) return { error: 'Registro no encontrado o cerrado' }

  const estadoInicial = registro.validacion_automatica ? 'aprobado' : 'pendiente'

  // Si ya hay un envío rechazado, actualizarlo (no crear duplicado)
  const { data: envioRechazado } = await db.from('envios_registro')
    .select('id')
    .eq('registro_id', registroId)
    .eq('estudiante_id', estudianteId)
    .eq('estado', 'rechazado')
    .maybeSingle()

  if (envioRechazado) {
    const { error } = await db.from('envios_registro')
      .update({
        titulo,
        descripcion: descripcion || null,
        estado: estadoInicial,
        comentario_profesor: null,
        revisado_at: registro.validacion_automatica ? new Date().toISOString() : null,
      })
      .eq('id', envioRechazado.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('envios_registro').insert({
      registro_id: registroId,
      estudiante_id: estudianteId,
      titulo,
      descripcion: descripcion || null,
      estado: estadoInicial,
      revisado_at: registro.validacion_automatica ? new Date().toISOString() : null,
    })
    if (error) return { error: error.message }
  }

  // Si auto-aprobado → crear trabajo
  if (registro.validacion_automatica) {
    await supabase.from('trabajos_asignados').insert({
      profesor_id: registro.profesor_id,
      curso_id: registro.curso_id,
      estudiante_id: estudianteId,
      tipo: registro.tipo,
      tema: titulo,
      descripcion: descripcion || registro.instrucciones || null,
      estado: 'Pendiente',
      fecha_asignacion: new Date().toISOString().split('T')[0],
    })
  }

  revalidatePath(`/dashboard/cursos/${registro.curso_id}/trabajos`)
  return { autoAprobado: registro.validacion_automatica }
}

export async function eliminarRegistroTrabajo(
  registroId: string,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('registros_trabajo')
    .delete()
    .eq('id', registroId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/cursos/${cursoId}/trabajos`)
  return {}
}

// ── IA ───────────────────────────────────────────────────────────────────────

export async function mejorarCriteriosIA(
  tipo: string,
  titulo: string,
  criteriosBorrador: string[]
): Promise<{ criterios?: string[]; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { error: 'IA no disponible' }

  const prompt = `Eres un docente universitario experto en evaluación. El profesor está creando un registro de tipo "${tipo}" titulado "${titulo}".

Los criterios de evaluación en borrador son:
${criteriosBorrador.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Mejora la redacción de estos criterios para que sean claros, observables y orientados al desempeño estudiantil.
REGLAS:
- Devuelve exactamente el mismo número de criterios que recibiste
- Máximo 15 palabras por criterio
- Usa verbos de acción (presenta, demuestra, argumenta, entrega, incluye...)
- Solo devuelve los criterios mejorados, uno por línea, sin numeración ni guiones`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.4,
      }),
    })
    const json = await res.json()
    const text: string = json.choices?.[0]?.message?.content ?? ''
    const criterios = text.split('\n').map((l: string) => l.trim()).filter(Boolean)
    return { criterios }
  } catch {
    return { error: 'Error al conectar con IA' }
  }
}
