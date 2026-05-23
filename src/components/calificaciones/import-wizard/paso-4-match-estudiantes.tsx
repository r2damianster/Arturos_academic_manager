'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react'
import { calcularMatchesEstudiantes, type MatchEstudiante } from '@/lib/actions/calificaciones-import'
import { type FilaEstudiante } from '@/lib/parsers/moodle-calificaciones'

interface Props {
  cursoId: string
  filas: FilaEstudiante[]
  onContinuar: (matches: MatchEstudiante[]) => void
  onVolver: () => void
}

export default function Paso4MatchEstudiantes({ cursoId, filas, onContinuar, onVolver }: Props) {
  const [matches, setMatches] = useState<MatchEstudiante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    calcularMatchesEstudiantes(
      cursoId,
      filas.map(f => ({ email: f.email, num_id: f.num_id, nombre: f.nombre, apellido: f.apellido }))
    ).then(({ matches: m, error: e }) => {
      if (e || !m) { setError(e ?? 'Error'); return }
      setMatches(m)
      setCargando(false)
    })
  }, [cursoId, filas])

  const exactos = matches.filter(m => m.tipo_match === 'exacto').length
  const fuzzy   = matches.filter(m => m.tipo_match === 'fuzzy').length
  const sinMatch = matches.filter(m => m.tipo_match === 'ninguno').length

  const handleConfirmarFuzzy = (index: number) => {
    setMatches(prev => {
      const next = [...prev]
      next[index] = { ...next[index], tipo_match: 'exacto' }
      return next
    })
  }

  const handleIgnorar = (index: number) => {
    setMatches(prev => {
      const next = [...prev]
      next[index] = { ...next[index], estudiante_id: null, tipo_match: 'ninguno' }
      return next
    })
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <p className="ml-3 text-sm text-zinc-500">Buscando estudiantes…</p>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600 py-8 text-center">{error}</p>
  }

  const conMatch = matches.filter(m => m.estudiante_id !== null)

  return (
    <div className="flex flex-col gap-6">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{exactos + fuzzy}</p>
            <p className="text-xs text-green-600">Con match</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{fuzzy}</p>
            <p className="text-xs text-amber-600">Sugeridos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{sinMatch}</p>
            <p className="text-xs text-red-600">Sin match</p>
          </div>
        </div>
      </div>

      {/* Lista de matches */}
      <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
        {matches.map((m, i) => (
          <div key={m.email_moodle} className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
            m.tipo_match === 'exacto'  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10' :
            m.tipo_match === 'fuzzy'   ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10' :
                                         'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
          }`}>
            {/* Ícono */}
            <div className="shrink-0">
              {m.tipo_match === 'exacto' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {m.tipo_match === 'fuzzy'  && <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {m.tipo_match === 'ninguno' && <XCircle className="h-4 w-4 text-red-500" />}
            </div>

            {/* Moodle */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{m.nombre_moodle}</p>
              <p className="text-xs text-zinc-500 truncate">{m.email_moodle}</p>
            </div>

            {/* BD */}
            <div className="flex-1 min-w-0 text-right">
              {m.nombre_bd ? (
                <>
                  <p className="text-zinc-700 dark:text-zinc-300 truncate">{m.nombre_bd}</p>
                  {m.tipo_match === 'fuzzy' && (
                    <p className="text-xs text-amber-600">Coincidencia aproximada</p>
                  )}
                </>
              ) : (
                <p className="text-zinc-400 italic">No encontrado</p>
              )}
            </div>

            {/* Acciones */}
            {m.tipo_match === 'fuzzy' && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleConfirmarFuzzy(i)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => handleIgnorar(i)}
                  className="px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300"
                >
                  Ignorar
                </button>
              </div>
            )}
            {m.tipo_match === 'ninguno' && (
              <p className="text-xs text-red-500 shrink-0">Se omitirá</p>
            )}
          </div>
        ))}
      </div>

      {conMatch.length === 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          Ningún estudiante del archivo coincide con los del curso. Verifica que los emails en Moodle coincidan con los registrados en este curso.
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-between items-center pt-2">
        <button onClick={onVolver} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          ← Volver
        </button>
        <button
          onClick={() => onContinuar(matches)}
          disabled={conMatch.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          Ver vista previa ({conMatch.length} estudiantes)
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
