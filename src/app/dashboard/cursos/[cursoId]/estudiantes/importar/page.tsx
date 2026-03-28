import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ImportarEstudiantesForm } from '@/components/cursos/importar-form'
import type { Tables } from '@/types/database.types'

type Curso = Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>

export default async function ImportarEstudiantesPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const cursoRes = await db
    .from('cursos')
    .select('id, asignatura, codigo')
    .eq('id', cursoId)
    .single()

  if (!cursoRes.data) notFound()
  const curso = cursoRes.data as Curso

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Importar estudiantes</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo}</p>
        </div>
      </div>
      <ImportarEstudiantesForm cursoId={cursoId} />
    </div>
  )
}
