'use client'

import { useState } from 'react'
import { eliminarActividad, togglePin } from '@/lib/actions/actividades'
import { getCardStyle } from './ColorPicker'
import type { ActividadConCurso } from '@/lib/actions/actividades'
import { Pin, X } from 'lucide-react'
import { clsx } from 'clsx'

const TIPO_EMOJI: Record<string, string> = {
  nota: '📝',
  tarea: '✅',
  recordatorio: '🔔',
}

type Props = {
  actividad: ActividadConCurso
  onClick: () => void
  onCambiado: () => void
}

export function MiniNotaCard({ actividad, onClick, onCambiado }: Props) {
  const [loading, setLoading] = useState(false)
  const { border } = getCardStyle(actividad.color)

  // checklist progress
  const items = actividad.checklist_items ?? []
  const done = items.filter(i => i.done).length

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    setLoading(true)
    await togglePin(actividad.id, actividad.pinned)
    setLoading(false)
    onCambiado()
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setLoading(true)
    await eliminarActividad(actividad.id)
    setLoading(false)
    onCambiado()
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group flex items-start gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all',
        'hover:bg-white/5',
        actividad.color ? border : 'border-gray-800 hover:border-gray-700',
        loading && 'opacity-50 pointer-events-none',
        actividad.completada && 'opacity-50',
      )}
    >
      {/* Tipo emoji */}
      <span className="flex-shrink-0 text-sm mt-0.5">{TIPO_EMOJI[actividad.tipo]}</span>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-sm font-medium truncate leading-snug',
          actividad.completada ? 'text-gray-500 line-through' : 'text-gray-200',
        )}>
          {actividad.titulo}
        </p>

        {/* Preview */}
        {actividad.tipo === 'tarea' && items.length > 0 ? (
          <p className="text-[10px] text-gray-600 mt-0.5">{done}/{items.length} completados</p>
        ) : actividad.descripcion ? (
          <p className="text-[10px] text-gray-600 mt-0.5 truncate">{actividad.descripcion}</p>
        ) : null}
      </div>

      {/* Acciones — visible en hover */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handlePin}
          title={actividad.pinned ? 'Desfijar' : 'Fijar'}
          className={clsx(
            'p-1 rounded-lg transition-colors',
            actividad.pinned ? 'text-amber-400' : 'text-gray-600 hover:text-gray-400',
          )}
        >
          <Pin className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          title="Eliminar"
          className="p-1 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
