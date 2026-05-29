import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { EditarClient } from './editar-client'

export default async function EditarCursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ cursoId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { cursoId } = await params
  const { tab } = await searchParams
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [cursoRes, clasesRes, profesorRes, logrosRes] = await Promise.all([
    db.from('cursos').select('*').eq('id', cursoId).eq('profesor_id', user.id).single(),
    db.from('horarios_clases')
      .select('dia_semana, hora_inicio, hora_fin, tipo, centro_computo, obligatoria')
      .eq('curso_id', cursoId)
      .order('dia_semana').order('hora_inicio'),
    db.from('profesores').select('institucion').eq('id', user.id).maybeSingle(),
    db.from('logros_aprendizaje')
      .select('id, descripcion, orden')
      .eq('curso_id', cursoId)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!cursoRes.data) notFound()

  // Resolver nombres de estudiantes excluidos del panel de riesgo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alertas = (cursoRes.data as any).alertas_silenciadas ?? {}
  const excluidos: string[] = Array.isArray(alertas.riesgo_excluidos) ? alertas.riesgo_excluidos : []
  let estudiantesExcluidos: { id: string; nombre: string }[] = []
  if (excluidos.length > 0) {
    const { data: excData } = await db.from('estudiantes')
      .select('id, nombre')
      .in('id', excluidos)
      .eq('curso_id', cursoId)
    estudiantesExcluidos = excData ?? []
  }

  return (
    <EditarClient
      cursoId={cursoId}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curso={cursoRes.data as any}
      clases={clasesRes.data ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logros={logrosRes.data ?? [] as any}
      profesorInstitucion={profesorRes?.data?.institucion ?? null}
      defaultTab={tab ?? 'info'}
      estudiantesExcluidos={estudiantesExcluidos}
    />
  )
}
