'use client'

import { useState, useTransition } from 'react'
import { enviarRegistro, type RegistroTrabajo } from '@/lib/actions/registros-trabajo'

interface Props {
  registro: RegistroTrabajo
  estudianteId: string
  onClose: () => void
  onEnviado: (autoAprobado: boolean) => void
}

export function RegistroModal({ registro, estudianteId, onClose, onEnviado }: Props) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    if (!titulo.trim()) { setError('Escribe un título'); return }
    startTransition(async () => {
      const res = await enviarRegistro(registro.id, estudianteId, titulo.trim(), descripcion.trim())
      if (res.error) { setError(res.error); return }
      onEnviado(res.autoAprobado ?? false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div>
            <span className="text-[10px] bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{registro.tipo}</span>
            <h2 className="font-semibold text-white text-base leading-tight mt-1">{registro.titulo}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 flex-shrink-0 ml-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Instrucciones */}
          {registro.instrucciones && (
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-400 mb-1">Instrucciones</p>
              <p className="text-sm text-gray-300 leading-relaxed">{registro.instrucciones}</p>
            </div>
          )}

          {/* Criterios */}
          {registro.criterios?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Criterios de evaluación</p>
              <ul className="space-y-1">
                {registro.criterios.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-brand-400 flex-shrink-0 mt-0.5">·</span>
                    {c.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Escribe el título de tu trabajo..."
              className="input w-full"
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Descripción <span className="text-gray-600">(opcional)</span>
            </label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Puedes incluir un resumen, enfoque, pregunta de investigación, o cualquier detalle relevante..."
              rows={5}
              className="input w-full resize-none leading-relaxed"
            />
          </div>

          {/* Info validación */}
          {registro.validacion_automatica ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-900 rounded-lg px-3 py-2">
              <span>✓</span>
              <span>Tu registro se aprobará automáticamente al enviar</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
              <span>⏳</span>
              <span>El profesor revisará tu envío antes de aprobarlo</span>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="btn-primary flex-1"
            >
              {pending ? 'Enviando...' : 'Enviar registro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
