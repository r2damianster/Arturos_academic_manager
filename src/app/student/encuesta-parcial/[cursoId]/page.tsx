import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEncuestaParcialExistente } from '@/lib/actions/encuesta-parcial'
import { EncuestaParcialForm } from './encuesta-parcial-form'

export default async function EncuestaParcialPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Verificar que el estudiante tiene acceso a este curso
  const { data: estudiante } = await db
    .from('estudiantes').select('id')
    .eq('auth_user_id', user.id).eq('curso_id', cursoId).eq('estado', 'activo').maybeSingle()
  if (!estudiante) redirect('/student')

  // Cargar datos del curso
  const { data: curso } = await db
    .from('cursos').select('asignatura, fecha_inicio, fecha_fin, encuesta_parcial_habilitada')
    .eq('id', cursoId).single()
  if (!curso || !curso.encuesta_parcial_habilitada) redirect('/student')

  // Cargar encuesta existente (para precargar si ya respondió)
  const encuestaExistente = await getEncuestaParcialExistente(cursoId)

  // Calcular % del curso
  const inicio = new Date(curso.fecha_inicio).getTime()
  const fin = new Date(curso.fecha_fin).getTime()
  const pct = Math.round(((Date.now() - inicio) / (fin - inicio)) * 100)

  return (
    <div className="min-h-screen bg-gray-950 pt-4 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <p className="text-gray-400 text-sm">Encuesta de progreso</p>
          <h1 className="text-white text-xl font-semibold mt-1">{curso.asignatura}</h1>
          <p className="text-gray-500 text-xs mt-1">Llevamos el {pct}% del semestre · ~5 minutos</p>
        </div>
        <EncuestaParcialForm
          cursoId={cursoId}
          asignatura={curso.asignatura}
          encuestaExistente={encuestaExistente}
        />
      </div>
    </div>
  )
}
