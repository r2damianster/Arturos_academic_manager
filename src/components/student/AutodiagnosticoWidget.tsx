'use client'

import { useState } from 'react'
import { generarAutodiagnostico } from '@/lib/actions/generar-contenido'

interface Props {
  asignatura: string
  pctAsistencia: number | null
  trabajosActivos: number
  trabajosCompletados: number
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}

export function AutodiagnosticoWidget(props: Props) {
  const [loading,  setLoading]  = useState(false)
  const [mensaje,  setMensaje]  = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function handleGenerar() {
    setLoading(true)
    setError(null)
    const result = await generarAutodiagnostico(props)
    setLoading(false)
    if (result.error) setError('No se pudo generar el diagnóstico')
    else setMensaje(result.mensaje)
  }

  if (mensaje) {
    return (
      <div className="flex gap-3 px-3 py-3 bg-indigo-900/20 border border-indigo-700/40 rounded-xl">
        <span className="text-indigo-400 text-lg flex-shrink-0 mt-0.5">✦</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-indigo-200 leading-relaxed">{mensaje}</p>
          <button
            onClick={() => setMensaje(null)}
            className="text-[11px] text-indigo-500 hover:text-indigo-400 mt-1.5 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={handleGenerar}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-700/40 hover:border-indigo-600/60 bg-indigo-900/10 hover:bg-indigo-900/20 rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
      >
        {loading ? (
          <>
            <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Analizando…
          </>
        ) : (
          <>✦ Ver cómo voy en este curso</>
        )}
      </button>
    </div>
  )
}
