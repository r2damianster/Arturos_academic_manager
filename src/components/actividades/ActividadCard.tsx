'use client'

import { useState, useTransition } from 'react'
import { marcarCumplida, desmarcarCumplida, archivarActividad, eliminarActividad, marcarEnProgreso } from '@/lib/actions/actividades'
import type { Database } from '@/types/database.types'
import { Check, Pencil, Archive, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { clsx } from 'clsx'

type ActividadRow = Database['public']['Tables']['actividades_inbox']['Row']
type ActividadConCurso = ActividadRow & { cursos: { asignatura: string } | null }

const TIPO_CONFIG = {
  idea: { label: '💡 Idea', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  tarea: { label: '✅ Tarea', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  recordatorio: { label: '🔔 Recordatorio', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
}

const PRIORIDAD_CONFIG = {
  alta: { label: 'Alta', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  normal: null,
  baja: { label: 'Baja', cls: 'bg-gray-700 text-gray-500 border-gray-600' },
}

function fmtFecha(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(d)
  venc.setHours(0, 0, 0, 0)
  const diff = Math.round((venc.getTime() - hoy.getTime()) / 86400000)
  if (diff < 0) return { label: `Vencida hace ${Math.abs(diff)}d`, vencida: true }
  if (diff === 0) return { label: 'Hoy', vencida: false }
  if (diff === 1) return { label: 'Mañana', vencida: false }
  return {
    label: d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }),
    vencida: false,
  }
}

type Props = {
  actividad: ActividadConCurso
  onEditar: () => void
  onCambiado: () => void
}

export function ActividadCard({ actividad, onEditar, onCambiado }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState<string | null>(null)

  const cumplida = actividad.estado === 'cumplida'
  const tipo = TIPO_CONFIG[actividad.tipo]
  const prio = PRIORIDAD_CONFIG[actividad.prioridad ?? 'normal']

  async function handle(action: string, fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setLoading(action)
    await fn()
    setLoading(null)
    startTransition(() => onCambiado())
  }

  return (
    <div className={clsx(
      'card p-4 border transition-all',
      cumplida ? 'border-gray-800 opacity-70' : 'border-gray-800 hover:border-gray-700',
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox cumplida */}
        <button
          onClick={() => handle('cumplir', () => cumplida ? desmarcarCumplida(actividad.id) : marcarCumplida(actividad.id))}
          disabled={loading !== null}
          className={clsx(
            'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
            cumplida
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-gray-600 hover:border-emerald-500',
          )}
          title={cumplida ? 'Desmarcar' : 'Marcar cumplida'}
        >
          {cumplida && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium', cumplida ? 'text-gray-500 line-through' : 'text-white')}>
              {actividad.titulo}
            </span>

            {/* Badges */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tipo.cls}`}>
              {tipo.label}
            </span>
            {prio && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${prio.cls}`}>
                {prio.label}
              </span>
            )}
            {actividad.cursos && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-700/50 text-gray-400 border-gray-700">
                {actividad.cursos.asignatura}
              </span>
            )}
            {actividad.fecha_vencimiento && (() => {
              const f = fmtFecha(actividad.fecha_vencimiento)
              return (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1',
                  f.vencida
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-gray-700/50 text-gray-400 border-gray-700'
                )}>
                  <Calendar className="w-3 h-3" />
                  {f.label}
                </span>
              )
            })()}
          </div>

          {/* Descripción colapsable */}
          {actividad.descripcion && (
            <div>
              <p className={clsx('text-xs text-gray-500 mt-1', !expanded && 'line-clamp-1')}>
                {actividad.descripcion}
              </p>
              {actividad.descripcion.length > 80 && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-[10px] text-gray-600 hover:text-gray-400 mt-0.5 flex items-center gap-0.5"
                >
                  {expanded ? <><ChevronUp className="w-3 h-3" /> Menos</> : <><ChevronDown className="w-3 h-3" /> Más</>}
                </button>
              )}
            </div>
          )}

          {/* Estado en_progreso badge */}
          {actividad.estado === 'en_progreso' && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              En progreso
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {actividad.estado === 'pendiente' && (
            <button
              onClick={() => handle('progreso', () => marcarEnProgreso(actividad.id))}
              disabled={loading !== null}
              title="Marcar en progreso"
              className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors text-[10px] leading-none border border-transparent hover:border-gray-700"
            >
              ▶
            </button>
          )}

          <button
            onClick={onEditar}
            disabled={loading !== null}
            title="Editar"
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {actividad.estado !== 'archivada' && (
            <button
              onClick={() => handle('archivar', () => archivarActividad(actividad.id))}
              disabled={loading !== null}
              title="Archivar"
              className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-gray-800 rounded transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={loading !== null}
              title="Eliminar"
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <button
                onClick={() => handle('eliminar', () => eliminarActividad(actividad.id))}
                className="text-red-400 hover:text-red-300 font-medium px-1"
              >
                Sí
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-500 hover:text-gray-400 px-1">
                No
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Fecha de cumplimiento */}
      {actividad.fecha_cumplimiento && (
        <p className="text-[10px] text-gray-600 mt-2 ml-8">
          Cumplida el {new Date(actividad.fecha_cumplimiento).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
