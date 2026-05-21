'use client'

import { useState, useTransition } from 'react'
import { togglePin, setColor, toggleArchivada, eliminarActividad, toggleChecklistItem } from '@/lib/actions/actividades'
import { InlineChecklist } from './ChecklistEditor'
import { getCardStyle } from './ColorPicker'
import { ConvertirEventoModal } from './ConvertirEventoModal'
import type { ActividadConCurso, NoteColor } from '@/lib/actions/actividades'
import { Pin, PinOff, Palette, Archive, ArchiveRestore, Trash2, CalendarPlus, Check } from 'lucide-react'
import { clsx } from 'clsx'

const TIPO_EMOJI: Record<string, string> = {
  nota: '',
  tarea: '',
  recordatorio: '🔔',
}


const QUICK_COLORS: { value: NoteColor; dot: string }[] = [
  { value: null,       dot: 'bg-gray-700 border border-gray-500' },
  { value: 'rojo',     dot: 'bg-red-500' },
  { value: 'naranja',  dot: 'bg-orange-500' },
  { value: 'amarillo', dot: 'bg-yellow-400' },
  { value: 'verde',    dot: 'bg-green-500' },
  { value: 'teal',     dot: 'bg-teal-400' },
  { value: 'azul',     dot: 'bg-blue-500' },
  { value: 'morado',   dot: 'bg-purple-500' },
]

type Props = {
  actividad: ActividadConCurso
  onEditar: () => void
  onCambiado: () => void
}

export function ActividadCard({ actividad, onEditar, onCambiado }: Props) {
  const [showColors, setShowColors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [localItems, setLocalItems] = useState(actividad.checklist_items)
  const [, startTransition] = useTransition()

  const { bg, border } = getCardStyle(actividad.color)
  const isDone = actividad.completada

  function refresh() {
    startTransition(() => onCambiado())
  }

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    await togglePin(actividad.id, actividad.pinned)
    refresh()
  }

  async function handleColor(e: React.MouseEvent, color: NoteColor) {
    e.stopPropagation()
    setShowColors(false)
    await setColor(actividad.id, color)
    refresh()
  }

  async function handleArchive(e: React.MouseEvent) {
    e.stopPropagation()
    await toggleArchivada(actividad.id, actividad.archivada)
    refresh()
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    await eliminarActividad(actividad.id)
    refresh()
  }

  async function handleChecklistToggle(itemId: string) {
    // Optimistic update
    setLocalItems(prev => prev.map(i => i.id === itemId ? { ...i, done: !i.done } : i))
    await toggleChecklistItem(actividad.id, itemId)
    refresh()
  }

  return (
    <div
      className={clsx(
        'break-inside-avoid mb-3 rounded-2xl border cursor-pointer transition-all group relative',
        'hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5',
        bg, border,
        isDone && 'opacity-60',
      )}
      onClick={e => {
        if (confirmDelete || showColors || showConvertModal) return
        onEditar()
      }}
    >
      {/* Pin button — siempre visible si pinned, hover si no */}
      <button
        onClick={handlePin}
        className={clsx(
          'absolute top-2 right-2 p-1.5 rounded-lg transition-all z-10',
          actividad.pinned
            ? 'text-amber-400 opacity-100'
            : 'text-gray-600 opacity-0 group-hover:opacity-100 hover:text-gray-300 hover:bg-black/20',
        )}
        title={actividad.pinned ? 'Quitar destaque' : 'Destacar'}
      >
        {actividad.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
      </button>

      {/* Contenido */}
      <div className="p-4 pr-9">
        {/* Título */}
        <p className={clsx(
          'font-medium text-sm leading-snug mb-1',
          isDone ? 'text-gray-500 line-through' : 'text-white',
        )}>
          {TIPO_EMOJI[actividad.tipo] && <span className="mr-1">{TIPO_EMOJI[actividad.tipo]}</span>}
          {actividad.titulo}
        </p>

        {/* Descripción */}
        {actividad.descripcion && actividad.tipo !== 'tarea' && (
          <p className="text-xs text-gray-400 leading-relaxed mb-2 line-clamp-6 whitespace-pre-wrap">
            {actividad.descripcion}
          </p>
        )}

        {/* Checklist inline */}
        {actividad.tipo === 'tarea' && localItems.length > 0 && (
          <div className="mb-2">
            <InlineChecklist items={localItems} onToggle={handleChecklistToggle} />
          </div>
        )}

        {/* Descripción extra para tarea */}
        {actividad.tipo === 'tarea' && actividad.descripcion && localItems.length === 0 && (
          <p className="text-xs text-gray-400 leading-relaxed mb-2 line-clamp-4">{actividad.descripcion}</p>
        )}

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {actividad.cursos && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-gray-400">
              {actividad.cursos.asignatura}
            </span>
          )}
          {actividad.etiquetas?.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-gray-400">
              #{tag}
            </span>
          ))}
          {actividad.conversion_destino === 'evento' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-900/40 text-brand-400 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" />
              Programado
            </span>
          )}
        </div>
      </div>

      {/* Barra de acciones — visible en hover */}
      <div className={clsx(
        'border-t border-white/5 px-3 py-1.5 flex items-center gap-1',
        'opacity-0 group-hover:opacity-100 transition-opacity',
      )}>
        {/* Color picker toggle */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowColors(v => !v) }}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-black/20 rounded-lg transition-colors"
            title="Color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          {showColors && (
            <div
              className="absolute bottom-8 left-0 bg-gray-800 border border-gray-700 rounded-xl p-2 flex gap-1.5 z-20 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {QUICK_COLORS.map(c => (
                <button
                  key={c.value ?? 'default'}
                  title={c.value ?? 'Default'}
                  onClick={e => handleColor(e, c.value)}
                  className={clsx(
                    'w-5 h-5 rounded-full transition-transform hover:scale-110',
                    c.dot,
                    actividad.color === c.value && 'ring-2 ring-white ring-offset-1 ring-offset-gray-800',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Programar como evento — solo para tarea/recordatorio */}
        {(actividad.tipo === 'tarea' || actividad.tipo === 'recordatorio') && (
          actividad.conversion_destino === 'evento' ? (
            <span className="p-1.5 text-brand-500" title="Ya programado como evento">
              <CalendarPlus className="w-3.5 h-3.5" />
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setShowConvertModal(true) }}
              className="p-1.5 rounded-lg transition-colors text-gray-500 hover:text-brand-400 hover:bg-black/20"
              title="Programar en agenda"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
            </button>
          )
        )}

        {/* Archivar / Restaurar */}
        <button
          onClick={handleArchive}
          className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-black/20 rounded-lg transition-colors"
          title={actividad.archivada ? 'Restaurar' : 'Archivar'}
        >
          {actividad.archivada
            ? <ArchiveRestore className="w-3.5 h-3.5" />
            : <Archive className="w-3.5 h-3.5" />
          }
        </button>

        {/* Eliminar */}
        {!confirmDelete ? (
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-black/20 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs ml-1" onClick={e => e.stopPropagation()}>
            <button onClick={handleDelete} className="text-red-400 hover:text-red-300 font-medium px-1">Sí</button>
            <button onClick={() => setConfirmDelete(false)} className="text-gray-500 hover:text-gray-400 px-1">No</button>
          </span>
        )}
      </div>

      {showConvertModal && (
        <ConvertirEventoModal
          actividad={actividad}
          onClose={() => setShowConvertModal(false)}
          onConvertido={() => { setShowConvertModal(false); refresh() }}
        />
      )}
    </div>
  )
}
