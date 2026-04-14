'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarPlanificacion, copiarPlanificacion, moverPlanificacion } from '@/lib/actions/bitacora'
import type { ActividadPlanificada } from '@/types/domain'

interface ClaseParaCopiar {
  id: string
  dia_semana: string
  tipo: string
  cursos: { id: string; asignatura: string } | null
}

interface PlanificarModalProps {
  cursoId: string
  asignatura: string
  fecha: string          // YYYY-MM-DD
  horaInicio: string
  horaFin: string
  centroComputo?: boolean
  onClose: () => void
  onSaved: () => void
  clases?: ClaseParaCopiar[]
}

interface BitacoraExistente {
  id: string
  tema: string
  actividades_json: ActividadPlanificada[] | null
  observaciones: string | null
  estado: string | null
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

const DIA_TO_DOW: Record<string, number> = {
  lunes: 1, martes: 2, 'miércoles': 3, jueves: 4, viernes: 5, 'sábado': 6,
}

const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "lun, 14 abr 2026" */
function fmtFechaOpt(s: string): string {
  const d = parseDateStr(s)
  return `${DIAS_CORTO[d.getDay()]}, ${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`
}

/** Short display: "14 abr 2026" */
function fmtFecha(s: string) {
  const [y, m, d] = s.split('-')
  return `${d} ${MESES_CORTO[Number(m) - 1]} ${y}`
}

/**
 * Generate the next `n` dates (starting the day after `desde`) whose day-of-week
 * is in `dowSet`. Returns YYYY-MM-DD strings.
 */
function generarFechasValidas(dowSet: Set<number>, desde: string, n = 14): string[] {
  const fechas: string[] = []
  const d = parseDateStr(desde)
  d.setDate(d.getDate() + 1)
  let iter = 0
  while (fechas.length < n && iter < 365) {
    if (dowSet.has(d.getDay())) fechas.push(dateToStr(d))
    d.setDate(d.getDate() + 1)
    iter++
  }
  return fechas
}

// ─── Component ─────────────────────────────────────────────────────────────────

function emptyActividad(): ActividadPlanificada {
  return { actividad: '', recurso: '' }
}

export function PlanificarModal({
  cursoId, asignatura, fecha, horaInicio, horaFin, centroComputo, onClose, onSaved, clases = []
}: PlanificarModalProps) {
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [existing, setExisting] = useState<BitacoraExistente | null>(null)

  const [tema,          setTema]          = useState('')
  const [actividades,   setActividades]   = useState<ActividadPlanificada[]>([emptyActividad()])
  const [observaciones, setObservaciones] = useState('')

  // Sub-panel "Copiar / Mover a..."
  const [copyOpen,    setCopyOpen]    = useState(false)
  const [copyMode,    setCopyMode]    = useState<'copiar' | 'mover'>('copiar')
  const [copyCursoId, setCopyCursoId] = useState(cursoId)
  const [copyFecha,   setCopyFecha]   = useState('')
  const [copying,     setCopying]     = useState(false)
  const [copyError,   setCopyError]   = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // ── Derived data from clases ────────────────────────────────────────────────

  /** All unique courses from horarios (excluding tutoria_curso) */
  const cursosUnicos = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of clases) {
      if (c.tipo !== 'tutoria_curso' && c.cursos) {
        map.set(c.cursos.id, c.cursos.asignatura)
      }
    }
    return Array.from(map.entries()).map(([id, asignatura]) => ({ id, asignatura }))
  }, [clases])

  /** Map: cursoId → Set of valid DOW numbers (1=lun … 6=sáb) */
  const cursoDiasMap = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const c of clases) {
      if (c.tipo === 'tutoria_curso' || !c.cursos) continue
      const dow = DIA_TO_DOW[c.dia_semana.toLowerCase()]
      if (dow === undefined) continue
      if (!map.has(c.cursos.id)) map.set(c.cursos.id, new Set())
      map.get(c.cursos.id)!.add(dow)
    }
    return map
  }, [clases])

  /** Valid upcoming dates for the currently selected copy-destination course */
  const fechasDestino = useMemo(() => {
    const dias = cursoDiasMap.get(copyCursoId)
    if (!dias || dias.size === 0) return []
    return generarFechasValidas(dias, fecha)
  }, [copyCursoId, cursoDiasMap, fecha])

  // Auto-select first valid date when course or valid-dates list changes
  useEffect(() => {
    if (fechasDestino.length > 0) setCopyFecha(fechasDestino[0])
    else setCopyFecha('')
  }, [fechasDestino])

  // ── Fetch existing bitácora ─────────────────────────────────────────────────

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

  // ── Actividades helpers ─────────────────────────────────────────────────────

  function addActividad() {
    setActividades(prev => [...prev, emptyActividad()])
  }

  function removeActividad(i: number) {
    setActividades(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateActividad(i: number, field: keyof ActividadPlanificada, value: string) {
    setActividades(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  // ── Copy / Move handler ─────────────────────────────────────────────────────

  async function handleCopiar() {
    setCopyError(null)
    setCopying(true)
    const action = copyMode === 'mover' ? moverPlanificacion : copiarPlanificacion
    const result = await action({
      sourceCursoId: cursoId,
      sourceFecha: fecha,
      destCursoId: copyCursoId,
      destFecha: copyFecha,
    })
    setCopying(false)
    if (result.error) {
      setCopyError(result.error)
      return
    }
    if (copyMode === 'mover') {
      // Source was deleted — close modal and refresh calendar
      onSaved()
    } else {
      setCopySuccess(true)
      setCopyOpen(false)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  // ── Save handler ────────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-base">{asignatura}</h3>
              {centroComputo && (
                <span className="text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  Centro Cómputo
                </span>
              )}
            </div>
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

              {/* Sub-panel Copiar / Mover — solo visible si ya existe un plan guardado */}
              {existing && (
                <div className="border border-gray-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setCopyOpen(o => !o); setCopyError(null) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">⎘</span>
                      Copiar / Mover plan a otra clase
                    </span>
                    <span className="text-gray-500 text-xs">{copyOpen ? '▲' : '▼'}</span>
                  </button>

                  {copyOpen && (
                    <div className="px-4 pb-4 pt-3 space-y-3 bg-gray-800/50 border-t border-gray-700">

                      {/* Copiar vs Mover toggle */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCopyMode('copiar')}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                            copyMode === 'copiar'
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                              : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopyMode('mover')}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                            copyMode === 'mover'
                              ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                              : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Mover (elimina original)
                        </button>
                      </div>

                      {copyMode === 'mover' && (
                        <p className="text-[11px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                          El plan original será eliminado de esta clase al confirmar.
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {/* Curso destino */}
                        <div>
                          <label className="label">Curso destino</label>
                          <select
                            value={copyCursoId}
                            onChange={e => setCopyCursoId(e.target.value)}
                            className="input text-sm"
                          >
                            {cursosUnicos.length === 0
                              ? <option value={cursoId}>{asignatura}</option>
                              : cursosUnicos.map(c => (
                                  <option key={c.id} value={c.id}>{c.asignatura}</option>
                                ))
                            }
                          </select>
                        </div>

                        {/* Fecha destino — solo fechas válidas del curso seleccionado */}
                        <div>
                          <label className="label">Fecha destino</label>
                          {fechasDestino.length === 0 ? (
                            <p className="text-xs text-gray-500 italic mt-1">
                              Sin fechas disponibles
                            </p>
                          ) : (
                            <select
                              value={copyFecha}
                              onChange={e => setCopyFecha(e.target.value)}
                              className="input text-sm"
                            >
                              {fechasDestino.map(f => (
                                <option key={f} value={f}>{fmtFechaOpt(f)}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {copyError && (
                        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                          {copyError}
                        </p>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setCopyOpen(false); setCopyError(null) }}
                          className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={copying || !copyFecha || !copyCursoId || fechasDestino.length === 0}
                          onClick={handleCopiar}
                          className={`text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                            copyMode === 'mover'
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-blue-600 hover:bg-blue-500'
                          }`}
                        >
                          {copying
                            ? (copyMode === 'mover' ? 'Moviendo...' : 'Copiando...')
                            : (copyMode === 'mover' ? 'Mover' : 'Copiar')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {copySuccess && (
                <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                  ✓ Plan copiado correctamente
                </p>
              )}

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
