'use client'

import { useState } from 'react'
import { actualizarActividad, marcarCumplida, desmarcarCumplida } from '@/lib/actions/actividades'
import type { Database } from '@/types/database.types'

type ActividadRow = Database['public']['Tables']['actividades_inbox']['Row']
type ActividadConCurso = ActividadRow & { cursos: { asignatura: string } | null }
type Tipo = ActividadRow['tipo']
type Prioridad = ActividadRow['prioridad']

type Props = {
  actividad: ActividadConCurso
  cursos: { id: string; asignatura: string }[]
  onClose: () => void
  onGuardado: () => void
}

const TIPOS: { value: Tipo; emoji: string; label: string }[] = [
  { value: 'tarea', emoji: '✅', label: 'Tarea' },
  { value: 'idea', emoji: '💡', label: 'Idea' },
  { value: 'recordatorio', emoji: '🔔', label: 'Recordatorio' },
]

const PRIORIDADES: { value: Prioridad; label: string }[] = [
  { value: 'alta', label: '🔴 Alta' },
  { value: 'normal', label: '⚪ Normal' },
  { value: 'baja', label: '⬇ Baja' },
]

function toDateInputValue(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function EditarActividadPanel({ actividad, cursos, onClose, onGuardado }: Props) {
  const [titulo, setTitulo] = useState(actividad.titulo)
  const [descripcion, setDescripcion] = useState(actividad.descripcion ?? '')
  const [tipo, setTipo] = useState<Tipo>(actividad.tipo)
  const [prioridad, setPrioridad] = useState<Prioridad>(actividad.prioridad ?? 'normal')
  const [cursoId, setCursoId] = useState(actividad.curso_id ?? '')
  const [fecha, setFecha] = useState(toDateInputValue(actividad.fecha_vencimiento))
  const [etiquetaInput, setEtiquetaInput] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>(actividad.etiquetas ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addEtiqueta(tag: string) {
    const t = tag.trim().toLowerCase()
    if (t && !etiquetas.includes(t)) setEtiquetas(prev => [...prev, t])
    setEtiquetaInput('')
  }

  async function handleSave() {
    if (!titulo.trim()) return
    setSaving(true)
    setError('')
    const result = await actualizarActividad(actividad.id, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      tipo,
      prioridad,
      curso_id: cursoId || null,
      fecha_vencimiento: fecha ? new Date(fecha).toISOString() : null,
      etiquetas,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onGuardado()
  }

  async function toggleCumplida() {
    setSaving(true)
    if (actividad.estado === 'cumplida') {
      await desmarcarCumplida(actividad.id)
    } else {
      await marcarCumplida(actividad.id)
    }
    setSaving(false)
    onGuardado()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Editar actividad</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCumplida}
              disabled={saving}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                actividad.estado === 'cumplida'
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                  : 'text-gray-400 border-gray-700 hover:border-gray-600'
              }`}
            >
              {actividad.estado === 'cumplida' ? '✓ Cumplida' : 'Marcar cumplida'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="input w-full"
              maxLength={500}
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Descripción / notas</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Detalles, contexto, inspiración..."
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <div className="flex gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                    tipo === t.value
                      ? 'border-brand-500/60 bg-brand-600/15 text-brand-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Prioridad */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
              <select
                value={prioridad ?? 'normal'}
                onChange={e => setPrioridad(e.target.value as Prioridad)}
                className="input w-full text-sm"
              >
                {PRIORIDADES.map(p => (
                  <option key={p.value} value={p.value ?? 'normal'}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha límite</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          </div>

          {/* Curso */}
          {cursos.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Curso vinculado</label>
              <select
                value={cursoId}
                onChange={e => setCursoId(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="">Sin curso</option>
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>{c.asignatura}</option>
                ))}
              </select>
            </div>
          )}

          {/* Etiquetas */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {etiquetas.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                  #{tag}
                  <button
                    onClick={() => setEtiquetas(prev => prev.filter(t => t !== tag))}
                    className="text-gray-500 hover:text-red-400 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Añadir etiqueta + Enter"
              value={etiquetaInput}
              onChange={e => setEtiquetaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEtiqueta(etiquetaInput) }
              }}
              className="input w-full text-sm"
              maxLength={50}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={saving} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !titulo.trim()}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
