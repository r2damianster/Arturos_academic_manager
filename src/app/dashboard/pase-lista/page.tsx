import { createClient } from '@/lib/supabase/server'
import { PaseListaListClient } from './client'

export default async function PaseListaSelectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch all courses
  const { data: cursos } = await db.from('cursos')
    .select('id, asignatura, codigo, periodo')
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tomar lista</h1>
        <p className="text-gray-400 mt-1 text-sm">Selecciona el curso temporal y materia para dictar asistencia</p>
      </div>
      <PaseListaListClient cursos={cursos || []} />
    </div>
  )
}
