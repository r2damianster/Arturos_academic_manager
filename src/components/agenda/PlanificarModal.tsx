'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarPlanificacion, copiarPlanificacion, moverPlanificacion, getClasesFuturas } from '@/lib/actions/bitacora'
import { corregirPlan } from '@/lib/actions/generar-contenido'
import type { ActividadPlanificada } from '@/types/domain'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  readOnly?: boolean
  allowCopyMove?: boolean
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
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

/** Normaliza un string de día: minúsculas sin tildes */
function normDia(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

// ─── Sortable row ──────────────────────────────────────────────────────────────

function SortableActividad({ act, readOnly, onUpdate, onRemove, canRemove, onTransfer }: {
  act: ActividadPlanificada & { id: string }
  readOnly: boolean
  onUpdate: (field: keyof ActividadPlanificada, value: string) => void
  onRemove: () => void
  canRemove: boolean
  onTransfer?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: act.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[16px_1fr_1fr_auto] gap-2 items-center">
      {readOnly ? (
        <span />
      ) : (
        <button
          type="button" {...attributes} {...listeners}
          className="flex items-center justify-center text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing h-full"
          tabIndex={-1}
          aria-label="Arrastrar para reordenar"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="4" cy="2" r="1"/><circle cx="8" cy="2" r="1"/>
            <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
            <circle cx="4" cy="10" r="1"/><circle cx="8" cy="10" r="1"/>
          </svg>
        </button>
      )}
      <input
        type="text" value={act.actividad}
        onChange={e => onUpdate('actividad', e.target.value)}
        className={`input text-sm py-1.5 ${readOnly ? 'bg-gray-800 border-transparent text-gray-300 cursor-default' : ''}`}
        placeholder="Ej: Exposición grupal"
        disabled={readOnly}
      />
      <input
        type="text" value={act.recurso}
        onChange={e => onUpdate('recurso', e.target.value)}
        className={`input text-sm py-1.5 ${readOnly ? 'bg-gray-800 border-transparent text-gray-300 cursor-default' : ''}`}
        placeholder="Ej: Presentación PPT"
        disabled={readOnly}
      />
      {!readOnly ? (
        <div className="flex items-center gap-1">
          {onTransfer && (
            <button type="button" onClick={onTransfer}
              title="Trasladar esta actividad a otro plan"
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-amber-400 transition-colors rounded text-xs">
              →
            </button>
          )}
          <button type="button" onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors rounded"
            disabled={!canRemove}>
            ✕
          </button>
        </div>
      ) : <span />}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

function emptyActividad(): ActividadPlanificada & { id: string } {
  return { id: crypto.randomUUID(), actividad: '', recurso: '' }
}

function withIds(acts: ActividadPlanificada[]): (ActividadPlanificada & { id: string })[] {
  return acts.map(a => ({ ...a, id: a.id ?? crypto.randomUUID() }))
}

export function PlanificarModal({
  cursoId, asignatura, fecha, horaInicio, horaFin, centroComputo, onClose, onSaved, clases = [], readOnly = false, allowCopyMove = true
}: PlanificarModalProps) {
  const supabase = createClient()

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [existing,    setExisting]    = useState<BitacoraExistente | null>(null)
  const [correcting,  setCorrecting]  = useState<'tema' | 'obs' | 'acts' | null>(null)

  const [tema,          setTema]          = useState('')
  const [actividades,   setActividades]   = useState<(ActividadPlanificada & { id: string })[]>([emptyActividad()])
  const [observaciones, setObservaciones] = useState('')

  // Sub-panel "Copiar / Mover a..."
  const [copyOpen,    setCopyOpen]    = useState(false)
  const [copyMode,    setCopyMode]    = useState<'copiar' | 'mover'>('copiar')
  const [copyCursoId, setCopyCursoId] = useState(cursoId)
  const [copyFecha,   setCopyFecha]   = useState('')
  const [copying,     setCopying]     = useState(false)
  const [copyError,   setCopyError]   = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Sub-panel "Trasladar actividad individual"
  type ClaseDestinoInfo = { id: string; fecha: string; tema: string | null }
  const [txActId,       setTxActId]       = useState<string | null>(null)   // act.id seleccionada
  const [txDestinos,    setTxDestinos]    = useState<ClaseDestinoInfo[] | 'loading' | null>(null)
  const [txTargetId,    setTxTargetId]    = useState<string | null>(null)
  const [txMode,        setTxMode]        = useState<'move' | 'copy'>('move')
  const [txSaving,      setTxSaving]      = useState(false)
  const [txError,       setTxError]       = useState<string | null>(null)
  const [txOk,          setTxOk]          = useState(false)

  async function abrirTrasladoAct(actId: string) {
    setTxActId(actId)
    setTxOk(false)
    setTxError(null)
    setTxMode('move')
    setTxDestinos('loading')
    setTxTargetId(null)
    if (!existing) return
    const futuras = await getClasesFuturas(existing.id)
    setTxDestinos(futuras.length > 0 ? futuras : null)
    if (futuras.length > 0) setTxTargetId(futuras[0].id)
  }

  async function confirmarTrasladoAct() {
    if (!txActId || !txTargetId || !existing) return
    setTxSaving(true)
    setTxError(null)

    const actObj = actividades.find(a => a.id === txActId)
    if (!actObj) { setTxSaving(false); return }

    // Fetch target current actividades
    const { data: target, error: tgtErr } = await supabase
      .from('bitacora_clase')
      .select('actividades_json')
      .eq('id', txTargetId)
      .maybeSingle()

    if (tgtErr || !target) {
      setTxError('No se pudo cargar la clase destino')
      setTxSaving(false)
      return
    }

    const targetActs = [
      ...((target.actividades_json as ActividadPlanificada[]) ?? []),
      { actividad: actObj.actividad, recurso: actObj.recurso },
    ]

    const { error: updTgt } = await supabase
      .from('bitacora_clase')
      .update({ actividades_json: targetActs })
      .eq('id', txTargetId)

    if (updTgt) { setTxError(updTgt.message); setTxSaving(false); return }

    if (txMode === 'move') {
      removeActividad(txActId)
      // Save source without the moved activity
      const remaining = actividades.filter(a => a.id !== txActId && a.actividad.trim())
      await supabase.from('bitacora_clase').update({ actividades_json: remaining }).eq('id', existing.id)
    }

    setTxSaving(false)
    setTxOk(true)
    setTimeout(() => { setTxActId(null); setTxOk(false) }, 1800)
  }

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
      const dow = DIA_TO_DOW[normDia(c.dia_semana)]
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('bitacora_clase')
      .select('id, tema, actividades_json, observaciones, estado')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha)
      .eq('profesor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setExisting(data)
      setTema(data.tema ?? '')
      setActividades(
        Array.isArray(data.actividades_json) && data.actividades_json.length > 0
          ? withIds(data.actividades_json)
          : [emptyActividad()]
      )
      setObservaciones(data.observaciones ?? '')
    }
    setLoading(false)
  }, [cursoId, fecha, supabase])

  useEffect(() => { fetchExisting() }, [fetchExisting])

  // ── DnD sensors ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setActividades(prev => {
        const oldIdx = prev.findIndex(a => a.id === active.id)
        const newIdx = prev.findIndex(a => a.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── Actividades helpers ─────────────────────────────────────────────────────

  function addActividad() {
    setActividades(prev => [...prev, emptyActividad()])
  }

  function removeActividad(id: string) {
    setActividades(prev => prev.filter(a => a.id !== id))
  }

  function updateActividad(id: string, field: keyof ActividadPlanificada, value: string) {
    setActividades(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  // ── Corregir ortografía ─────────────────────────────────────────────────────

  function esUrl(s: string) {
    return /^https?:\/\//i.test(s.trim()) || /^www\./i.test(s.trim())
  }

  async function handleCorregir(campo: 'tema' | 'obs') {
    const texto = campo === 'tema' ? tema : observaciones
    if (!texto.trim()) return
    setCorrecting(campo)
    const result = await corregirPlan({ texto })
    setCorrecting(null)
    if (!result.error && result.corregido.trim()) {
      if (campo === 'tema') setTema(result.corregido.trim())
      else setObservaciones(result.corregido.trim())
    }
  }

  async function handleCorregirActividades() {
    const candidatas = actividades.filter(
      a => a.actividad.trim() || (a.recurso.trim() && !esUrl(a.recurso))
    )
    if (!candidatas.length) return
    setCorrecting('acts')
    const resultados = await Promise.all(
      candidatas.map(a => Promise.all([
        a.actividad.trim()                        ? corregirPlan({ texto: a.actividad }) : Promise.resolve(null),
        a.recurso.trim() && !esUrl(a.recurso)     ? corregirPlan({ texto: a.recurso })   : Promise.resolve(null),
      ]))
    )
    setCorrecting(null)
    setActividades(prev =>
      prev.map(a => {
        const idx = candidatas.findIndex(c => c.id === a.id)
        if (idx === -1) return a
        const [actR, recR] = resultados[idx]
        return {
          ...a,
          actividad: actR && !actR.error && actR.corregido.trim() ? actR.corregido.trim() : a.actividad,
          recurso:   recR && !recR.error && recR.corregido.trim() ? recR.corregido.trim() : a.recurso,
        }
      })
    )
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
                {readOnly ? '✓ Plan cumplido' : existing?.estado === 'cumplido' ? '✓ Cumplido' : existing ? '📋 Planificado' : '📋 Nueva planificación'}
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
        ) : readOnly && !existing ? (
          <div className="flex items-center justify-center p-10">
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">No se encontró planificación guardada para esta clase.</div>
              <div className="text-gray-500 text-xs">La asistencia fue registrada sin plan detallado.</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Tema */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Tema de la clase *</label>
                  {!readOnly && tema.trim() && (
                    <button type="button" onClick={() => handleCorregir('tema')}
                      disabled={correcting !== null}
                      className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1 transition-colors">
                      {correcting === 'tema' ? '⟳ Corrigiendo…' : '✦ Corregir'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={tema}
                  onChange={e => setTema(e.target.value)}
                  className={`input ${readOnly ? 'bg-gray-800 border-transparent text-gray-300 cursor-default' : ''}`}
                  placeholder="Ej: Introducción a las derivadas parciales"
                  autoFocus={!readOnly}
                  disabled={readOnly}
                />
              </div>

              {/* Actividades */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Actividades y recursos</label>
                  {!readOnly && (
                    <button type="button" onClick={addActividad}
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                      <span className="text-base leading-none">+</span> Agregar fila
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-[16px_1fr_1fr_auto] gap-2 px-1">
                    <span />
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Actividad</span>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">Recurso</span>
                    {!readOnly && <span className="w-6" />}
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={actividades.map(a => a.id)} strategy={verticalListSortingStrategy}>
                      {actividades.map(act => (
                        <SortableActividad
                          key={act.id}
                          act={act}
                          readOnly={readOnly}
                          onUpdate={(field, value) => updateActividad(act.id, field, value)}
                          onRemove={() => removeActividad(act.id)}
                          canRemove={actividades.length > 1}
                          onTransfer={existing && !readOnly ? () => abrirTrasladoAct(act.id) : undefined}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  {!readOnly && actividades.some(a => a.actividad.trim() || (a.recurso.trim() && !esUrl(a.recurso))) && (
                    <div className="flex justify-end pt-1">
                      <button type="button" onClick={handleCorregirActividades}
                        disabled={correcting !== null}
                        className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1 transition-colors">
                        {correcting === 'acts' ? '⟳ Corrigiendo…' : '✦ Corregir ortografía'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel traslado de actividad individual */}
              {txActId && (() => {
                const actObj = actividades.find(a => a.id === txActId)
                return (
                  <div className="border border-amber-700/50 bg-amber-900/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-300">Trasladar actividad</p>
                      <button type="button" onClick={() => setTxActId(null)} className="text-gray-500 hover:text-gray-300 text-sm leading-none">✕</button>
                    </div>
                    {actObj && (
                      <p className="text-xs text-gray-300 bg-gray-800/60 rounded-lg px-3 py-2 truncate">
                        <span className="text-gray-500">Actividad: </span>{actObj.actividad || '(sin nombre)'}
                      </p>
                    )}
                    {txDestinos === 'loading' && <p className="text-xs text-gray-500">Buscando clases futuras…</p>}
                    {txDestinos === null && <p className="text-xs text-red-400">No hay clases futuras planificadas para este curso.</p>}
                    {txDestinos && txDestinos !== 'loading' && (
                      <>
                        <div className="space-y-1">
                          <p className="text-[11px] text-gray-500">Destino:</p>
                          <select
                            value={txTargetId ?? ''}
                            onChange={e => setTxTargetId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-600"
                          >
                            {txDestinos.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.fecha}{c.tema ? ` · ${c.tema.slice(0, 40)}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 w-fit">
                          {(['move', 'copy'] as const).map(m => (
                            <button key={m} type="button" onClick={() => setTxMode(m)}
                              className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${txMode === m ? 'bg-amber-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                              {m === 'move' ? 'Mover' : 'Copiar'}
                            </button>
                          ))}
                        </div>
                        {txMode === 'copy' && <p className="text-[10px] text-gray-500">La actividad queda también aquí.</p>}
                        {txError && <p className="text-xs text-red-400">{txError}</p>}
                        {txOk && <p className="text-xs text-emerald-400">✓ {txMode === 'move' ? 'Actividad movida' : 'Actividad copiada'}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={confirmarTrasladoAct}
                            disabled={txSaving || !txTargetId}
                            className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                            {txSaving ? (txMode === 'move' ? 'Moviendo…' : 'Copiando…') : (txMode === 'move' ? 'Mover' : 'Copiar')}
                          </button>
                          <button type="button" onClick={() => setTxActId(null)}
                            className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Observaciones */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Observaciones (opcional)</label>
                  {!readOnly && observaciones.trim() && (
                    <button type="button" onClick={() => handleCorregir('obs')}
                      disabled={correcting !== null}
                      className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1 transition-colors">
                      {correcting === 'obs' ? '⟳ Corrigiendo…' : '✦ Corregir'}
                    </button>
                  )}
                </div>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={2}
                  className={`input resize-none ${readOnly ? 'bg-gray-800 border-transparent text-gray-300 cursor-default' : ''}`}
                  placeholder="Notas adicionales para esta clase..."
                  disabled={readOnly}
                />
              </div>

              {/* Sub-panel Copiar / Mover — solo visible si ya existe un plan guardado */}
              {existing && allowCopyMove && (
                <div className="border border-gray-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setCopyOpen(o => !o); setCopyError(null); if(readOnly) setCopyMode('copiar') }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">⎘</span>
                      {readOnly ? 'Copiar plan a otra clase' : 'Copiar / Mover plan a otra clase'}
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
                        {!readOnly && (
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
                        )}
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
              {readOnly ? (
                <button type="button" onClick={onClose} className="btn-primary w-full">Cerrar</button>
              ) : (
                <>
                  <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">
                    {saving ? 'Guardando...' : existing ? 'Actualizar planificación' : 'Guardar planificación'}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
