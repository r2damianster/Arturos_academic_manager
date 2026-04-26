'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const GrupoInputSchema = z.object({
  nombre: z.string().min(1),
  orden: z.number().int().default(0),
})

// ── Profesor: crear grupos para una sesión ────────────────────

export async function crearGrupos(
  bitacoraId: string | null,
  grupos: { nombre: string; orden: number }[],
  tipo: 'aleatoria' | 'manual' | 'afinidad',
  categoria: string | null,
  cursoId: string,
): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = z.array(GrupoInputSchema).safeParse(grupos)
  if (!parsed.success) return { error: 'Datos inválidos' }

  // Limpiar grupos previos del mismo alcance
  if (bitacoraId) {
    await db.from('grupos_clase').delete()
      .eq('bitacora_id', bitacoraId).eq('profesor_id', user.id)
  } else {
    await db.from('grupos_clase').delete()
      .eq('curso_id', cursoId).eq('profesor_id', user.id).is('bitacora_id', null)
  }

  const rows = parsed.data.map(g => ({
    bitacora_id: bitacoraId,
    curso_id: cursoId,
    profesor_id: user.id,
    nombre: g.nombre,
    categoria,
    tipo,
    orden: g.orden,
    abierto: tipo === 'afinidad',
  }))

  const { error } = await db.from('grupos_clase').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/modo-clase')
  return {}
}

// ── Profesor: asignar estudiante a un grupo ───────────────────

export async function asignarEstudianteAGrupo(
  grupoId: string,
  estudianteId: string,
): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que el grupo pertenece al profesor
  const { data: grupo } = await db
    .from('grupos_clase')
    .select('id, bitacora_id')
    .eq('id', grupoId)
    .eq('profesor_id', user.id)
    .single()
  if (!grupo) return { error: 'Grupo no encontrado' }

  // Quitar al estudiante de cualquier otro grupo de esta sesión primero
  if (grupo.bitacora_id) {
    const { data: gruposSesion } = await db
      .from('grupos_clase')
      .select('id')
      .eq('bitacora_id', grupo.bitacora_id)
      .eq('profesor_id', user.id)

    if (gruposSesion && gruposSesion.length > 0) {
      const ids = gruposSesion.map(g => g.id)
      await db
        .from('grupo_integrantes')
        .delete()
        .in('grupo_id', ids)
        .eq('estudiante_id', estudianteId)
    }
  }

  const { error } = await db.from('grupo_integrantes').insert({
    grupo_id: grupoId,
    estudiante_id: estudianteId,
    asignado_por: 'profesor',
  })
  if (error) return { error: error.message }

  return {}
}

// ── Profesor: mover estudiante entre grupos (DnD) ─────────────

export async function moverEstudiante(
  estudianteId: string,
  grupoIdDestino: string,
  bitacoraId: string,
): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que el grupo destino pertenece al profesor
  const { data: grupo } = await db
    .from('grupos_clase')
    .select('id')
    .eq('id', grupoIdDestino)
    .eq('profesor_id', user.id)
    .single()
  if (!grupo) return { error: 'Grupo no encontrado' }

  // Quitar de grupo actual en esta sesión
  const { data: gruposSesion } = await db
    .from('grupos_clase')
    .select('id')
    .eq('bitacora_id', bitacoraId)
    .eq('profesor_id', user.id)

  if (gruposSesion && gruposSesion.length > 0) {
    await db
      .from('grupo_integrantes')
      .delete()
      .in('grupo_id', gruposSesion.map(g => g.id))
      .eq('estudiante_id', estudianteId)
  }

  const { error } = await db.from('grupo_integrantes').insert({
    grupo_id: grupoIdDestino,
    estudiante_id: estudianteId,
    asignado_por: 'profesor',
  })
  if (error) return { error: error.message }

  return {}
}

// ── Profesor: publicar / cerrar grupos de afinidad ───────────

export async function publicarAfinidad(bitacoraId: string): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await db
    .from('grupos_clase')
    .update({ abierto: true, tipo: 'afinidad' })
    .eq('bitacora_id', bitacoraId)
    .eq('profesor_id', user.id)
  if (error) return { error: error.message }

  return {}
}

export async function cerrarAfinidad(bitacoraId: string): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await db
    .from('grupos_clase')
    .update({ abierto: false })
    .eq('bitacora_id', bitacoraId)
    .eq('profesor_id', user.id)
  if (error) return { error: error.message }

  return {}
}

// ── Estudiante: unirse / salir de un grupo ────────────────────

export async function unirseAGrupo(grupoId: string): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: estudiante } = await db
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!estudiante) return { error: 'Estudiante no encontrado' }

  // Verificar que el grupo existe, está abierto y es de afinidad
  const { data: grupo } = await db
    .from('grupos_clase')
    .select('id, bitacora_id, max_integrantes, abierto, tipo')
    .eq('id', grupoId)
    .eq('abierto', true)
    .eq('tipo', 'afinidad')
    .single()
  if (!grupo) return { error: 'Grupo no disponible' }

  // Verificar cupo si hay máximo
  if (grupo.max_integrantes) {
    const { count } = await db
      .from('grupo_integrantes')
      .select('id', { count: 'exact', head: true })
      .eq('grupo_id', grupoId)
    if ((count ?? 0) >= grupo.max_integrantes) return { error: 'Grupo lleno' }
  }

  // Quitar de cualquier otro grupo de esta sesión
  if (grupo.bitacora_id) {
    const { data: gruposSesion } = await db
      .from('grupos_clase')
      .select('id')
      .eq('bitacora_id', grupo.bitacora_id)
    if (gruposSesion) {
      await db
        .from('grupo_integrantes')
        .delete()
        .in('grupo_id', gruposSesion.map(g => g.id))
        .eq('estudiante_id', estudiante.id)
    }
  }

  const { error } = await db.from('grupo_integrantes').insert({
    grupo_id: grupoId,
    estudiante_id: estudiante.id,
    asignado_por: 'estudiante',
  })
  if (error) return { error: error.message }

  revalidatePath('/student')
  return {}
}

export async function salirDeGrupo(grupoId: string): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: estudiante } = await db
    .from('estudiantes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!estudiante) return { error: 'Estudiante no encontrado' }

  const { error } = await db
    .from('grupo_integrantes')
    .delete()
    .eq('grupo_id', grupoId)
    .eq('estudiante_id', estudiante.id)
  if (error) return { error: error.message }

  revalidatePath('/student')
  return {}
}

// ── Profesor: guardar notas de participación ──────────────────

export async function guardarParticipacion(
  bitacoraId: string,
  notas: { estudianteId: string; grupoId: string; nota: number | null }[],
): Promise<{ error?: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const rows = notas.map(n => ({
    bitacora_id: bitacoraId,
    grupo_id: n.grupoId,
    estudiante_id: n.estudianteId,
    nota: n.nota,
  }))

  const { error } = await db
    .from('grupo_participacion')
    .upsert(rows, { onConflict: 'estudiante_id,bitacora_id' })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/modo-clase')
  return {}
}

// ── Leer grupos abiertos para el portal del estudiante ───────

export async function getGruposAbiertosParaEstudiante(cursoIds: string[]) {
  if (cursoIds.length === 0) return { grupos: [], misMembresias: [], estudiantesByCurso: {} }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { grupos: [], misMembresias: [], estudiantesByCurso: {} }

  const { data: estudiantes } = await db
    .from('estudiantes')
    .select('id, curso_id')
    .eq('auth_user_id', user.id)
    .in('curso_id', cursoIds)

  if (!estudiantes || estudiantes.length === 0) return { grupos: [], misMembresias: [], estudiantesByCurso: {} }

  const estudianteIds = estudiantes.map(e => e.id)

  const [{ data: grupos }, { data: membresias }] = await Promise.all([
    db.from('grupos_clase')
      .select('id, nombre, categoria, max_integrantes, curso_id, orden, grupo_integrantes(id)')
      .in('curso_id', cursoIds)
      .eq('tipo', 'afinidad')
      .eq('abierto', true)
      .order('orden'),
    db.from('grupo_integrantes')
      .select('grupo_id, estudiante_id')
      .in('estudiante_id', estudianteIds),
  ])

  return {
    grupos: (grupos ?? []).map((g: any) => ({
      id: g.id as string,
      nombre: g.nombre as string,
      categoria: g.categoria as string | null,
      max_integrantes: g.max_integrantes as number | null,
      curso_id: g.curso_id as string,
      orden: g.orden as number,
      currentCount: (g.grupo_integrantes as { id: string }[]).length,
    })),
    misMembresias: (membresias ?? []).map(m => ({
      grupo_id: m.grupo_id as string,
      estudiante_id: m.estudiante_id as string,
    })),
    estudiantesByCurso: Object.fromEntries(
      estudiantes.map(e => [e.curso_id, e.id])
    ) as Record<string, string>,
  }
}

// ── Leer grupos de una sesión (para cliente) ──────────────────

export async function getGruposDeSesion(bitacoraId: string) {
  const db = await createClient()

  const { data: grupos, error } = await db
    .from('grupos_clase')
    .select(`
      id, nombre, categoria, tipo, orden, abierto, max_integrantes,
      grupo_integrantes (
        id, estudiante_id, asignado_por,
        estudiantes ( id, nombre )
      )
    `)
    .eq('bitacora_id', bitacoraId)
    .order('orden')

  if (error) return { grupos: [], error: error.message }
  return { grupos: grupos ?? [], error: null }
}

// ── Leer categorías predefinidas ──────────────────────────────

export async function getCategorias() {
  const db = await createClient()
  const { data } = await db
    .from('grupo_categorias')
    .select('id, nombre, valores, orden')
    .order('orden')
  return data ?? []
}
