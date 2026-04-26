import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfesoresManager } from '@/components/admin/profesores-manager'
import { CopyButton } from '@/components/admin/copy-button'

interface Profesor {
  id: string
  nombre: string
  email: string
  institucion: string | null
  telefono: string | null
  genero: string | null
  rol: string
  created_at: string
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

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await db.from('profesores').select('*').eq('id', user.id).single()
  const profesor = data as Profesor | null
  const esAdmin = profesor?.rol === 'admin'

  const params = await searchParams
  const activeTab = params.tab === 'admin' && esAdmin ? 'admin' : 'perfil'

  let profesores: Profesor[] = []
  let totalEstudiantes = 0
  let totalCursos = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gestor-universitario-next.vercel.app'

  if (activeTab === 'admin') {
    const profesoresRes = await db.from('profesores').select('*').order('created_at')
    profesores = profesoresRes.data ?? []
    const estudiantesRes = await db.from('estudiantes').select('id', { count: 'exact', head: true })
    const cursosRes = await db.from('cursos').select('id', { count: 'exact', head: true })
    totalEstudiantes = estudiantesRes.count ?? 0
    totalCursos = cursosRes.count ?? 0
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Administración</h1>
          <p className="text-gray-400 text-sm">Perfil y configuración de la cuenta</p>
        </div>
      </div>

      {/* Tabs — solo visibles para admin */}
      {esAdmin && (
        <div className="flex gap-1 border-b border-gray-800">
          <Link
            href="/dashboard/config"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'perfil'
                ? 'text-brand-400 border-b-2 border-brand-400 -mb-px'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Perfil
          </Link>
          <Link
            href="/dashboard/config?tab=admin"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'admin'
                ? 'text-brand-400 border-b-2 border-brand-400 -mb-px'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Panel Admin
          </Link>
        </div>
      )}

      {/* Contenido: Perfil */}
      {activeTab === 'perfil' && (
        <form action={actualizarPerfil} className="card space-y-5">
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
          <div>
            <label className="label">Institución</label>
            <input
              name="institucion"
              className="input"
              defaultValue={profesor?.institucion ?? ''}
              placeholder="Ej. Universidad Laica Eloy Alfaro de Manabí"
            />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input
              name="telefono"
              className="input"
              defaultValue={profesor?.telefono ?? ''}
              placeholder="Ej. +593 99 123 4567"
            />
          </div>
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
      )}

      {/* Contenido: Administración */}
      {activeTab === 'admin' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <span className="stat-value">{profesores.length}</span>
              <span className="stat-label">Profesores</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{totalEstudiantes}</span>
              <span className="stat-label">Estudiantes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{totalCursos}</span>
              <span className="stat-label">Cursos</span>
            </div>
          </div>

          <ProfesoresManager profesores={profesores} currentUserId={user.id} />

          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Agregar usuarios</h2>
            <div className="border border-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-400">Agregar profesor</p>
              <p className="text-xs text-gray-400">
                El profesor debe registrarse directamente en la aplicación. Al hacerlo, se crea su perfil
                automáticamente con rol <strong className="text-gray-300">profesor</strong>. Puedes subir a{' '}
                <strong className="text-gray-300">admin</strong> desde esta tabla.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 flex-1 truncate">
                  {appUrl}/auth/login
                </code>
                <CopyButton text={`${appUrl}/auth/login`} />
              </div>
            </div>
            <div className="border border-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-400">Agregar estudiante</p>
              <p className="text-xs text-gray-400">
                Importa al estudiante en un curso desde{' '}
                <strong className="text-gray-300">Importar estudiantes</strong>. Luego el estudiante
                se registra con el mismo correo y accede a su portal automáticamente.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
