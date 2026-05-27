'use client'

import { useState } from 'react'
import { generarRetroalimentacionFormativa } from '@/lib/actions/generar-contenido'

interface Props {
  asignatura: string
  pctAsistencia: number | null
  trabajosCompletados: number
  trabajosActivos: number
  trabajosTotal: number
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}

export function RetroalimentacionWidget(props: Props) {
  const [estado, setEstado] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [texto, setTexto] = useState<string | null>(null)

  async function handleGenerar() {
    setEstado('loading')
    const result = await generarRetroalimentacionFormativa(props)
    if (result.error || !result.retroalimentacion) {
      setEstado('error')
    } else {
      setTexto(result.retroalimentacion)
      setEstado('done')
    }
  }

  if (estado === 'idle') {
    return (
      <button
        onClick={handleGenerar}
        className="w-full text-xs py-2 px-3 rounded-lg border border-violet-800/50 text-violet-400 hover:bg-violet-900/20 transition-colors flex items-center justify-center gap-1.5"
      >
        <span>✦</span>
        Ver retroalimentación formativa
      </button>
    )
  }

  if (estado === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-violet-400 py-2 justify-center">
        <span className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
        Generando retroalimentación…
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <p className="text-xs text-red-400 text-center py-2">
        No se pudo generar la retroalimentación. Intenta de nuevo.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-violet-800/40 bg-violet-900/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">✦ Retroalimentación formativa</p>
        <button
          onClick={() => { setEstado('idle'); setTexto(null) }}
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        {texto?.split('\n\n').filter(p => p.trim()).map((parrafo, i) => (
          <p key={i} className="text-xs text-gray-300 leading-relaxed">{parrafo.trim()}</p>
        ))}
      </div>
    </div>
  )
}
