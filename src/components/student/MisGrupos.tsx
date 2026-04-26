'use client'

import { useState, useEffect, useTransition } from 'react'
import { unirseAGrupo, salirDeGrupo, getGruposAbiertosParaEstudiante } from '@/lib/actions/grupos'

type GrupoInfo = {
  id: string
  nombre: string
  categoria: string | null
  max_integrantes: number | null
  curso_id: string
  orden: number
  currentCount: number
}

type Props = {
  cursoIds: string[]
  cursosMap: Record<string, string>  // cursoId → asignatura
  gruposIniciales: GrupoInfo[]
  misMembresiasIniciales: { grupo_id: string; estudiante_id: string }[]
  estudiantesByCurso: Record<string, string>  // cursoId → estudianteId
}

const BADGE_COLORS = [
  'bg-indigo-900/50 border-indigo-700 text-indigo-200',
  'bg-emerald-900/50 border-emerald-700 text-emerald-200',
  'bg-rose-900/50 border-rose-700 text-rose-200',
  'bg-amber-900/50 border-amber-700 text-amber-200',
  'bg-violet-900/50 border-violet-700 text-violet-200',
  'bg-cyan-900/50 border-cyan-700 text-cyan-200',
  'bg-pink-900/50 border-pink-700 text-pink-200',
  'bg-lime-900/50 border-lime-700 text-lime-200',
]

export function MisGrupos({
  cursoIds,
  cursosMap,
  gruposIniciales,
  misMembresiasIniciales,
  estudiantesByCurso,
}: Props) {
  const [grupos, setGrupos] = useState(gruposIniciales)
  const [membresias, setMembresias] = useState(misMembresiasIniciales)
  const [estudianteIds, setEstudianteIds] = useState(estudiantesByCurso)
  const [isPending, startTransition] = useTransition()
  const [loadingGrupoId, setLoadingGrupoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Agrupar por curso
  const gruposByCurso = cursoIds.reduce<Record<string, GrupoInfo[]>>((acc, cid) => {
    acc[cid] = grupos.filter(g => g.curso_id === cid)
    return acc
  }, {})

  const cursosConGrupos = cursoIds.filter(cid => (gruposByCurso[cid]?.length ?? 0) > 0)
  if (cursosConGrupos.length === 0) return null

  function miGrupoEnCurso(cursoId: string): GrupoInfo | undefined {
    const estId = estudianteIds[cursoId]
    if (!estId) return undefined
    const mem = membresias.find(m => m.estudiante_id === estId)
    if (!mem) return undefined
    return grupos.find(g => g.id === mem.grupo_id)
  }

  async function refresh() {
    const data = await getGruposAbiertosParaEstudiante(cursoIds)
    setGrupos(data.grupos)
    setMembresias(data.misMembresias)
    setEstudianteIds(data.estudiantesByCurso)
  }

  // Polling cada 15s
  useEffect(() => {
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoIds.join(',')])

  function handleUnirse(grupoId: string) {
    setError(null)
    setLoadingGrupoId(grupoId)
    startTransition(async () => {
      const result = await unirseAGrupo(grupoId)
      if (result.error) {
        setError(result.error)
      } else {
        await refresh()
      }
      setLoadingGrupoId(null)
    })
  }

  function handleSalir(grupoId: string) {
    setError(null)
    setLoadingGrupoId(grupoId)
    startTransition(async () => {
      const result = await salirDeGrupo(grupoId)
      if (result.error) {
        setError(result.error)
      } else {
        await refresh()
      }
      setLoadingGrupoId(null)
    })
  }

  return (
    <div className="card space-y-5">
      <h2 className="font-semibold text-white text-sm">Grupos de clase</h2>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {cursosConGrupos.map(cursoId => {
        const grupsCurso = gruposByCurso[cursoId]
        const miGrupo = miGrupoEnCurso(cursoId)
        const estId = estudianteIds[cursoId]

        return (
          <div key={cursoId} className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">{cursosMap[cursoId]}</p>

            {/* Mi grupo actual */}
            {miGrupo && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border border-emerald-800 rounded-lg">
                <span className="text-emerald-400 text-sm">✓</span>
                <p className="text-sm text-emerald-300 font-medium">
                  Estás en: <span className="font-bold">{miGrupo.nombre}</span>
                </p>
                <button
                  onClick={() => handleSalir(miGrupo.id)}
                  disabled={isPending}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                >
                  Salir
                </button>
              </div>
            )}

            {/* Lista de grupos */}
            <div className="space-y-2">
              {grupsCurso.map((g, i) => {
                const esMio = miGrupo?.id === g.id
                const lleno = g.max_integrantes !== null && g.currentCount >= g.max_integrantes
                const loading = loadingGrupoId === g.id

                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                      esMio
                        ? 'border-emerald-700/50 bg-emerald-900/10'
                        : 'border-gray-700/50 bg-gray-800/30'
                    }`}
                  >
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${BADGE_COLORS[i % BADGE_COLORS.length]}`}>
                      {g.nombre}
                    </span>

                    <span className="text-xs text-gray-500 ml-auto">
                      {g.currentCount}
                      {g.max_integrantes ? `/${g.max_integrantes}` : ''} integrantes
                    </span>

                    {!esMio && !miGrupo && (
                      <button
                        onClick={() => handleUnirse(g.id)}
                        disabled={isPending || lleno}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                          lleno
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {loading ? '…' : lleno ? 'Lleno' : 'Unirme'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
