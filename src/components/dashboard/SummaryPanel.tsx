'use client'

import Link from 'next/link'
import { useCollapsible } from '@/lib/hooks/use-collapsible'

interface Props {
  totalCursos: number
  totalEstudiantes: number
  asistenciaHoy: number
  cursosRecientes: { id: string; asignatura: string; codigo: string; periodo: string; tipo?: string | null }[]
}

export function SummaryPanel({ totalCursos, totalEstudiantes, asistenciaHoy, cursosRecientes }: Props) {
  const { open, toggle } = useCollapsible('summary-panel-open', false)

  return (
    <div className="card">
      {/* Always-visible bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={toggle}
          className="flex items-center gap-3 text-left min-w-0"
        >
          <svg
            className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-medium text-gray-400">Resumen</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              <span className="text-white font-semibold">{totalCursos}</span> cursos
            </span>
            <span className="text-xs text-gray-500">
              <span className="text-white font-semibold">{totalEstudiantes}</span> estudiantes
            </span>
            <span className="text-xs text-gray-500">
              <span className="text-emerald-400 font-semibold">{asistenciaHoy}</span> asist. hoy
            </span>
          </div>
        </button>
      </div>

      {/* Expandable content */}
      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <span className="stat-value">{totalCursos}</span>
              <span className="stat-label">Cursos activos</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{totalEstudiantes}</span>
              <span className="stat-label">Estudiantes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{asistenciaHoy}</span>
              <span className="stat-label">Asistencia hoy</span>
            </div>
          </div>

          {cursosRecientes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Cursos recientes</span>
                <Link href="/dashboard/cursos" className="text-xs text-brand-400 hover:text-brand-300">
                  Ver todos →
                </Link>
              </div>
              <div className="space-y-1">
                {cursosRecientes.map(curso => (
                  <Link
                    key={curso.id}
                    href={`/dashboard/cursos/${curso.id}`}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors group ${
                      curso.tipo === 'tutorados'
                        ? 'hover:bg-purple-900/20 border border-purple-800/30'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium group-hover:text-white ${
                          curso.tipo === 'tutorados' ? 'text-purple-300' : 'text-gray-200'
                        }`}>
                          {curso.asignatura}
                        </p>
                        {curso.tipo === 'tutorados' && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Tutorados
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{curso.codigo} · {curso.periodo}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {cursosRecientes.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No tienes cursos aún</p>
              <Link href="/dashboard/cursos/nuevo" className="btn-primary text-sm">
                + Crear primer curso
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
