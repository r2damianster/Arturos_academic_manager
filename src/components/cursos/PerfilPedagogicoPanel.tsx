'use client'

import { useState } from 'react'
import { generarPerfilPedagogico } from '@/lib/actions/generar-contenido'

interface Props {
  asignatura: string
  contexto: string
}

export function PerfilPedagogicoPanel({ asignatura, contexto }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [perfil,   setPerfil]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [copiado,  setCopiado]  = useState(false)

  async function handleGenerar() {
    setLoading(true)
    setError(null)
    const result = await generarPerfilPedagogico({ asignatura, contexto })
    setLoading(false)
    if (result.error) setError(result.error)
    else setPerfil(result.perfil)
  }

  function handleCopiar() {
    if (!perfil) return
    navigator.clipboard.writeText(perfil)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Estrategia pedagógica del grupo</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Generado por IA basándose en los datos de la encuesta
          </p>
        </div>
        <button
          onClick={handleGenerar}
          disabled={loading}
          className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analizando…
            </>
          ) : (
            <>✦ {perfil ? 'Regenerar' : 'Generar perfil'}</>
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {perfil && (
        <div className="space-y-3">
          <div className="bg-gray-800/60 border border-purple-500/20 rounded-xl p-4">
            {perfil.split('\n\n').map((parrafo, i) => (
              <p key={i} className={`text-sm text-gray-200 leading-relaxed ${i > 0 ? 'mt-3' : ''}`}>
                {parrafo}
              </p>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCopiar}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
            >
              {copiado ? '✓ Copiado' : '⎘ Copiar texto'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
