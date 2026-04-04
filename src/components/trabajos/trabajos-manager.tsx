'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { actualizarTrabajo, eliminarTrabajo, agregarObservacionTrabajo } from '@/lib/actions/trabajos'

import { TrabajoEditPanel, type Trabajo } from './trabajo-edit-panel'

export type { Trabajo }

type Estudiante = {
  id: string
  nombre: string
  email: string
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  trabajos: Trabajo[]
}

const TIPOS_TRABAJO = ['Exposición', 'Investigación', 'Proyecto', 'Tarea', 'Laboratorio', 'Práctica', 'Otro']
const ESTADOS = ['Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado']

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':   'text-yellow-400 bg-yellow-900/30 border-yellow-800',
  'En progreso': 'text-blue-400 bg-blue-900/30 border-blue-800',
  'Entregado':   'text-purple-400 bg-purple-900/30 border-purple-800',
  'Aprobado':    'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  'Reprobado':   'text-red-400 bg-red-900/30 border-red-800',
}

export function TrabajosManager({ cursoId, estudiantes, trabajos }: Props) {
  const [selected, setSelected] = useState<{ trabajo: Trabajo; estudiante: Estudiante } | null>(null)
  function closePanel() {
    setSelected(null)
  }

  const trabajosPorEstudiante = new Map<string, Trabajo[]>()
  for (const est of estudiantes) trabajosPorEstudiante.set(est.id, [])
  for (const t of trabajos) {
    const arr = trabajosPorEstudiante.get(t.estudiante_id)
    if (arr) arr.push(t)
  }

  return (
    <>
      <div className="card divide-y divide-gray-800">
        {estudiantes.map(est => {
          const ts = trabajosPorEstudiante.get(est.id) ?? []
          const pendientes = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso')

          return (
            <div key={est.id} className="py-3 px-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/dashboard/estudiantes/${est.id}`}
                      className="font-medium text-gray-200 hover:text-white transition-colors text-sm"
                    >
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
                        <button
                          key={t.id}
                          onClick={() => setSelected({ trabajo: t, estudiante: est })}
                          className={`px-2 py-0.5 rounded-full text-xs border transition-all hover:ring-1 hover:ring-white/30 ${ESTADO_COLORS[t.estado ?? ''] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}
                          title="Clic para editar"
                        >
                          {t.tipo}{t.tema ? ` · ${t.tema.slice(0, 25)}${t.tema.length > 25 ? '…' : ''}` : ''}
                        </button>
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

      {/* Edit Panel */}
      {selected && (
        <TrabajoEditPanel
          cursoId={cursoId}
          estudianteNombre={selected.estudiante.nombre}
          estudianteId={selected.estudiante.id}
          trabajo={selected.trabajo}
          onClose={closePanel}
        />
      )}
    </>
  )
}

