import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { NuevoTrabajoForm } from '@/components/trabajos/nuevo-trabajo-form'
import type { Tables } from '@/types/database.types'

type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email'>

export default async function NuevoTrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ cursoId: string }>
  searchParams: Promise<{ estudianteId?: string }>
}) {
  const { cursoId } = await params
  const { estudianteId } = await searchParams
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email').eq('curso_id', cursoId).order('nombre'),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const fecha = new Date().toISOString().split('T')[0]

  const estudianteNombre = estudianteId
    ? estudiantes.find(e => e.id === estudianteId)?.nombre
    : undefined

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}/trabajos`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Asignar trabajo</h1>
          <p className="text-gray-400 text-sm">
            {estudianteNombre ? `${estudianteNombre} · ` : ''}{curso.asignatura}
          </p>
        </div>
      </div>

      <NuevoTrabajoForm
        cursoId={cursoId}
        estudiantes={estudiantes}
        preselectedId={estudianteId}
        fecha={fecha}
      />
    </div>
  )
}
