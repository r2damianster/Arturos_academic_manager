'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  totalCursos: number
  totalEstudiantes: number
  asistenciaHoy: number
  cursosRecientes: { id: string; asignatura: string; codigo: string; periodo: string }[]
}

export function SummaryPanel({ totalCursos, totalEstudiantes, asistenciaHoy, cursosRecientes }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('summary-panel-open')
    if (saved !== null) setOpen(saved === 'true')
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('summary-panel-open', String(next))
  }

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
        <Link
          href="/dashboard/pase-lista"
          className="btn-primary text-sm px-4 py-1.5 flex-shrink-0"
        >
          Tomar Lista
        </Link>
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
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-200 group-hover:text-white">
                        {curso.asignatura}
                      </p>
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
