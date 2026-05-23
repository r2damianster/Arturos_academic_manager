'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EstudianteSchema = z.object({
  nombre: z.string().min(2).max(100),
  email:  z.string().email(),
})

const EstudianteEstadoSchema = z.enum(['activo', 'retirado'])

type EstudianteEstado = z.infer<typeof EstudianteEstadoSchema>

export async function setTutoria(estudianteId: string, activar: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase.from('estudiantes')
    .update({ tutoria: activar })
    .eq('id', estudianteId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export async function importarEstudiantesMasivo(
  cursoId: string,
  estudiantes: Array<{ nombre: string; email: string }>,
  passwordInicial?: string
): Promise<{ error?: string; count?: number; yaExistian?: number; erroresAuth?: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const validos = estudiantes.filter(e => e.nombre?.trim() && e.email?.trim())
  if (validos.length === 0) return { error: 'No se encontraron estudiantes válidos.' }

  let count = 0
  let yaExistian = 0
  const erroresAuth: string[] = []

  // Si se proporciona contraseña, crear cuentas auth primero
  if (passwordInicial) {
    const admin = createAdminClient()

    for (const est of validos) {
      const email = est.email.trim().toLowerCase()
      const nombre = est.nombre.trim()

      // 1. Crear usuario en auth (maneja hash, identity y email_confirmed automáticamente)
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: passwordInicial,
        email_confirm: true,
        user_metadata: { nombre },
      })

      let authUserId: string | null = null

      if (authError) {
        if (authError.message?.toLowerCase().includes('already been registered') ||
            authError.message?.toLowerCase().includes('already registered') ||
            (authError as { status?: number }).status === 422) {
          // Cuenta ya existe — buscarla para vincularla
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
          const existing = list?.users?.find(u => u.email === email)
          if (existing) {
            authUserId = existing.id
            yaExistian++
          }
        } else {
          erroresAuth.push(`${email}: ${authError.message}`)
          // Continuar de todas formas — al menos insertar en public.estudiantes
        }
      } else {
        authUserId = authData.user?.id ?? null
      }

      // 2. Insertar en public.estudiantes vinculando auth_user_id
      await supabase.from('estudiantes').upsert({
        nombre,
        email,
        curso_id: cursoId,
        profesor_id: user.id,
        estado: 'activo',
        ...(authUserId ? { auth_user_id: authUserId } : {}),
      }, { onConflict: 'curso_id,email', ignoreDuplicates: false })

      count++
    }
  } else {
    // Sin contraseña: solo insertar en public.estudiantes (comportamiento original)
    const rows = validos.map(e => ({
      nombre: e.nombre.trim(),
      email: e.email.trim().toLowerCase(),
      curso_id: cursoId,
      profesor_id: user.id,
      estado: 'activo',
    }))

    const { error, data } = await supabase
      .from('estudiantes')
      .upsert(rows, { onConflict: 'curso_id,email', ignoreDuplicates: true })
      .select()

    if (error) return { error: error.message }
    count = data?.length ?? rows.length
  }

  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath('/dashboard')
  return {
    count,
    ...(yaExistian > 0 ? { yaExistian } : {}),
    ...(erroresAuth.length > 0 ? { erroresAuth } : {}),
  }
}

export async function setEstadoEstudiante(
  estudianteId: string,
  estado: EstudianteEstado,
  cursoId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase.from('estudiantes')
    .update({
      estado,
      retirado_at: estado === 'retirado' ? new Date().toISOString() : null,
    })
    .eq('id', estudianteId)
    .eq('profesor_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/cursos/${cursoId}`)
  revalidatePath(`/dashboard/estudiantes/${estudianteId}`)
  revalidatePath('/dashboard')
  return {}
}
