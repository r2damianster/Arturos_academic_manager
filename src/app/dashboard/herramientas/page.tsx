import { createClient } from '@/lib/supabase/server'
import { HerramientasClient } from './herramientas-client'

export default async function HerramientasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: cursos } = await db
    .from('cursos')
    .select('id, asignatura, codigo')
    .eq('profesor_id', user.id)
    .order('asignatura')

  const cursosData = (cursos ?? []) as { id: string; asignatura: string; codigo: string }[]
  const primerCurso = cursosData[0] ?? null

  let estudiantesIniciales: { id: string; nombre: string }[] = []
  if (primerCurso) {
    const { data } = await db
      .from('estudiantes')
      .select('id, nombre')
      .eq('curso_id', primerCurso.id)
      .order('nombre')
    estudiantesIniciales = data ?? []
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Herramientas</h1>
        <p className="text-gray-400 text-sm mt-1">Ruleta y agrupación aleatoria para usar en cualquier momento</p>
      </div>

      <HerramientasClient
        cursos={cursosData}
        estudiantesIniciales={estudiantesIniciales}
        cursoIdInicial={primerCurso?.id ?? null}
      />
    </main>
  )
}
