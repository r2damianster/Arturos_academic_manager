import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EnsamblarEvidencias } from '@/components/student/EnsamblarEvidencias'

export default async function EvidenciasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: estData } = await db
    .from('estudiantes')
    .select('nombre, curso_id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!estData) redirect('/auth/login')

  const { data: cursoData } = await db
    .from('cursos')
    .select('asignatura, profesor_id')
    .eq('id', estData.curso_id)
    .maybeSingle()

  const { data: profData } = cursoData?.profesor_id
    ? await db.from('profesores').select('nombre').eq('id', cursoData.profesor_id).maybeSingle()
    : { data: null }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/student" className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Ensamblador de Evidencias</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Organiza tus archivos y genera un PDF maestro para entregar
          </p>
        </div>
      </div>

      {/* Info del PDF */}
      <div className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
        <span>👤 {estData.nombre}</span>
        {cursoData && <span>📚 {cursoData.asignatura}</span>}
        {profData && <span>🎓 {profData.nombre}</span>}
      </div>

      {/* Componente cliente */}
      <EnsamblarEvidencias
        estudiante={estData.nombre}
        curso={cursoData?.asignatura ?? ''}
        profesor={profData?.nombre ?? ''}
      />
    </div>
  )
}
