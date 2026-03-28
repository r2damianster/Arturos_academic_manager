import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type Trabajo = Pick<Tables<'trabajos_asignados'>, 'id' | 'estudiante_id' | 'tipo' | 'tema' | 'estado' | 'fecha_asignacion'>
type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email'>

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':   'text-yellow-400 bg-yellow-900/30 border-yellow-800',
  'En progreso': 'text-blue-400 bg-blue-900/30 border-blue-800',
  'Entregado':   'text-purple-400 bg-purple-900/30 border-purple-800',
  'Aprobado':    'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  'Reprobado':   'text-red-400 bg-red-900/30 border-red-800',
}

export default async function TrabajosPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, trabajosRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email').eq('curso_id', cursoId).order('nombre'),
    db.from('trabajos_asignados').select('id, estudiante_id, tipo, tema, estado, fecha_asignacion').eq('curso_id', cursoId),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const trabajos: Trabajo[] = trabajosRes.data ?? []

  // Indexar trabajos por estudiante
  const trabajosPorEstudiante = new Map<string, Trabajo[]>()
  for (const est of estudiantes) trabajosPorEstudiante.set(est.id, [])
  for (const t of trabajos) {
    const arr = trabajosPorEstudiante.get(t.estudiante_id)
    if (arr) arr.push(t)
  }

  const totalPendientes = trabajos.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso').length

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
            <h1 className="text-2xl font-bold text-white">Trabajos</h1>
            <p className="text-gray-400 text-sm">{curso.asignatura} · {totalPendientes} activos</p>
          </div>
        </div>
        <Link href={`/dashboard/cursos/${cursoId}/trabajos/nuevo`} className="btn-primary">
          + Asignar
        </Link>
      </div>

      {estudiantes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay estudiantes en este curso</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-800">
          {estudiantes.map(est => {
            const ts = trabajosPorEstudiante.get(est.id) ?? []
            const pendientes = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso')

            return (
              <div key={est.id} className="py-3 px-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/dashboard/estudiantes/${est.id}`}
                        className="font-medium text-gray-200 hover:text-white transition-colors text-sm">
                        {est.nombre}
                      </Link>
                      {pendientes.length > 0 && (
                        <span className="text-xs text-orange-400 bg-orange-900/30 border border-orange-800 px-1.5 py-0.5 rounded-full">
                          {pendientes.length} activo{pendientes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {ts.length === 0 ? (
                      <p className="text-xs text-gray-600">Sin trabajos asignados</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ts.map(t => (
                          <span
                            key={t.id}
                            className={`px-2 py-0.5 rounded-full text-xs border ${ESTADO_COLORS[t.estado] ?? ''}`}
                            title={t.tema ?? t.tipo}
                          >
                            {t.tipo}{t.tema ? ` · ${t.tema.slice(0, 25)}${t.tema.length > 25 ? '…' : ''}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/dashboard/cursos/${cursoId}/trabajos/nuevo?estudianteId=${est.id}`}
                    className="btn-ghost text-xs px-3 py-1.5 flex-shrink-0"
                  >
                    + Asignar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
