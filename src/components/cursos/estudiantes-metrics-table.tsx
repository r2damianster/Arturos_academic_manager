'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EstadoEstudianteButton } from './estado-estudiante-button'

export interface EstudianteConMetricas {
  id: string
  nombre: string
  email: string
  estado: string
  tutoria: boolean | null
  pctAsistencia: number | null
  trabajosActivos: number
  tieneEncuesta: boolean
}

interface Props {
  cursoId: string
  estudiantes: EstudianteConMetricas[]
  retirados: EstudianteConMetricas[]
}

function AsistenciaBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-600">—</span>
  const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
  const bar   = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500'   : 'bg-red-500'
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <span className={`text-sm font-mono font-medium ${color}`}>{pct}%</span>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function EstudiantesMetricsTable({ cursoId, estudiantes, retirados }: Props) {
  const [mostrarRetirados, setMostrarRetirados] = useState(false)

  return (
    <div className="space-y-4">
      {/* Activos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">Estudiantes activos</h2>
            <p className="text-xs text-gray-500">Solo los activos aparecen en pase de lista y asistencia.</p>
          </div>
          <Link href={`/dashboard/cursos/${cursoId}/estudiantes/importar`}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            + Agregar
          </Link>
        </div>

        {estudiantes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-3">No hay estudiantes activos en este curso</p>
            <Link href={`/dashboard/cursos/${cursoId}/estudiantes/importar`} className="btn-primary text-sm">
              Importar estudiantes
            </Link>
          </div>
        ) : (
          <div>
            {/* Header — solo desktop */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 pb-2 mb-1 border-b border-gray-800 text-[11px] text-gray-500 uppercase tracking-widest">
              <span>Estudiante</span>
              <span className="text-center w-24">Asistencia</span>
              <span className="text-center w-20">Trabajos</span>
              <span className="text-center w-14">Encuesta</span>
              <span className="text-center w-20">Estado</span>
            </div>

            <div className="divide-y divide-gray-800">
              {estudiantes.map(est => (
                <div key={est.id}
                  className="py-3 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center group">

                  {/* Nombre + email */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-sm font-medium flex-shrink-0">
                      {est.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/dashboard/estudiantes/${est.id}`}
                        className="font-medium text-gray-200 hover:text-white transition-colors text-sm truncate block">
                        {est.nombre}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">{est.email}</p>
                    </div>
                  </div>

                  {/* Mobile: solo estado */}
                  <div className="md:hidden flex items-center gap-2">
                    {est.tutoria && <span className="badge-azul">T</span>}
                    <EstadoEstudianteButton estudianteId={est.id} cursoId={cursoId} currentEstado={est.estado} />
                  </div>

                  {/* Asistencia */}
                  <div className="hidden md:flex justify-center w-24">
                    <AsistenciaBar pct={est.pctAsistencia} />
                  </div>

                  {/* Trabajos activos */}
                  <div className="hidden md:flex justify-center w-20">
                    {est.trabajosActivos > 0 ? (
                      <Link href={`/dashboard/cursos/${cursoId}/trabajos`}
                        className="text-xs bg-orange-900/40 text-orange-300 border border-orange-800/50 rounded-full px-2 py-0.5 whitespace-nowrap hover:bg-orange-900/60 transition-colors">
                        {est.trabajosActivos} activo{est.trabajosActivos !== 1 ? 's' : ''}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </div>

                  {/* Encuesta */}
                  <div className="hidden md:flex justify-center w-14">
                    {est.tieneEncuesta
                      ? <span title="Respondió la encuesta" className="text-emerald-500 text-base">✓</span>
                      : <span className="text-gray-700 text-xs">—</span>
                    }
                  </div>

                  {/* Estado — desktop */}
                  <div className="hidden md:flex items-center justify-end gap-2 w-20">
                    {est.tutoria && <span className="badge-azul hidden lg:inline">T</span>}
                    <EstadoEstudianteButton estudianteId={est.id} cursoId={cursoId} currentEstado={est.estado} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Retirados — colapsado por defecto */}
      {retirados.length > 0 && (
        <div className="card">
          <button
            onClick={() => setMostrarRetirados(v => !v)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div>
              <h2 className="font-semibold text-gray-400 group-hover:text-gray-300 transition-colors">
                Retirados ({retirados.length})
              </h2>
              <p className="text-xs text-gray-600">Pueden reintegrarse al curso.</p>
            </div>
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${mostrarRetirados ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {mostrarRetirados && (
            <div className="divide-y divide-gray-800 mt-4 pt-4 border-t border-gray-800">
              {retirados.map(est => (
                <div key={est.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-sm font-medium flex-shrink-0">
                      {est.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/dashboard/estudiantes/${est.id}`}
                        className="font-medium text-gray-400 hover:text-white transition-colors text-sm">
                        {est.nombre}
                      </Link>
                      <p className="text-xs text-gray-600">{est.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-900 border border-gray-700 rounded-full px-2 py-0.5">
                      Retirado
                    </span>
                    <EstadoEstudianteButton estudianteId={est.id} cursoId={cursoId} currentEstado={est.estado} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
