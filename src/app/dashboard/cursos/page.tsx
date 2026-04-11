import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database.types'
import { CursosClient } from './client'

type CursoRow = Tables<'cursos'> & { num_estudiantes: number }

export default async function CursosPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: cursos } = await db
    .from('cursos')
    .select('id, codigo, asignatura, periodo, fecha_inicio, fecha_fin')
    .order('created_at', { ascending: false })

  const cursosArray = (cursos as Pick<CursoRow, 'id' | 'codigo' | 'asignatura' | 'periodo' | 'fecha_inicio' | 'fecha_fin'>[]) ?? []

  const cursosConCount: CursoRow[] = await Promise.all(
    cursosArray.map(async curso => {
      const { count } = await db
        .from('estudiantes')
        .select('*', { count: 'exact', head: true })
        .eq('curso_id', curso.id)
      return { ...curso, num_estudiantes: count ?? 0 } as CursoRow
    })
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Cursos</h1>
        <p className="text-gray-400 mt-1 text-sm">{cursosConCount.length} cursos registrados</p>
      </div>
      <CursosClient cursos={cursosConCount} />
    </div>
  )
}
