import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type BitacoraClase = Tables<'bitacora_clase'>

export default async function BitacoraPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, entradasRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('bitacora_clase').select('*').eq('curso_id', cursoId).order('fecha', { ascending: false }),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const entradas: BitacoraClase[] = entradasRes.data ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Bitácora de clase</h1>
            <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo}</p>
          </div>
        </div>
        <Link href={`/dashboard/cursos/${cursoId}/bitacora/nueva`} className="btn-primary">
          + Nueva entrada
        </Link>
      </div>

      {entradas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-3">No hay entradas en la bitácora</p>
          <Link href={`/dashboard/cursos/${cursoId}/bitacora/nueva`} className="btn-primary text-sm">
            Registrar primera clase
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {entradas.map(entrada => (
            <div key={entrada.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {new Date(entrada.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </span>
                    {entrada.semana && <span className="badge-azul">{entrada.semana}</span>}
                  </div>
                  <h3 className="font-semibold text-white">{entrada.tema}</h3>
                </div>
              </div>
              {entrada.actividades && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Actividades</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{entrada.actividades}</p>
                </div>
              )}
              {entrada.materiales && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Materiales</p>
                  <p className="text-sm text-gray-300">{entrada.materiales}</p>
                </div>
              )}
              {entrada.observaciones && (
                <div className="mt-2 pl-3 border-l border-gray-700">
                  <p className="text-xs text-gray-400 italic">{entrada.observaciones}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
