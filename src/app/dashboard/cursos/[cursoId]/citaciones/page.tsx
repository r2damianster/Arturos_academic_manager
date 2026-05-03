import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCitacionesPorCurso } from '@/lib/actions/citaciones'
import { CitacionesClient } from './citaciones-client'

export default async function CitacionesPage({ params, searchParams }: { params: Promise<{ cursoId: string }>, searchParams: Promise<{ mes?: string }> }) {
  const supabase = await createClient()
  const { cursoId } = await params
  const { mes } = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: curso } = await supabase
    .from('cursos')
    .select('asignatura, codigo')
    .eq('id', cursoId)
    .eq('profesor_id', user.id)
    .single()

  if (!curso) redirect('/dashboard/cursos')

  const currentMonth = mes || new Date().toISOString().slice(0, 7)
  const citaciones = await getCitacionesPorCurso(cursoId, mes)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-4 mb-2">
          <Link
            href={`/dashboard/cursos/${cursoId}`}
            className="p-2 -ml-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Volver al curso"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-white">Historial de Citaciones a Tutoría</h1>
        </div>
        <p className="text-gray-400">
          Seguimiento de estudiantes citados del curso {curso.codigo} - {curso.asignatura}.
        </p>
      </div>

      <CitacionesClient cursoId={cursoId} initialCitaciones={citaciones} currentMonth={currentMonth} />
    </div>
  )
}
