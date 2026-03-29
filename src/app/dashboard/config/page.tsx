import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Profesor {
  id: string
  nombre: string
  email: string
  institucion: string | null
  telefono: string | null
  genero: string | null
  rol: string
}

async function actualizarPerfil(formData: FormData): Promise<void> {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = formData.get('nombre') as string
  const institucion = formData.get('institucion') as string
  const telefono = formData.get('telefono') as string
  const genero = formData.get('genero') as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('profesores').update({
    nombre: nombre.trim(),
    institucion: institucion?.trim() || null,
    telefono: telefono?.trim() || null,
    genero: genero || null,
  }).eq('id', user.id)

  redirect('/dashboard/config')
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
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Perfil</h1>
          <p className="text-gray-400 text-sm">Tus datos personales y de contacto</p>
        </div>
      </div>

      <form action={actualizarPerfil} className="card space-y-5">
        {/* Nombre */}
        <div>
          <label className="label">Nombre completo</label>
          <input
            name="nombre"
            className="input"
            defaultValue={profesor?.nombre ?? ''}
            required
            placeholder="Ej. Juan Pérez"
          />
        </div>

        {/* Email (readonly) */}
        <div>
          <label className="label">Correo electrónico</label>
          <input
            type="email"
            className="input opacity-60 cursor-not-allowed"
            defaultValue={profesor?.email ?? ''}
            disabled
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">El email no puede modificarse</p>
        </div>

        {/* Institución */}
        <div>
          <label className="label">Institución</label>
          <input
            name="institucion"
            className="input"
            defaultValue={profesor?.institucion ?? ''}
            placeholder="Ej. Universidad Laica Eloy Alfaro de Manabí"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="label">Teléfono</label>
          <input
            name="telefono"
            className="input"
            defaultValue={profesor?.telefono ?? ''}
            placeholder="Ej. +593 99 123 4567"
          />
        </div>

        {/* Género */}
        <div>
          <label className="label">Género</label>
          <select name="genero" className="input" defaultValue={profesor?.genero ?? ''}>
            <option value="">Prefiero no indicar</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="otro">Otro</option>
            <option value="prefiero_no_decir">Prefiero no decir</option>
          </select>
        </div>

        <div className="pt-1">
          <button type="submit" className="btn-primary">Guardar cambios</button>
        </div>
      </form>
    </div>
  )
}
