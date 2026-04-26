'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'
import { actualizarDetallesCurso } from '@/lib/actions/cursos'

type CursoConEstudiantes = Tables<'cursos'> & { num_estudiantes: number; semana: string | null }

function EditarCursoModal({ curso, onClose }: { curso: CursoConEstudiantes; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await actualizarDetallesCurso(curso.id, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Editar curso</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Asignatura</label>
            <input
              name="asignatura"
              defaultValue={curso.asignatura}
              className="input"
              required
              minLength={3}
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código</label>
              <input
                name="codigo"
                defaultValue={curso.codigo}
                className="input"
                required
                minLength={2}
                maxLength={30}
              />
            </div>
            <div>
              <label className="label">Periodo</label>
              <input
                name="periodo"
                defaultValue={curso.periodo ?? ''}
                className="input"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio</label>
              <input
                type="date"
                name="fecha_inicio"
                defaultValue={curso.fecha_inicio?.slice(0, 10) ?? ''}
                className="input"
              />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input
                type="date"
                name="fecha_fin"
                defaultValue={curso.fecha_fin?.slice(0, 10) ?? ''}
                className="input"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost border border-gray-700">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 btn-primary">
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CursosClient({ cursos }: { cursos: CursoConEstudiantes[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')
  const [cursoEditando, setCursoEditando] = useState<CursoConEstudiantes | null>(null)

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
      {cursoEditando && (
        <EditarCursoModal curso={cursoEditando} onClose={() => setCursoEditando(null)} />
      )}

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
              <div key={curso.id} className="card relative group/card hover:border-gray-700 transition-colors">
                {/* Área clicable principal */}
                <Link href={`/dashboard/cursos/${curso.id}`} className="block group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                          {curso.codigo}
                        </span>
                        <span className="text-xs text-gray-500">{curso.periodo}</span>
                      </div>
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
                      <p className="text-xs text-gray-500">estudiantes</p>
                      {curso.semana && curso.semana !== 'Curso finalizado' && (
                        <span className="inline-block mt-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                          {curso.semana}
                        </span>
                      )}
                      {curso.semana === 'Curso finalizado' && (
                        <span className="inline-block mt-1 text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                          Finalizado
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Botón editar — siempre visible (funciona en móvil y desktop) */}
                <button
                  onClick={() => setCursoEditando(curso)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-all"
                  title="Editar curso"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
