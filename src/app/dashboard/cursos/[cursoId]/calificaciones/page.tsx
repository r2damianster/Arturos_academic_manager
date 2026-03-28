import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalificacionesTable } from '@/components/calificaciones/calificaciones-table'
import type { Tables } from '@/types/database.types'

type Calificacion = Tables<'calificaciones'>
type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email'>

export default async function CalificacionesPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, califRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email').eq('curso_id', cursoId).order('nombre'),
    db.from('calificaciones').select('*').eq('curso_id', cursoId),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const calificaciones = (califRes.data ?? []) as Calificacion[]

  const mapaCalif: Record<string, Calificacion> = {}
  for (const c of calificaciones) {
    mapaCalif[c.estudiante_id] = c
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Calificaciones</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo}</p>
        </div>
      </div>

      {estudiantes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay estudiantes en este curso.</p>
        </div>
      ) : (
        <CalificacionesTable
          cursoId={cursoId}
          estudiantes={estudiantes}
          calificaciones={mapaCalif}
        />
      )}
    </div>
  )
}
