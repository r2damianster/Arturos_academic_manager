'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarPlanificacion } from '@/lib/actions/bitacora'
import type { ActividadPlanificada } from '@/types/domain'

interface PlanificarModalProps {
  cursoId: string
  asignatura: string
  fecha: string          // YYYY-MM-DD
  horaInicio: string
  horaFin: string
  onClose: () => void
  onSaved: () => void
}

interface BitacoraExistente {
  id: string
  tema: string
  actividades_json: ActividadPlanificada[] | null
  observaciones: string | null
  estado: string | null
}

function emptyActividad(): ActividadPlanificada {
  return { actividad: '', recurso: '' }
}

function fmtFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[Number(m) - 1]} ${y}`
}

export function PlanificarModal({
  cursoId, asignatura, fecha, horaInicio, horaFin, onClose, onSaved
}: PlanificarModalProps) {
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [existing, setExisting] = useState<BitacoraExistente | null>(null)

  const [tema,         setTema]         = useState('')
  const [actividades,  setActividades]  = useState<ActividadPlanificada[]>([emptyActividad()])
  const [observaciones, setObservaciones] = useState('')

  // Fetch bitácora existente para este curso+fecha
  const fetchExisting = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('bitacora_clase')
      .select('id, tema, actividades_json, observaciones, estado')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setExisting(data)
      setTema(data.tema ?? '')
      setActividades(
        Array.isArray(data.actividades_json) && data.actividades_json.length > 0
          ? data.actividades_json
          : [emptyActividad()]
      )
      setObservaciones(data.observaciones ?? '')
    }
    setLoading(false)
  }, [cursoId, fecha, supabase])

  useEffect(() => { fetchExisting() }, [fetchExisting])

  function addActividad() {
    setActividades(prev => [...prev, emptyActividad()])
  }

  function removeActividad(i: number) {
    setActividades(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateActividad(i: number, field: keyof ActividadPlanificada, value: string) {
    setActividades(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tema.trim()) { setError('El tema es obligatorio'); return }

    const actividadesFiltradas = actividades.filter(a => a.actividad.trim())
    setSaving(true)
    setError(null)

    const result = await guardarPlanificacion(cursoId, fecha, {
      tema: tema.trim(),
      actividades_json: actividadesFiltradas,
      observaciones: observaciones.trim() || null,
    })

    setSaving(false)
    if (result.error) { setError(result.error); return }
    onSaved()
  }

  const fmt = (t: string) => t?.slice(0, 5) ?? ''

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                {existing?.estado === 'cumplido' ? '✓ Cumplido' : existing ? '📋 Planificado' : '📋 Nueva planificación'}
              </span>
            </div>
            <h3 className="font-semibold text-white text-base">{asignatura}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtFecha(fecha)} · {fmt(horaInicio)}–{fmt(horaFin)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none mt-0.5">✕</button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Tema */}
              <div>
                <label className="label">Tema de la clase *</label>
                <input
                  type="text"
                  value={tema}
                  onChange={e => setTema(e.target.value)}
                  className="input"
                  placeholder="Ej: Introducción a las derivadas parciales"
                  autoFocus
                />
              </div>

              {/* Actividades */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Actividades y recursos</label>
                  <button type="button" onClick={addActividad}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <span className="text-base leading-none">+</span> Agregar fila
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Header de columnas */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Actividad</span>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Recurso</span>
                    <span className="w-6" />
                  </div>

                  {actividades.map((act, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={act.actividad}
                        onChange={e => updateActividad(i, 'actividad', e.target.value)}
                        className="input text-sm py-1.5"
                        placeholder="Ej: Exposición grupal"
                      />
                      <input
                        type="text"
                        value={act.recurso}
                        onChange={e => updateActividad(i, 'recurso', e.target.value)}
                        className="input text-sm py-1.5"
                        placeholder="Ej: Presentación PPT"
                      />
                      <button type="button" onClick={() => removeActividad(i)}
                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors rounded"
                        disabled={actividades.length === 1}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="label">Observaciones (opcional)</label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="Notas adicionales para esta clase..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : existing ? 'Actualizar planificación' : 'Guardar planificación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
