'use client'

import { useState } from 'react'
import { suspenderClases } from '@/lib/actions/bitacora'

interface CursoSimple {
  id: string
  asignatura: string
}

interface Props {
  cursos: CursoSimple[]
  fechaInicioDefault: string
  fechaFinDefault: string
  onClose: () => void
  onSaved: () => void
}

const RAZONES_PRESET = [
  'Feriado nacional',
  'Suspensión institucional',
  'Paro / huelga',
  'Suspensión de actividades académicas',
]

export function SuspenderClasesModal({ cursos, fechaInicioDefault, fechaFinDefault, onClose, onSaved }: Props) {
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault)
  const [fechaFin, setFechaFin] = useState(fechaFinDefault)
  const [cursoIds, setCursoIds] = useState<Set<string>>(new Set(cursos.map(c => c.id)))
  const [razon, setRazon] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<number | null>(null)

  function toggleCurso(id: string) {
    setCursoIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    setCursoIds(prev => prev.size === cursos.length ? new Set() : new Set(cursos.map(c => c.id)))
  }

  async function handleSubmit() {
    if (cursoIds.size === 0) { setError('Selecciona al menos una asignatura'); return }
    if (fechaFin < fechaInicio) { setError('La fecha final debe ser posterior a la inicial'); return }

    setSaving(true)
    setError(null)
    const result = await suspenderClases({
      cursoIds: Array.from(cursoIds),
      fechaInicio,
      fechaFin,
      razon: razon.trim() || undefined,
    })
    setSaving(false)

    if (result.error) { setError(result.error); return }
    setResultado(result.afectadas ?? 0)
  }

  if (resultado !== null) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
          <p className="text-emerald-400 text-2xl">🚫</p>
          <p className="text-gray-200 text-sm">
            {resultado === 0
              ? 'No había clases planificadas para suspender en ese rango.'
              : `${resultado} ${resultado === 1 ? 'clase suspendida' : 'clases suspendidas'}.`}
          </p>
          <button
            onClick={() => { onSaved(); onClose() }}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">🚫 Suspender clases</h2>
            <p className="text-gray-500 text-xs mt-0.5">Marca como suspendidas las clases planificadas en un rango de fechas.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Cursos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Asignaturas</label>
              <button onClick={toggleTodos} className="text-[10px] text-brand-400 hover:text-brand-300">
                {cursoIds.size === cursos.length ? 'Quitar todas' : 'Seleccionar todas'}
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-800 rounded-lg p-2">
              {cursos.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 px-1 py-1 rounded hover:bg-gray-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cursoIds.has(c.id)}
                    onChange={() => toggleCurso(c.id)}
                    className="accent-brand-500 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-300">{c.asignatura}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Razón */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">Motivo (opcional)</label>
            <div className="flex gap-1.5 flex-wrap mb-1.5">
              {RAZONES_PRESET.map(r => (
                <button
                  key={r}
                  onClick={() => setRazon(r)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    razon === r ? 'bg-brand-900/40 border-brand-600 text-brand-300' : 'border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={razon}
              onChange={e => setRazon(e.target.value)}
              placeholder="Ej: Feriado nacional"
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-600"
            />
          </div>

          <p className="text-[11px] text-gray-500">
            Las clases ya marcadas como <span className="text-emerald-400">Cumplido</span> no serán afectadas.
            Puedes reactivar una clase suspendida en cualquier momento desde la celda correspondiente.
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Suspendiendo…' : 'Suspender clases'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
