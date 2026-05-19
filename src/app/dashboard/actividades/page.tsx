import { createClient } from '@/lib/supabase/server'
import { getActividades, getCounts } from '@/lib/actions/actividades'
import { ActividadesClient } from './actividades-client'

export default async function ActividadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [counts, actividades, { data: cursosRaw }] = await Promise.all([
    getCounts(),
    getActividades({ archivada: false }),
    supabase
      .from('cursos')
      .select('id, asignatura, codigo')
      .eq('profesor_id', user.id)
      .order('asignatura'),
  ])

  const cursos = (cursosRaw ?? []) as { id: string; asignatura: string; codigo: string }[]

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notas</h1>
        <p className="text-gray-400 text-sm mt-1">Ideas, tareas y recordatorios — convierte cualquiera en evento, clase o tutoría</p>
      </div>

      <ActividadesClient
        counts={counts}
        cursos={cursos}
        actividadesIniciales={actividades}
      />
    </main>
  )
}
