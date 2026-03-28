import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Tables } from '@/types/database.types'

type Profesor = Tables<'profesores'>

async function actualizarPerfil(formData: FormData): Promise<void> {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = formData.get('nombre') as string
  const institucion = formData.get('institucion') as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('profesores')
    .update({ nombre: nombre.trim(), institucion: institucion?.trim() || null })
    .eq('id', user.id)

  redirect('/dashboard')
}

export default async function ConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profesores').select('*').eq('id', user.id).single()
  const profesor = data as Profesor | null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 mt-1 text-sm">Tu perfil de profesor</p>
      </div>

      <form action={actualizarPerfil} className="card space-y-4">
        <div>
          <label className="label">Nombre completo</label>
          <input name="nombre" className="input" defaultValue={profesor?.nombre ?? ''} required />
        </div>
        <div>
          <label className="label">Correo electrónico</label>
          <input type="email" className="input opacity-60 cursor-not-allowed"
            defaultValue={profesor?.email ?? ''} disabled readOnly />
          <p className="text-xs text-gray-500 mt-1">El email no puede modificarse</p>
        </div>
        <div>
          <label className="label">Institución</label>
          <input name="institucion" className="input" defaultValue={profesor?.institucion ?? ''}
            placeholder="Universidad Central..." />
        </div>
        <button type="submit" className="btn-primary">Guardar cambios</button>
      </form>
    </div>
  )
}
