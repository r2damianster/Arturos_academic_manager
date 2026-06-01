'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type CursoConEstudiantes = Tables<'cursos'> & { num_estudiantes: number; semana: string | null }

export function CursosClient({ cursos }: { cursos: CursoConEstudiantes[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')

  const periodos = useMemo(() => {
    const set = new Set(cursos.map(c => c.periodo).filter(Boolean))
    return Array.from(set).sort()
  }, [cursos])

  const cursosFiltrados = useMemo(() => {
    return cursos.filter(curso => {
      const matchBusqueda =
        busqueda === '' ||
        curso.asignatura.toLowerCase().includes(busqueda.toLowerCase()) ||
        curso.codigo.toLowerCase().includes(busqueda.toLowerCase())
      const matchPeriodo = periodoFiltro === '' || curso.periodo === periodoFiltro
      return matchBusqueda && matchPeriodo
    })
  }, [cursos, busqueda, periodoFiltro])

  const hayFiltrosActivos = busqueda !== '' || periodoFiltro !== ''

  if (cursos.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-4xl mb-4">📚</p>
        <p className="text-gray-300 font-medium mb-2">No tienes cursos aún</p>
        <p className="text-gray-500 text-sm mb-6">Crea tu primer curso para comenzar a gestionar estudiantes</p>
        <Link href="/dashboard/cursos/nuevo" className="btn-primary">Crear primer curso</Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Buscar por asignatura o código..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input flex-1"
          />
          <select
            value={periodoFiltro}
            onChange={e => setPeriodoFiltro(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">Todos los periodos</option>
            {periodos.map(p => (
              <option key={p} value={p ?? ''}>{p}</option>
            ))}
          </select>
          {hayFiltrosActivos && (
            <button
              onClick={() => { setBusqueda(''); setPeriodoFiltro('') }}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2"
            >
              Limpiar
            </button>
          )}
        </div>

        {cursosFiltrados.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 font-medium mb-1">No se encontraron cursos con estos filtros</p>
            <p className="text-gray-500 text-sm">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cursosFiltrados.map(curso => (
              <div key={curso.id} className={`card card-lift ${curso.tipo === 'tutorados' ? 'border-purple-800/60 bg-purple-950/10' : ''}`}>
                {/* Fila superior: código · periodo · lápiz */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                    {curso.codigo}
                  </span>
                  <span className="text-xs text-gray-500">{curso.periodo}</span>
                  {curso.tipo === 'tutorados' && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      Tutorados
                    </span>
                  )}
                  <Link
                    href={`/dashboard/cursos/${curso.id}?edit=true`}
                    onClick={e => e.stopPropagation()}
                    className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-all"
                    title="Editar curso"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                    </svg>
                  </Link>
                </div>

                {/* Área clicable principal */}
                <Link href={`/dashboard/cursos/${curso.id}`} className="block group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
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
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-white">{curso.num_estudiantes}</p>
                      <p className="text-xs text-gray-500">{curso.tipo === 'tutorados' ? 'tutorados' : 'estudiantes'}</p>
                      {curso.semana && curso.semana !== 'Curso finalizado' && curso.tipo !== 'tutorados' && (
                        <span className="inline-block mt-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                          {curso.semana}
                        </span>
                      )}
                      {curso.semana === 'Curso finalizado' && curso.tipo !== 'tutorados' && (
                        <span className="inline-block mt-1 text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                          Finalizado
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
