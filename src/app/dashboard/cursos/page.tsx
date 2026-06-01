import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database.types'
import { CursosClient } from './client'

type CursoRow = Tables<'cursos'> & { num_estudiantes: number; semana: string | null; estudiantes_nombres: string[] }

export default async function CursosPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: cursos } = await db
    .from('cursos')
    .select('id, codigo, asignatura, periodo, fecha_inicio, fecha_fin, tipo')
    .order('created_at', { ascending: false })

  const cursosArray = (cursos as Pick<CursoRow, 'id' | 'codigo' | 'asignatura' | 'periodo' | 'fecha_inicio' | 'fecha_fin' | 'tipo'>[]) ?? []

  const cursosConCount: CursoRow[] = await Promise.all(
    cursosArray.map(async curso => {
      const esTutorados = curso.tipo === 'tutorados'
      const [estudiantesResult, semanaResult] = await Promise.all([
        db.from('estudiantes').select('nombres, apellidos').eq('curso_id', curso.id),
        esTutorados ? Promise.resolve({ data: null }) : db.rpc('calcular_semana', { p_curso_id: curso.id }),
      ])
      const estudiantes: { nombres: string; apellidos: string }[] = estudiantesResult.data ?? []
      return {
        ...curso,
        num_estudiantes: estudiantes.length,
        semana: esTutorados ? null : (semanaResult.data ?? null),
        estudiantes_nombres: estudiantes.map(e => `${e.nombres} ${e.apellidos}`),
      } as CursoRow
    })
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Cursos</h1>
          <p className="text-gray-400 mt-1 text-sm">{cursosConCount.length} cursos registrados</p>
        </div>
        <a
          href="/dashboard/cursos/nuevo"
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Curso
        </a>
      </div>
      <CursosClient cursos={cursosConCount} />
    </div>
  )
}
