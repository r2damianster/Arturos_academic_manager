import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfesoresManager } from '@/components/admin/profesores-manager'
import { CopyButton } from '@/components/admin/copy-button'

interface Profesor {
  id: string
  nombre: string
  email: string
  rol: string
  institucion: string | null
  created_at: string
}

export default async function AdminPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: yo } = await db.from('profesores').select('*').eq('id', user.id).single()
  if (!yo || yo.rol !== 'admin') redirect('/dashboard')

  const profesoresRes = await db.from('profesores').select('*').order('created_at')
  const profesores: Profesor[] = profesoresRes.data ?? []

  const estudiantesRes = await db.from('estudiantes').select('id', { count: 'exact', head: true })
  const cursosRes     = await db.from('cursos').select('id', { count: 'exact', head: true })
  const totalEstudiantes: number = estudiantesRes.count ?? 0
  const totalCursos: number      = cursosRes.count ?? 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gestor-universitario-next.vercel.app'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de administración</h1>
          <p className="text-gray-400 text-sm">Gestión de usuarios y permisos</p>
        </div>
      </div>

      {/* Stats globales */}
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

      {/* Gestión de profesores */}
      <ProfesoresManager profesores={profesores} currentUserId={user.id} />

      {/* Cómo agregar usuarios */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Agregar usuarios</h2>

        <div className="border border-gray-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-blue-400">👩‍🏫 Agregar profesor</p>
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
          <p className="text-sm font-medium text-emerald-400">🎓 Agregar estudiante</p>
          <p className="text-xs text-gray-400">
            Importa al estudiante en un curso desde{' '}
            <strong className="text-gray-300">Importar estudiantes</strong>. Luego el estudiante
            se registra con el mismo correo y accede a su portal automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
