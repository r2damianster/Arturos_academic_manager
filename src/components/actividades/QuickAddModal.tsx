'use client'

import { useState, useRef, useEffect } from 'react'
import { crearActividad } from '@/lib/actions/actividades'
import { ColorPicker } from './ColorPicker'
import type { NoteColor } from '@/lib/actions/actividades'
import type { Database } from '@/types/database.types'

type Tipo = Database['public']['Tables']['actividades_inbox']['Row']['tipo']

type Props = {
  cursos: { id: string; asignatura: string }[]
  cursoIdPrefill?: string
  origenPrefill?: string
  onClose: () => void
  onGuardado: () => void
}

const TIPOS: { value: Tipo; emoji: string; label: string }[] = [
  { value: 'nota',         emoji: '📝', label: 'Nota' },
  { value: 'tarea',        emoji: '✅', label: 'Tarea' },
  { value: 'recordatorio', emoji: '🔔', label: 'Recordatorio' },
]

export function QuickAddModal({ cursos, cursoIdPrefill, origenPrefill, onClose, onGuardado }: Props) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<Tipo>('nota')
  const [color, setColor] = useState<NoteColor>(null)
  const [cursoId, setCursoId] = useState(cursoIdPrefill ?? '')
  const [fecha, setFecha] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSave() {
    if (!titulo.trim()) return
    setSaving(true)
    setError('')
    const result = await crearActividad({
      titulo: titulo.trim(),
      tipo,
      color,
      curso_id: cursoId || null,
      fecha_vencimiento: fecha ? new Date(fecha).toISOString() : null,
      origen: origenPrefill ?? 'inbox',
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onGuardado()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Nueva nota</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="Título..."
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input w-full text-base mb-4"
          maxLength={500}
        />

        {/* Tipo chips */}
        <div className="flex gap-2 mb-4">
          {TIPOS.map(t => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                tipo === t.value
                  ? 'border-brand-500/60 bg-brand-600/15 text-brand-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Color */}
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-2">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {/* Opcionales */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {cursos.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Curso</label>
              <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="input w-full text-sm">
                <option value="">Sin curso</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.asignatura}</option>)}
              </select>
            </div>
          )}
          {(tipo === 'tarea' || tipo === 'recordatorio') && (
            <div className={cursos.length === 0 ? 'col-span-2' : ''}>
              <label className="block text-xs text-gray-500 mb-1">
                {tipo === 'recordatorio' ? 'Fecha (requerida)' : 'Fecha límite'}
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input w-full text-sm" />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !titulo.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-700 mt-3">Enter para guardar · Esc para cerrar</p>
      </div>
    </div>
  )
}
