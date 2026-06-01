'use client'

import { useState, useTransition } from 'react'
import { registrarSesionTutorado } from '@/lib/actions/tutorados'

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial', emoji: '🏫' },
  { value: 'virtual',    label: 'Virtual',    emoji: '💻' },
  { value: 'whatsapp',   label: 'WhatsApp',   emoji: '💬' },
  { value: 'telefono',   label: 'Teléfono',   emoji: '📞' },
  { value: 'otro',       label: 'Otro',       emoji: '📝' },
]

interface Props {
  estudianteId: string
  cursoId: string
  estudianteNombre: string
  onClose: () => void
}

export function RegistrarSesionModal({ estudianteId, cursoId, estudianteNombre, onClose }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [modalidad, setModalidad] = useState('presencial')

  const today = new Date().toISOString().split('T')[0]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('modalidad', modalidad)
    startTransition(async () => {
      const res = await registrarSesionTutorado(estudianteId, cursoId, fd)
      if (res.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Registrar sesión</h2>
            <p className="text-gray-400 text-sm">{estudianteNombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha *</label>
              <input name="fecha" type="date" className="input" defaultValue={today} required />
            </div>
            <div>
              <label className="label">Duración (min)</label>
              <input name="duracion_minutos" type="number" className="input" min={5} max={480} placeholder="60" />
            </div>
          </div>

          <div>
            <label className="label">Modalidad *</label>
            <div className="flex gap-2 flex-wrap">
              {MODALIDADES.map(m => (
                <button key={m.value} type="button"
                  onClick={() => setModalidad(m.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    modalidad === m.value
                      ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  <span>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Esta sesión — lo trabajado</label>
            <textarea name="lo_realizado" className="input" rows={3}
              placeholder="Revisamos el capítulo 2, ajustamos el marco teórico, discutimos la metodología…" />
          </div>

          <div>
            <label className="label">Para la próxima sesión</label>
            <textarea name="proximo_paso" className="input" rows={2}
              placeholder="Presentar primer borrador de resultados, revisar bibliografía APA…" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="flex-1 btn-primary">
              {pending ? 'Guardando…' : 'Registrar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
