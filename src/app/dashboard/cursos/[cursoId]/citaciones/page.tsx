import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCitacionesPorCurso } from '@/lib/actions/citaciones'
import { CitacionesClient } from './citaciones-client'

export default async function CitacionesPage({ params, searchParams }: { params: { cursoId: string }, searchParams: { mes?: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Obtener el curso para asegurar que existe y le pertenece
  const { data: curso } = await supabase
    .from('cursos')
    .select('asignatura, codigo')
    .eq('id', params.cursoId)
    .eq('profesor_id', user.id)
    .single()

  if (!curso) redirect('/dashboard/cursos')

  // Obtener las citaciones (filtradas por mes si se especifica)
  const citaciones = await getCitacionesPorCurso(params.cursoId, searchParams.mes)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Historial de Citaciones a Tutoría</h1>
        <p className="text-gray-400">
          Seguimiento de estudiantes citados del curso {curso.codigo} - {curso.asignatura}.
        </p>
      </div>

      <CitacionesClient cursoId={params.cursoId} initialCitaciones={citaciones} />
    </div>
  )
}
