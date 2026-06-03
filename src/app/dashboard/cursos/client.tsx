'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type CursoConEstudiantes = Tables<'cursos'> & {
  num_estudiantes: number
  semana: string | null
  estudiantes_nombres: string[]
  estado?: string | null
  link_publicacion?: string | null
}

type CursoFiltrado = CursoConEstudiantes & { _coincidentes: string[] }

function CursoCard({ curso, muted = false }: { curso: CursoFiltrado; muted?: boolean }) {
  const esActivo = !muted
  return (
    <div className={`card ${esActivo ? 'card-lift' : 'opacity-60'} ${curso.tipo === 'tutorados' ? 'border-purple-800/60 bg-purple-950/10' : ''}`}>
      {/* Fila superior */}
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
        {(curso.estado === 'finalizado' || curso.estado === 'archivado') && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
            curso.estado === 'archivado'
              ? 'bg-gray-800/60 text-gray-500 border-gray-700'
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}>
            {curso.estado === 'archivado' ? 'Archivado' : 'Finalizado'}
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
            <h3 className={`font-semibold transition-colors truncate ${esActivo ? 'text-gray-200 group-hover:text-white' : 'text-gray-400'}`}>
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
            <p className={`text-2xl font-bold ${esActivo ? 'text-white' : 'text-gray-500'}`}>{curso.num_estudiantes}</p>
            <p className="text-xs text-gray-500">{curso.tipo === 'tutorados' ? 'tutorados' : 'estudiantes'}</p>
            {curso.semana && curso.semana !== 'Curso finalizado' && curso.tipo !== 'tutorados' && esActivo && (
              <span className="inline-block mt-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                {curso.semana}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Link de publicación */}
      {curso.link_publicacion && (
        <a
          href={curso.link_publicacion}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-2 flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 truncate"
        >
          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {curso.link_publicacion.replace(/^https?:\/\//, '')}
        </a>
      )}

      {curso._coincidentes.length > 0 && (
        <p className="mt-2 text-xs text-blue-400/80 truncate">
          👤 {curso._coincidentes.slice(0, 2).join(', ')}
          {curso._coincidentes.length > 2 && ` +${curso._coincidentes.length - 2} más`}
        </p>
      )}
    </div>
  )
}

export function CursosClient({ cursos }: { cursos: CursoConEstudiantes[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false)

  const periodos = useMemo(() => {
    const set = new Set(cursos.map(c => c.periodo).filter(Boolean))
    return Array.from(set).sort()
  }, [cursos])

  const { activos, finalizados } = useMemo(() => {
    const q = busqueda.toLowerCase()

    const filtrar = (lista: CursoConEstudiantes[]): CursoFiltrado[] =>
      lista
        .filter(curso => {
          const matchCurso =
            q === '' ||
            curso.asignatura.toLowerCase().includes(q) ||
            curso.codigo.toLowerCase().includes(q) ||
            (curso.periodo ?? '').toLowerCase().includes(q)
          const matchEstudiante = q !== '' && curso.estudiantes_nombres.some(n => n.toLowerCase().includes(q))
          const matchPeriodo = periodoFiltro === '' || curso.periodo === periodoFiltro
          return (matchCurso || matchEstudiante) && matchPeriodo
        })
        .map(curso => {
          const matchesPorCurso =
            q === '' ||
            curso.asignatura.toLowerCase().includes(q) ||
            curso.codigo.toLowerCase().includes(q) ||
            (curso.periodo ?? '').toLowerCase().includes(q)
          const coincidentes = q !== '' && !matchesPorCurso
            ? curso.estudiantes_nombres.filter(n => n.toLowerCase().includes(q))
            : []
          return { ...curso, _coincidentes: coincidentes }
        })

    const activos = cursos.filter(c => !c.estado || c.estado === 'activo')
    const finalizados = cursos.filter(c => c.estado === 'finalizado' || c.estado === 'archivado')

    return { activos: filtrar(activos), finalizados: filtrar(finalizados) }
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
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por asignatura, código, periodo o estudiante..."
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

      {/* Cursos activos */}
      {activos.length === 0 && finalizados.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 font-medium mb-1">No se encontraron cursos con estos filtros</p>
          <p className="text-gray-500 text-sm">Intenta con otros términos de búsqueda</p>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activos.map(curso => <CursoCard key={curso.id} curso={curso} muted={false} />)}
            </div>
          )}

          {activos.length === 0 && !hayFiltrosActivos && (
            <p className="text-sm text-gray-500 text-center py-4">Sin cursos activos. Todos finalizados o archivados.</p>
          )}

          {/* Cursos finalizados / archivados */}
          {finalizados.length > 0 && (
            <div>
              <button
                onClick={() => setMostrarFinalizados(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-3"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${mostrarFinalizados ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Períodos anteriores ({finalizados.length})
              </button>

              {mostrarFinalizados && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {finalizados.map(curso => <CursoCard key={curso.id} curso={curso} muted={true} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
