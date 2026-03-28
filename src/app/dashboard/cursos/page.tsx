import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Cursos</h1>
          <p className="text-gray-400 mt-1 text-sm">{cursosConCount.length} cursos registrados</p>
        </div>
        <Link href="/dashboard/cursos/nuevo" className="btn-primary">+ Nuevo curso</Link>
      </div>

      {cursosConCount.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-gray-300 font-medium mb-2">No tienes cursos aún</p>
          <p className="text-gray-500 text-sm mb-6">Crea tu primer curso para comenzar a gestionar estudiantes</p>
          <Link href="/dashboard/cursos/nuevo" className="btn-primary">Crear primer curso</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cursosConCount.map(curso => (
            <Link
              key={curso.id}
              href={`/dashboard/cursos/${curso.id}`}
              className="card hover:border-gray-700 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      {curso.codigo}
                    </span>
                    <span className="text-xs text-gray-500">{curso.periodo}</span>
                  </div>
                  <h3 className="font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                    {curso.asignatura}
                  </h3>
                  {curso.fecha_inicio && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(curso.fecha_inicio).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                      {curso.fecha_fin && (
                        <> — {new Date(curso.fecha_fin).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-2xl font-bold text-white">{curso.num_estudiantes}</p>
                  <p className="text-xs text-gray-500">estudiantes</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-800 flex gap-3 text-xs text-gray-500">
                <span>Pase de lista →</span>
                <span>Asistencia →</span>
                <span>Calificaciones →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
