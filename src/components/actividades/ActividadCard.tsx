'use client'

import { useState, useTransition } from 'react'
import { togglePin, setColor, toggleArchivada, eliminarActividad, toggleChecklistItem, convertirAEvento } from '@/lib/actions/actividades'
import { InlineChecklist } from './ChecklistEditor'
import { getCardStyle } from './ColorPicker'
import type { ActividadConCurso, NoteColor } from '@/lib/actions/actividades'
import { Pin, PinOff, Palette, Archive, ArchiveRestore, Trash2, Calendar, CalendarPlus, Check } from 'lucide-react'
import { clsx } from 'clsx'

const TIPO_EMOJI: Record<string, string> = {
  nota: '',
  tarea: '',
  recordatorio: '🔔',
}

function fmtFecha(iso: string) {
  const d = new Date(iso)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const venc = new Date(d); venc.setHours(0, 0, 0, 0)
  const diff = Math.round((venc.getTime() - hoy.getTime()) / 86400000)
  if (diff < 0) return { label: `Vencida hace ${Math.abs(diff)}d`, vencida: true }
  if (diff === 0) return { label: 'Hoy', vencida: false }
  if (diff === 1) return { label: 'Mañana', vencida: false }
  return { label: d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }), vencida: false }
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
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedFecha, setSchedFecha] = useState('')
  const [schedHoraInicio, setSchedHoraInicio] = useState('')
  const [schedHoraFin, setSchedHoraFin] = useState('')
  const [schedLoading, setSchedLoading] = useState(false)
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

  async function handleConvertirEvento(e: React.MouseEvent) {
    e.stopPropagation()
    if (!schedFecha) return
    setSchedLoading(true)
    await convertirAEvento(actividad.id, {
      fecha: schedFecha,
      horaInicio: schedHoraInicio || undefined,
      horaFin: schedHoraFin || undefined,
    })
    setSchedLoading(false)
    setShowSchedule(false)
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
        if (confirmDelete || showColors) return
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
          {actividad.fecha_vencimiento && (() => {
            const f = fmtFecha(actividad.fecha_vencimiento)
            return (
              <span className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5',
                f.vencida ? 'bg-red-900/40 text-red-400' : 'bg-black/20 text-gray-400',
              )}>
                <Calendar className="w-2.5 h-2.5" />
                {f.label}
              </span>
            )
          })()}
          {actividad.conversion_destino === 'evento' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-900/40 text-brand-400 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" />
              Programado
            </span>
          )}
        </div>
      </div>

      {/* Formulario inline para programar como evento */}
      {showSchedule && (
        <div
          className="border-t border-white/5 px-3 py-2 space-y-1.5"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] text-gray-400 font-medium">Programar en agenda</p>
          <input
            type="date"
            value={schedFecha}
            onChange={e => setSchedFecha(e.target.value)}
            className="input w-full text-xs py-1"
          />
          <div className="flex gap-1.5">
            <input
              type="time"
              placeholder="Inicio"
              value={schedHoraInicio}
              onChange={e => setSchedHoraInicio(e.target.value)}
              className="input flex-1 text-xs py-1"
            />
            <input
              type="time"
              placeholder="Fin"
              value={schedHoraFin}
              onChange={e => setSchedHoraFin(e.target.value)}
              className="input flex-1 text-xs py-1"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleConvertirEvento}
              disabled={!schedFecha || schedLoading}
              className="flex-1 btn-primary text-xs py-1 disabled:opacity-40"
            >
              {schedLoading ? 'Guardando...' : '→ Agregar al calendario'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setShowSchedule(false) }}
              className="px-2 text-xs text-gray-500 hover:text-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
              onClick={e => { e.stopPropagation(); setShowSchedule(v => !v) }}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                showSchedule ? 'text-brand-400 bg-brand-900/30' : 'text-gray-500 hover:text-brand-400 hover:bg-black/20',
              )}
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
    </div>
  )
}
