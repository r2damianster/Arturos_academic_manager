'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarPlanificacion, confirmarCumplido } from '@/lib/actions/bitacora'
import { registrarAsistenciaMasiva } from '@/lib/actions/asistencia'
import type { ActividadPlanificada } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EstudianteClase {
  id: string
  nombre: string
  email: string
}

interface BitacoraExistente {
  id: string
  tema: string
  actividades_json: ActividadPlanificada[] | null
  observaciones: string | null
  estado: string | null
}

interface RegistroLocal {
  estudiante_id: string
  nombre: string
  estado: 'Presente' | 'Ausente' | 'Atraso'
  participacion: number | null
  observacion: string
}

interface PasarListaModalProps {
  cursoId: string
  asignatura: string
  fecha: string        // YYYY-MM-DD
  horaInicio: string
  horaFin: string
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyActividad(): ActividadPlanificada { return { actividad: '', recurso: '' } }

function fmtFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[Number(m) - 1]} ${y}`
}

const ESTADO_COLORS = {
  Presente: 'bg-emerald-600/25 border-emerald-500/50 text-emerald-300',
  Ausente:  'bg-red-600/20 border-red-500/40 text-red-300',
  Atraso:   'bg-amber-600/20 border-amber-500/40 text-amber-300',
} as const

// ─── Component ────────────────────────────────────────────────────────────────

export function PasarListaModal({
  cursoId, asignatura, fecha, horaInicio, horaFin, onClose, onSaved
}: PasarListaModalProps) {
  const supabase = createClient()

  const [step,      setStep]      = useState<1 | 2>(1)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Plan state
  const [bitacora,      setBitacora]      = useState<BitacoraExistente | null>(null)
  const [tema,          setTema]          = useState('')
  const [actividades,   setActividades]   = useState<ActividadPlanificada[]>([emptyActividad()])
  const [observaciones, setObservaciones] = useState('')

  // Lista state
  const [estudiantes, setEstudiantes] = useState<EstudianteClase[]>([])
  const [registros,   setRegistros]   = useState<RegistroLocal[]>([])

  const fmt = (t: string) => t?.slice(0, 5) ?? ''

  // ── Fetch inicial ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const [bitacoraRes, estudiantesRes, asistenciaRes] = await Promise.all([
      db.from('bitacora_clase')
        .select('id, tema, actividades_json, observaciones, estado')
        .eq('curso_id', cursoId)
        .eq('fecha', fecha)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from('estudiantes')
        .select('id, nombre, email')
        .eq('curso_id', cursoId)
        .order('nombre'),
      db.from('asistencia')
        .select('estudiante_id, estado, participacion, observacion_part')
        .eq('curso_id', cursoId)
        .eq('fecha', fecha),
    ])

    const bit: BitacoraExistente | null = bitacoraRes.data
    const ests: EstudianteClase[] = estudiantesRes.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asisMap = new Map<string, any>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (asistenciaRes.data ?? []) as any[]) asisMap.set(a.estudiante_id, a)

    if (bit) {
      setBitacora(bit)
      setTema(bit.tema ?? '')
      setActividades(
        Array.isArray(bit.actividades_json) && bit.actividades_json.length > 0
          ? bit.actividades_json
          : [emptyActividad()]
      )
      setObservaciones(bit.observaciones ?? '')
    }

    setEstudiantes(ests)
    setRegistros(ests.map(e => {
      const prev = asisMap.get(e.id)
      return {
        estudiante_id: e.id,
        nombre: e.nombre,
        estado:       prev?.estado       ?? 'Presente',
        participacion: prev?.participacion ?? null,
        observacion:   prev?.observacion_part ?? '',
      }
    }))

    setLoading(false)
  }, [cursoId, fecha, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Plan helpers ───────────────────────────────────────────────────────────
  function addActividad() { setActividades(p => [...p, emptyActividad()]) }
  function removeActividad(i: number) { setActividades(p => p.filter((_, idx) => idx !== i)) }
  function updateActividad(i: number, field: keyof ActividadPlanificada, v: string) {
    setActividades(p => p.map((a, idx) => idx === i ? { ...a, [field]: v } : a))
  }

  // ── Lista helpers ──────────────────────────────────────────────────────────
  function setEstado(id: string, estado: RegistroLocal['estado']) {
    setRegistros(p => p.map(r => r.estudiante_id === id
      ? { ...r, estado, participacion: estado === 'Ausente' ? null : r.participacion }
      : r
    ))
  }

  function toggleTodos(estado: RegistroLocal['estado']) {
    setRegistros(p => p.map(r => ({ ...r, estado })))
  }

  function setParticipacion(id: string, nivel: number | null) {
    setRegistros(p => p.map(r => r.estudiante_id === id ? { ...r, participacion: nivel } : r))
  }

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  async function handleContinuar() {
    if (!tema.trim()) { setError('El tema es obligatorio'); return }
    setError(null)
    setSaving(true)

    const actsFiltradas = actividades.filter(a => a.actividad.trim())
    const result = await guardarPlanificacion(cursoId, fecha, {
      tema: tema.trim(),
      actividades_json: actsFiltradas,
      observaciones: observaciones.trim() || null,
    })

    setSaving(false)
    if (result.error) { setError(result.error); return }

    // Refrescar bitácora con el id
    if (result.id) setBitacora(prev => prev
      ? { ...prev, id: result.id! }
      : { id: result.id!, tema: tema.trim(), actividades_json: actsFiltradas, observaciones: observaciones || null, estado: 'planificado' }
    )
    setStep(2)
  }

  // ── Guardar lista ──────────────────────────────────────────────────────────
  async function handleGuardarLista() {
    setSaving(true)
    setError(null)

    // Marcar bitácora como cumplida
    let bitacoraId = bitacora?.id ?? null
    if (bitacoraId) {
      const actsFiltradas = actividades.filter(a => a.actividad.trim())
      await confirmarCumplido(bitacoraId, {
        tema: tema.trim(),
        actividades_json: actsFiltradas,
        observaciones: observaciones.trim() || null,
      })
    }

    // Registrar asistencia
    const result = await registrarAsistenciaMasiva(
      cursoId,
      fecha,
      registros.map(r => ({
        estudiante_id: r.estudiante_id,
        estado: r.estado,
        atraso: r.estado === 'Atraso',
        horas: r.estado === 'Presente' || r.estado === 'Atraso' ? 1 : 0,
        participacion: r.participacion,
        observacion_part: r.observacion || null,
      })),
      bitacoraId
    )

    setSaving(false)
    if (result.error) { setError(result.error); return }
    onSaved()
  }

  const presentes = registros.filter(r => r.estado === 'Presente').length
  const ausentes  = registros.filter(r => r.estado === 'Ausente').length
  const atrasos   = registros.filter(r => r.estado === 'Atraso').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Steps */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold
                  ${step === 1 ? 'bg-brand-600 text-white' : 'bg-emerald-600/30 text-emerald-400'}`}>
                  {step > 1 ? '✓' : '1'}
                </span>
                <span className={step === 1 ? 'text-white' : 'text-gray-500'}>Planificación</span>
                <span className="text-gray-700 mx-1">→</span>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold
                  ${step === 2 ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                  2
                </span>
                <span className={step === 2 ? 'text-white' : 'text-gray-500'}>Pase de lista</span>
              </div>
            </div>
            <h3 className="font-semibold text-white text-base truncate">{asignatura}</h3>
            <p className="text-xs text-gray-500">
              {fmtFecha(fecha)} · {fmt(horaInicio)}–{fmt(horaFin)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none ml-4">✕</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : step === 1 ? (
          /* ── PASO 1: Planificación ────────────────────────────────── */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {bitacora && (
                <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2
                  ${bitacora.estado === 'cumplido'
                    ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-blue-600/10 border-blue-500/30 text-blue-400'}`}>
                  <span>{bitacora.estado === 'cumplido' ? '✓ Clase ya registrada como cumplida' : '📋 Planificación existente — puedes editarla'}</span>
                </div>
              )}

              <div>
                <label className="label">Tema de la clase *</label>
                <input type="text" value={tema} onChange={e => setTema(e.target.value)}
                  className="input" placeholder="Ej: Introducción a las derivadas parciales" autoFocus />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Actividades y recursos</label>
                  <button type="button" onClick={addActividad}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <span className="text-base leading-none">+</span> Agregar fila
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Actividad</span>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Recurso</span>
                    <span className="w-6" />
                  </div>
                  {actividades.map((act, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={act.actividad}
                        onChange={e => updateActividad(i, 'actividad', e.target.value)}
                        className="input text-sm py-1.5" placeholder="Ej: Exposición grupal" />
                      <input type="text" value={act.recurso}
                        onChange={e => updateActividad(i, 'recurso', e.target.value)}
                        className="input text-sm py-1.5" placeholder="Ej: Presentación PPT" />
                      <button type="button" onClick={() => removeActividad(i)}
                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors rounded"
                        disabled={actividades.length === 1}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Observaciones (opcional)</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  rows={2} className="input resize-none" placeholder="Notas adicionales..." />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
              <button type="button" onClick={handleContinuar} disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? 'Guardando...' : <><span>Continuar al pase de lista</span><span>→</span></>}
              </button>
            </div>
          </div>
        ) : (
          /* ── PASO 2: Pase de lista ────────────────────────────────── */
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Resumen plan (collapsed) */}
            {tema && (
              <div className="px-5 pt-3 pb-2 border-b border-gray-800/60 flex-shrink-0">
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <div className="min-w-0">
                    <span className="text-gray-300 font-medium">{tema}</span>
                    {actividades.filter(a => a.actividad).length > 0 && (
                      <span className="text-gray-600 ml-1.5">
                        · {actividades.filter(a => a.actividad).map(a => a.actividad).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800/60 flex-shrink-0 flex-wrap">
              <span className="text-xs text-gray-500">{estudiantes.length} estudiantes</span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-emerald-400 font-medium">{presentes} presentes</span>
                <span className="text-xs text-red-400">{ausentes} ausentes</span>
                {atrasos > 0 && <span className="text-xs text-amber-400">{atrasos} atrasos</span>}
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] text-gray-600">Marcar todos:</span>
                {(['Presente','Ausente','Atraso'] as const).map(est => (
                  <button key={est} type="button" onClick={() => toggleTodos(est)}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${ESTADO_COLORS[est]}`}>
                    {est}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de estudiantes */}
            <div className="flex-1 overflow-y-auto">
              {registros.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-gray-600 text-sm">
                  <p>No hay estudiantes en este curso</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {registros.map((r, i) => (
                    <div key={r.estudiante_id} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {/* Número */}
                        <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{i + 1}</span>

                        {/* Nombre */}
                        <span className="flex-1 text-sm text-gray-200 truncate min-w-0">{r.nombre}</span>

                        {/* Estado buttons */}
                        <div className="flex gap-1 flex-shrink-0">
                          {(['Presente','Ausente','Atraso'] as const).map(est => (
                            <button key={est} type="button"
                              onClick={() => setEstado(r.estudiante_id, est)}
                              className={`text-[11px] px-2 py-1 rounded border transition-colors font-medium
                                ${r.estado === est
                                  ? ESTADO_COLORS[est]
                                  : 'bg-gray-800/50 border-gray-700/50 text-gray-600 hover:border-gray-600'}`}>
                              {est === 'Presente' ? 'P' : est === 'Ausente' ? 'A' : 'At'}
                            </button>
                          ))}
                        </div>

                        {/* Participación */}
                        <div className="flex gap-0.5 flex-shrink-0">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button"
                              onClick={() => setParticipacion(r.estudiante_id, r.participacion === n ? null : n)}
                              disabled={r.estado === 'Ausente'}
                              className={`w-5 h-5 rounded text-[10px] font-bold transition-colors
                                ${r.participacion === n
                                  ? 'bg-brand-600 text-white'
                                  : r.estado === 'Ausente'
                                  ? 'bg-gray-800/30 text-gray-700 cursor-not-allowed'
                                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mx-5 mb-2">
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost">← Volver</button>
              <button type="button" onClick={handleGuardarLista} disabled={saving || registros.length === 0}
                className="btn-primary flex-1">
                {saving ? 'Guardando...' : `Guardar lista (${registros.length} estudiantes)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
