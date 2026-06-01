'use client'

import { useState, useTransition } from 'react'
import { eliminarSesion, type SesionItem } from '@/lib/actions/tutorados'

const MODAL_EMOJI: Record<string, string> = {
  presencial: '🏫',
  virtual:    '💻',
  whatsapp:   '💬',
  telefono:   '📞',
  otro:       '📝',
}

const MODAL_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  virtual:    'Virtual',
  whatsapp:   'WhatsApp',
  telefono:   'Teléfono',
  otro:       'Otro',
}

function formatFecha(fecha: string) {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-EC', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return fecha }
}

interface Props {
  sesiones: SesionItem[]
  cursoId: string
  estudianteId: string
}

export function SesionesTimeline({ sesiones, cursoId }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleEliminar(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    setDeletingId(id)
    startTransition(async () => {
      await eliminarSesion(id, cursoId)
      setDeletingId(null)
    })
  }

  if (sesiones.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 text-sm">
        Sin sesiones registradas todavía.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sesiones.map(s => (
        <div key={s.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{MODAL_EMOJI[s.modalidad] ?? '📝'}</span>
              <span className="text-white text-sm font-medium">{formatFecha(s.fecha)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                {MODAL_LABEL[s.modalidad] ?? s.modalidad}
              </span>
              {s.duracion_minutos && (
                <span className="text-xs text-gray-500">{s.duracion_minutos} min</span>
              )}
            </div>
            <button
              onClick={() => handleEliminar(s.id)}
              disabled={pending && deletingId === s.id}
              className="text-gray-600 hover:text-red-400 transition-colors text-xs p-1">
              🗑
            </button>
          </div>

          {s.lo_realizado && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Esta sesión</p>
              <p className="text-sm text-gray-300">{s.lo_realizado}</p>
            </div>
          )}

          {s.proximo_paso && (
            <div className="bg-brand-600/10 border border-brand-600/20 rounded-md px-3 py-2">
              <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">Para la próxima sesión</p>
              <p className="text-sm text-brand-300">{s.proximo_paso}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
