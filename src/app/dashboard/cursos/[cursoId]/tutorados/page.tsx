import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTutorados } from '@/lib/actions/tutorados'
import { TutoradosPanel } from '@/components/tutorados/TutoradosPanel'

export default async function CursoTutoradosPage({
  params,
}: {
  params: Promise<{ cursoId: string }>
}) {
  const { cursoId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  const { data: curso } = await db
    .from('cursos')
    .select('id, asignatura, periodo, codigo, institucion, tipo')
    .eq('id', cursoId)
    .single()

  if (!curso || curso.tipo !== 'tutorados') notFound()

  const { data: tutorados } = await getTutorados(cursoId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tutorados" className="btn-ghost p-2 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{curso.asignatura}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Tutorados
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {curso.codigo} · {curso.periodo}
            {curso.institucion && ` · ${curso.institucion}`}
            {' · '}{tutorados.length} tutorado{tutorados.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="ml-auto">
          <Link
            href={`/dashboard/cursos/${cursoId}/estudiantes/importar`}
            className="btn-ghost text-sm px-3 py-1.5">
            + Agregar tutorado
          </Link>
        </div>
      </div>

      <TutoradosPanel
        tutorados={tutorados}
        cursoId={cursoId}
        showCurso={false}
        importarHref={`/dashboard/cursos/${cursoId}/estudiantes/importar`}
      />
    </div>
  )
}
