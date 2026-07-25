import { createAdminClient } from './server'

export type KeepaliveResult = {
  ok: boolean
  error?: string
}

export async function pingSupabase(): Promise<KeepaliveResult> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profesores').select('id').limit(1)

    if (error) {
      return { ok: false, error: error.message ?? 'Error al consultar la base de datos' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error inesperado',
    }
  }
}
