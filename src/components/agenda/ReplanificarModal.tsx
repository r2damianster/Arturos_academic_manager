'use client'

import { useState } from 'react'
import { replanificarClase, type ReplanificarResult } from '@/lib/actions/bitacora'

interface ReplanificarModalProps {
  cursoId: string
  asignatura: string
  origenFecha: string      // YYYY-MM-DD
  origenTema: string
  onClose: () => void
  onDone: () => void
}

type Modo = 'merge' | 'shift'

export function ReplanificarModal({
  cursoId, asignatura, origenFecha, origenTema, onClose, onDone
}: ReplanificarModalProps) {
  const [destinoFecha, setDestinoFecha] = useState('')
  const [modo, setModo] = useState<Modo>('shift')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ReplanificarResult | null>(null)
  const [confirming, setConfirming] = useState(false)

  function fmtFecha(fecha: string) {
    const [y, m, d] = fecha.split('-')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
  }

  function getDayName(fecha: string): string {
    const d = new Date(fecha.split('-').map(Number)[0], parseInt(fecha.split('-')[1]) - 1, parseInt(fecha.split('-')[2]))
    const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
    return dias[d.getDay()]
  }

  async function handlePreview() {
    if (!destinoFecha) { setError('Selecciona una fecha destino'); return }
    if (destinoFecha <= origenFecha) { setError('La fecha destino debe ser posterior al origen'); return }

    setLoading(true)
    setError(null)
    setConfirming(false)

    const result = await replanificarClase({
      cursoId,
      origenFecha,
      destinoFecha,
      modo,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
      setPreview(null)
    } else {
      setPreview(result)
      setConfirming(true)
    }
  }

  async function handleConfirm() {
    if (!confirming) return
    setLoading(true)
    setError(null)

    const result = await replanificarClase({
      cursoId,
      origenFecha,
      destinoFecha,
      modo,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    onDone()
  }

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <span className="text-xs bg-amber-600/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
              ↻ Replanificar
            </span>
            <h3 className="font-semibold text-white text-base mt-1">{asignatura}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Origen: {fmtFecha(origenFecha)} ({getDayName(origenFecha)})
            </p>
            {origenTema && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">Tema: {origenTema}</p>
            )}
          </div>
          <button onClick={onClose} disabled={loading}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Fecha destino */}
          <div>
            <label className="label">Fecha destino *</label>
            <input
              type="date"
              value={destinoFecha}
              min={hoy}
              onChange={e => { setDestinoFecha(e.target.value); setPreview(null); setConfirming(false); setError(null) }}
              className="input"
              disabled={loading}
              autoFocus
            />
            {destinoFecha && (
              <p className="text-xs text-gray-500 mt-1">
                {fmtFecha(destinoFecha)} ({getDayName(destinoFecha)})
              </p>
            )}
          </div>

          {/* Modo */}
          <div>
            <label className="label">Modo de replplanificación *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => { setModo('shift'); setPreview(null); setConfirming(false) }}
                disabled={loading}
                className={`p-3 rounded-lg border text-left transition-all ${
                  modo === 'shift'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}>
                <div className="text-sm font-medium">Transferir en cascada</div>
                <div className="text-xs text-gray-500 mt-1">
                  Desplaza todo en cadena hasta encontrar un hueco
                </div>
              </button>
              <button type="button"
                onClick={() => { setModo('merge'); setPreview(null); setConfirming(false) }}
                disabled={loading}
                className={`p-3 rounded-lg border text-left transition-all ${
                  modo === 'merge'
                    ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}>
                <div className="text-sm font-medium">Fusionar</div>
                <div className="text-xs text-gray-500 mt-1">
                  Une actividades en una sola bitácora
                </div>
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview && confirming && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-300">Resumen:</div>
              {preview.modo === 'merge' && (
                <div className="text-xs text-gray-400">
                  <span className="text-teal-400">Fusión:</span> Las actividades de {fmtFecha(origenFecha)}
                  se unirán a las de {fmtFecha(destinoFecha)}. La fecha origen quedará vacía.
                  {preview.mergedOriginId && (
                    <span className="block mt-1 text-gray-500">Se eliminará la bitácora de origen.</span>
                  )}
                </div>
              )}
              {preview.modo === 'shift' && (
                <div className="text-xs text-gray-400">
                  <span className="text-blue-400">Cascada:</span> La clase se moverá a {fmtFecha(destinoFecha)}.
                  {preview.shiftedIds && preview.shiftedIds.length > 0 && (
                    <span className="block mt-1">
                      {preview.shiftedIds.length} clase(s) serán desplazadas a su siguiente slot disponible.
                    </span>
                  )}
                  {(!preview.shiftedIds || preview.shiftedIds.length === 0) && (
                    <span className="block mt-1 text-gray-500">
                      El destino estaba libre, no se requiere desplazamiento.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost flex-1">
            Cancelar
          </button>
          {!confirming ? (
            <button
              onClick={handlePreview}
              disabled={loading || !destinoFecha}
              className="btn-primary flex-1">
              {loading ? 'Verificando...' : 'Vista previa'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="btn-primary flex-1 bg-amber-600 hover:bg-amber-500">
              {loading ? 'Procesando...' : 'Confirmar replplanificación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
