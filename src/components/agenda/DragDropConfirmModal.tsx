'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source {
  asignatura: string
  fecha: string
  tema: string
}

interface Dest {
  asignatura: string
  fecha: string
  hasPlan: boolean
  tema?: string
}

export type DropMode =
  | { action: 'copiar' }
  | { action: 'mover' }
  | { action: 'fusionar'; deleteSource: boolean }
  | { action: 'reemplazar'; deleteSource: boolean }

interface Props {
  source: Source
  dest: Dest
  onConfirm: (mode: DropMode) => Promise<{ error?: string }>
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtFecha(fechaStr: string): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${y}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DragDropConfirmModal({ source, dest, onConfirm, onClose }: Props) {
  // Modo seleccionado cuando dest está vacío: 'copiar' | 'mover'
  const [modoVacio, setModoVacio] = useState<'copiar' | 'mover'>('mover')
  // Modo seleccionado cuando dest tiene plan: 'fusionar' | 'reemplazar'
  const [modoPlan, setModoPlan] = useState<'fusionar' | 'reemplazar'>('fusionar')
  // Toggle "Eliminar plan original" (aplica solo cuando dest tiene plan)
  const [deleteSource, setDeleteSource] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    let mode: DropMode
    if (!dest.hasPlan) {
      mode = modoVacio === 'copiar' ? { action: 'copiar' } : { action: 'mover' }
    } else {
      mode = modoPlan === 'fusionar'
        ? { action: 'fusionar', deleteSource }
        : { action: 'reemplazar', deleteSource }
    }

    const result = await onConfirm(mode)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white text-base">Mover planificación</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tarjetas origen / destino */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Origen */}
          <div className="rounded-xl border border-blue-500/50 bg-blue-600/10 p-3">
            <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1.5">Origen</p>
            <p className="text-sm font-medium text-white leading-tight truncate">{source.asignatura}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(source.fecha)}</p>
            {source.tema && (
              <p className="text-[11px] text-gray-500 mt-1 leading-tight line-clamp-2">{source.tema}</p>
            )}
          </div>

          {/* Destino */}
          <div className={`rounded-xl border p-3 ${
            dest.hasPlan
              ? 'border-amber-500/50 bg-amber-600/10'
              : 'border-gray-600/40 bg-gray-800/30'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${
              dest.hasPlan ? 'text-amber-400' : 'text-gray-500'
            }`}>
              {dest.hasPlan ? 'Destino · tiene plan' : 'Destino · vacío'}
            </p>
            <p className="text-sm font-medium text-white leading-tight truncate">{dest.asignatura}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(dest.fecha)}</p>
            {dest.tema && (
              <p className="text-[11px] text-gray-500 mt-1 leading-tight line-clamp-2">{dest.tema}</p>
            )}
          </div>
        </div>

        {/* Opciones */}
        {!dest.hasPlan ? (
          /* Destino vacío: Copiar / Mover */
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={() => setModoVacio('copiar')}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                modoVacio === 'copiar'
                  ? 'border-blue-500/70 bg-blue-600/15 text-blue-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              <p className="font-semibold text-sm">Copiar</p>
              <p className="text-[11px] mt-0.5 opacity-70">Mantiene el plan original</p>
            </button>
            <button
              onClick={() => setModoVacio('mover')}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                modoVacio === 'mover'
                  ? 'border-blue-500/70 bg-blue-600/15 text-blue-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              <p className="font-semibold text-sm">Mover</p>
              <p className="text-[11px] mt-0.5 opacity-70">Elimina el plan original</p>
            </button>
          </div>
        ) : (
          /* Destino con plan: Fusionar / Reemplazar + toggle Eliminar original */
          <div className="mb-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModoPlan('fusionar')}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  modoPlan === 'fusionar'
                    ? 'border-blue-500/70 bg-blue-600/15 text-blue-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="font-semibold text-sm">Fusionar</p>
                <p className="text-[11px] mt-0.5 opacity-70">Combina actividades</p>
              </button>
              <button
                onClick={() => setModoPlan('reemplazar')}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  modoPlan === 'reemplazar'
                    ? 'border-blue-500/70 bg-blue-600/15 text-blue-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="font-semibold text-sm">Reemplazar</p>
                <p className="text-[11px] mt-0.5 opacity-70">Destino queda con el plan del origen</p>
              </button>
            </div>

            {/* Toggle: Eliminar plan original */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/60 cursor-pointer select-none">
              <span className="text-sm text-gray-300">Eliminar plan original</span>
              <div
                onClick={() => setDeleteSource(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  deleteSource ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  deleteSource ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </label>

            {/* Aviso ámbar cuando deleteSource activo */}
            {deleteSource && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-400 text-[11px]">
                <span className="mt-0.5">⚠</span>
                <span>El plan de origen será eliminado permanentemente (solo si no está marcado como cumplido).</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
