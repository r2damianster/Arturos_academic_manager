'use client'

import { useState, useTransition } from 'react'
import { finalizarTutorado } from '@/lib/actions/tutorados'

const RESULTADOS = [
  { value: 'graduado',  label: 'Publicado',    color: 'text-emerald-300' },
  { value: 'aprobado',  label: 'Aprobado sin publicación', color: 'text-sky-300' },
  { value: 'abandono',  label: 'Abandonó',    color: 'text-red-300' },
  { value: 'otro',      label: 'Otro',        color: 'text-gray-300' },
]

interface Props {
  estudianteId: string
  cursoId: string
  estudianteNombre: string
  onClose: () => void
}

export function FinalizarTutoradoModal({ estudianteId, cursoId, estudianteNombre, onClose }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('graduado')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('resultado', resultado)
    startTransition(async () => {
      const res = await finalizarTutorado(estudianteId, cursoId, fd)
      if (res.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4 p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Finalizar tutorado</h2>
            <p className="text-gray-400 text-sm">{estudianteNombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <p className="text-gray-400 text-sm">
          El tutorado pasará al Historial y dejará de aparecer en tu horario.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Resultado *</label>
            <div className="flex gap-2 flex-wrap">
              {RESULTADOS.map(r => (
                <button key={r.value} type="button"
                  onClick={() => setResultado(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    resultado === r.value
                      ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Nota de cierre (opcional)</label>
            <textarea name="nota_final" className="input" rows={3}
              placeholder="Defensa aprobada con distinción, publicación enviada a revista indexada…" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-700/30 border border-emerald-600/50 text-emerald-300 hover:bg-emerald-700/50 text-sm transition-colors disabled:opacity-50">
              {pending ? 'Guardando…' : '✓ Finalizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
