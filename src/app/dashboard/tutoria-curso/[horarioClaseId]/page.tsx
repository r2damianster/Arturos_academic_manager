import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContextoSesionTutoriaCurso } from '@/lib/actions/tutoria-curso'
import { SesionTutoriaCursoClient } from './sesion-tutoria-curso-client'

export default async function SesionTutoriaCursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ horarioClaseId: string }>
  searchParams: Promise<{ fecha?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { horarioClaseId } = await params
  const { fecha: fechaParam } = await searchParams
  const fecha = fechaParam ?? new Date().toISOString().split('T')[0]

  const { error, contexto } = await getContextoSesionTutoriaCurso(horarioClaseId, fecha)
  if (error || !contexto) {
    return (
      <div className="max-w-xl mx-auto card text-sm text-gray-400">
        {error ?? 'No se pudo cargar la tutoría'}
      </div>
    )
  }

  const { data: horario } = await (supabase as any)
    .from('horarios_clases')
    .select('curso_id')
    .eq('id', horarioClaseId)
    .single()

  return (
    <SesionTutoriaCursoClient
      horarioClaseId={horarioClaseId}
      cursoId={horario.curso_id}
      fecha={fecha}
      contexto={contexto}
    />
  )
}
