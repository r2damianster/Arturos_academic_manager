import { redirect } from 'next/navigation'
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
        <h1 className="text-2xl font-bold text-white mb-2">Historial de Citaciones a Tutoría</h1>
        <p className="text-gray-400">
          Seguimiento de estudiantes citados del curso {curso.codigo} - {curso.asignatura}.
        </p>
      </div>

      <CitacionesClient cursoId={cursoId} initialCitaciones={citaciones} currentMonth={currentMonth} />
    </div>
  )
}
