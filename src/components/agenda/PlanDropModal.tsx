'use client'

import { useState } from 'react'
import type { AccionDrag, ColisionDrag } from '@/lib/actions/bitacora'

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtFecha(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${y}`
}

interface Props {
  source: { asignatura: string; fecha: string; tema?: string }
  dest:   { asignatura: string; fecha: string; hasPlan: boolean; tema?: string }
  onConfirm: (accion: AccionDrag, colision: ColisionDrag) => Promise<{ error?: string }>
  onClose: () => void
}

export function PlanDropModal({ source, dest, onConfirm, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(accion: AccionDrag, colision: ColisionDrag) {
    setSaving(true)
    setError(null)
    const result = await onConfirm(accion, colision)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Mover planificación</h3>
        <p className="text-sm text-gray-400 mb-3 font-medium bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700 truncate">
          &ldquo;{source.tema || source.asignatura}&rdquo;
        </p>
        <p className="text-xs text-gray-600 mb-5">
          {source.asignatura} · {fmtFecha(source.fecha)}
          <span className="mx-1 text-gray-700">→</span>
          {dest.asignatura} · {fmtFecha(dest.fecha)}
        </p>

        <div className="space-y-2.5">
          {dest.hasPlan ? (
            <>
              <p className="text-xs font-semibold text-orange-400 tracking-wider uppercase mb-2 text-left px-1">
                Destino tiene plan
              </p>
              <button onClick={() => handle('mover', 'reemplazar')} disabled={saving}
                className="w-full btn-primary py-2.5 disabled:opacity-50">
                Mover y Reemplazar
              </button>
              <button onClick={() => handle('copiar', 'reemplazar')} disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all py-2.5 disabled:opacity-50">
                Copiar y Reemplazar
              </button>
              <button onClick={() => handle('mover', 'combinar')} disabled={saving}
                className="w-full btn-primary py-2.5 disabled:opacity-50">
                Mover y Combinar
              </button>
              <button onClick={() => handle('mover', 'cascada')} disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all py-2.5 shadow-lg shadow-emerald-900/20 disabled:opacity-50">
                Mover en Cascada 🌊
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-sky-400 tracking-wider uppercase mb-2 text-left px-1">
                Destino libre
              </p>
              <button onClick={() => handle('mover', 'vacio')} disabled={saving}
                className="w-full btn-primary py-2.5 disabled:opacity-50">
                Mover (cambiar de día)
              </button>
              <button onClick={() => handle('copiar', 'vacio')} disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all py-2.5 disabled:opacity-50">
                Copiar (repetir plan)
              </button>
              <button onClick={() => handle('mover', 'cascada')} disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all py-2.5 shadow-lg shadow-emerald-900/20 disabled:opacity-50">
                Mover en Cascada 🌊
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 mt-3 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          disabled={saving}
          className="mt-5 text-sm text-gray-500 hover:text-gray-300 font-medium px-4 py-2 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
