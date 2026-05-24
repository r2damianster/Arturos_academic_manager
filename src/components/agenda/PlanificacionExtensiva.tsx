'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { gestionarDragPlanificacion, eliminarPlanificacion } from '@/lib/actions/bitacora'
import { PlanificarModal } from './PlanificarModal'
import { PlanDropModal } from './PlanDropModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Curso {
  id: string
  asignatura: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo: boolean
  curso_id: string
  cursos: Curso | null
}

interface BitacoraEntry {
  id: string
  estado: string
  tema: string
  actividades_json: { actividad: string; recurso: string }[]
  observaciones: string | null
  hora_inicio_real: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_LONG = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_S    = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_S   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }
function fmt(t: string) { return t?.slice(0, 5) ?? '' }
function fmtFecha(s: string) {
  const d = new Date(s + 'T12:00:00')
  return { dia: `${DIAS_S[d.getDay()]} ${d.getDate()}`, mes: `${MESES_S[d.getMonth()]} ${d.getFullYear()}` }
}
function truncar(tema: string, max = 10) {
  const w = tema.trim().split(/\s+/)
  return w.length <= max ? tema : w.slice(0, max).join(' ') + '…'
}

function generarFechasClase(clases: Clase[], cursoId: string, desde: Date, hasta: Date) {
  const clasesDelCurso = clases.filter(c => (c.cursos?.id ?? c.curso_id) === cursoId && c.tipo !== 'tutoria_curso')
  const diasMap = new Map<string, Clase>()
  for (const c of clasesDelCurso) diasMap.set(c.dia_semana, c)

  const result: { fecha: string; clase: Clase }[] = []
  const cur = new Date(desde)
  while (cur <= hasta) {
    const dayName = DIAS_LONG[cur.getDay()]
    const clase = diasMap.get(dayName)
    if (clase) result.push({ fecha: dateToStr(cur), clase })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ─── Drag primitives ──────────────────────────────────────────────────────────

function DraggableHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title="Arrastrar al otro curso"
      className="absolute top-1.5 right-1.5 cursor-grab active:cursor-grabbing w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-gray-400 hover:bg-gray-700/60 transition-colors text-[11px] select-none z-10"
    >
      ⠿
    </div>
  )
}

function DroppableSlot({ id, isOver, children }: { id: string; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded-lg transition-all ${isOver ? 'ring-2 ring-brand-400/70 bg-brand-900/10' : ''}`}
    >
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  clases: Clase[]
}

export function PlanificacionExtensiva({ clases }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const cursos = useMemo(() => {
    const map = new Map<string, Curso>()
    for (const c of clases) {
      if (c.cursos && c.tipo !== 'tutoria_curso') map.set(c.cursos.id, c.cursos)
    }
    return Array.from(map.values())
  }, [clases])

  const [cursoAId, setCursoAId] = useState(() => cursos[0]?.id ?? '')
  const [cursoBId, setCursoBId] = useState<string | null>(null)
  const [mesesA, setMesesA] = useState(2)
  const [offsetA, setOffsetA] = useState(0)
  const [offsetB, setOffsetB] = useState(0)
  const [bitacoraMap, setBitacoraMap] = useState<Map<string, BitacoraEntry>>(new Map())
  const [planificarModal, setPlanificarModal] = useState<{ clase: Clase; fecha: string } | null>(null)

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [dragPendiente, setDragPendiente] = useState<{
    srcCursoId: string; srcFecha: string; srcTema: string
    srcBitacoraId: string | null
    srcActividades: { actividad: string; recurso: string }[]
    srcObservaciones: string | null
    dstCursoId: string; dstFecha: string; dstAsignatura: string
    dstHasPlan: boolean; dstTema?: string
  } | null>(null)
  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function offsetToDate(offset: number): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset * 7)
    return d
  }

  function fechaToOffset(fecha: string | null | undefined, dir: 'min' | 'max', fallback: number): number {
    if (!fecha) return fallback
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const diff = (new Date(fecha).getTime() - hoy.getTime()) / (7 * 24 * 3600 * 1000)
    return dir === 'min' ? Math.floor(diff) - 1 : Math.ceil(diff) + 1
  }

  const { minOffsetA, maxOffsetA } = useMemo(() => {
    const c = cursos.find(x => x.id === cursoAId)
    return { minOffsetA: fechaToOffset(c?.fecha_inicio, 'min', -52), maxOffsetA: fechaToOffset(c?.fecha_fin, 'max', 52) }
  }, [cursoAId, cursos])

  const { minOffsetB, maxOffsetB } = useMemo(() => {
    if (!cursoBId) return { minOffsetB: -52, maxOffsetB: 52 }
    const c = cursos.find(x => x.id === cursoBId)
    return { minOffsetB: fechaToOffset(c?.fecha_inicio, 'min', -52), maxOffsetB: fechaToOffset(c?.fecha_fin, 'max', 52) }
  }, [cursoBId, cursos])

  const { desdeA, hastaA } = useMemo(() => {
    const d = offsetToDate(offsetA)
    const h = new Date(d)
    h.setMonth(h.getMonth() + (cursoBId ? 1 : mesesA))
    return { desdeA: d, hastaA: h }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetA, mesesA, cursoBId])

  const { desdeB, hastaB } = useMemo(() => {
    if (!cursoBId) return { desdeB: new Date(), hastaB: new Date() }
    const d = offsetToDate(offsetB)
    const h = new Date(d)
    h.setMonth(h.getMonth() + 1)
    return { desdeB: d, hastaB: h }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetB, cursoBId])

  const fechasA = useMemo(
    () => cursoAId ? generarFechasClase(clases, cursoAId, desdeA, hastaA) : [],
    [clases, cursoAId, desdeA, hastaA]
  )
  const fechasB = useMemo(
    () => cursoBId ? generarFechasClase(clases, cursoBId, desdeB, hastaB) : [],
    [clases, cursoBId, desdeB, hastaB]
  )

  const loadBitacoras = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !cursoAId) return

    const cursoIds = [cursoAId, cursoBId].filter(Boolean) as string[]
    const fechaMin = dateToStr(new Date(Math.min(desdeA.getTime(), cursoBId ? desdeB.getTime() : desdeA.getTime())))
    const fechaMax = dateToStr(new Date(Math.max(hastaA.getTime(), cursoBId ? hastaB.getTime() : hastaA.getTime())))
    const { data } = await supabase
      .from('bitacora_clase')
      .select('id, curso_id, fecha, estado, tema, actividades_json, observaciones, hora_inicio_real')
      .eq('profesor_id', user.id)
      .in('curso_id', cursoIds)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax)

    const m = new Map<string, BitacoraEntry>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of (data ?? []) as any[]) {
      m.set(`${b.curso_id}|${b.fecha}`, {
        id: b.id,
        estado: b.estado,
        tema: b.tema ?? '',
        actividades_json: Array.isArray(b.actividades_json) ? b.actividades_json : [],
        observaciones: b.observaciones ?? null,
        hora_inicio_real: b.hora_inicio_real ?? null,
      })
    }
    setBitacoraMap(m)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoAId, cursoBId, desdeA, hastaA, desdeB, hastaB])

  useEffect(() => {
    if (cursoAId) loadBitacoras()
  }, [cursoAId, loadBitacoras])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const [srcCursoId, srcFecha] = String(active.id).split('__')
    const [dstCursoId, dstFecha] = String(over.id).split('__')

    if (srcCursoId === dstCursoId && srcFecha === dstFecha) return

    const srcEntry = bitacoraMap.get(`${srcCursoId}|${srcFecha}`)
    const dstEntry  = bitacoraMap.get(`${dstCursoId}|${dstFecha}`)
    const srcTema = srcEntry?.tema ?? ''
    const dstAsignatura = cursos.find(c => c.id === dstCursoId)?.asignatura ?? ''
    setDragPendiente({
      srcCursoId, srcFecha, srcTema,
      srcBitacoraId: srcEntry?.id ?? null,
      srcActividades: srcEntry?.actividades_json ?? [],
      srcObservaciones: srcEntry?.observaciones ?? null,
      dstCursoId, dstFecha, dstAsignatura,
      dstHasPlan: Boolean(dstEntry),
      dstTema: dstEntry?.tema,
    })
  }

  async function handleDeleteCard(cursoId: string, fecha: string, entryId: string) {
    setDeletingId(entryId)
    await eliminarPlanificacion({ cursoId, fecha })
    setDeletingId(null)
    setDeleteConfirmId(null)
    setBitacoraMap(prev => { const m = new Map(prev); m.delete(`${cursoId}|${fecha}`); return m })
  }

  // ── Card render ───────────────────────────────────────────────────────────

  function renderCard(clase: Clase, fecha: string, cursoId: string) {
    const entry = bitacoraMap.get(`${cursoId}|${fecha}`)
    const curso = cursos.find(c => c.id === cursoId)
    const dragId = `${cursoId}__${fecha}`
    const isCumplido = entry?.estado === 'cumplido'
    const isPlanned  = entry?.estado === 'planificado'

    if (!entry) return (
      <button
        onClick={() => setPlanificarModal({ clase, fecha })}
        className="w-full text-left px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-500/30 hover:bg-yellow-900/30 transition-colors"
      >
        <span className="text-yellow-400 text-xs font-medium">⚠ Sin planificar</span>
        <p className="text-gray-500 text-[10px] mt-0.5">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</p>
        {clase.centro_computo && <span className="text-[9px] text-cyan-400">💻 Cómputo</span>}
      </button>
    )

    return (
      <div className={`relative px-3 py-2 rounded-lg border space-y-1.5 ${
        isCumplido ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-sky-900/20 border-sky-500/30'
      }`}>
        {cursoBId && <DraggableHandle id={dragId} />}
        <div className="flex items-start justify-between gap-2 pr-5">
          <div className="min-w-0 flex-1">
            <span className={`text-xs font-medium ${isCumplido ? 'text-emerald-400' : 'text-sky-400'}`}>
              {isCumplido ? '✓ Cumplido' : 'Planificado'}
            </span>
            <p className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</p>
            {entry.tema && <p className="text-gray-300 text-xs mt-0.5 leading-tight">{truncar(entry.tema)}</p>}
          </div>
          {clase.centro_computo && <span className="text-[9px] text-cyan-400 flex-shrink-0">💻</span>}
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            onClick={() => setPlanificarModal({ clase, fecha })}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            {isCumplido ? 'Ver plan' : 'Editar'}
          </button>
          {isPlanned && (
            <>
              <Link
                href={`/dashboard/modo-clase/${entry.id}`}
                className="text-[10px] px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
              >
                ▶ Iniciar
              </Link>
            </>
          )}
          {isCumplido && (
            <Link
              href={`/dashboard/modo-clase/${entry.id}`}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Ver resumen
            </Link>
          )}
          {/* Eliminar */}
          {deleteConfirmId === entry.id ? (
            <>
              <span className="text-[10px] text-red-400">{isCumplido ? '⚠ ¿Borrar cumplido?' : '¿Eliminar?'}</span>
              <button onClick={() => handleDeleteCard(cursoId, fecha, entry.id)} disabled={deletingId === entry.id}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
                {deletingId === entry.id ? '…' : 'Sí'}
              </button>
              <button onClick={() => setDeleteConfirmId(null)}
                className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200">
                No
              </button>
            </>
          ) : (
            <button onClick={() => setDeleteConfirmId(entry.id)}
              className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-1 rounded hover:bg-red-900/20"
              title="Eliminar plan">🗑</button>
          )}
        </div>
      </div>
    )
  }

  // ── Overlay card (shown while dragging) ───────────────────────────────────

  function renderOverlay() {
    if (!activeId) return null
    const [cursoId, fecha] = activeId.split('__')
    const entry = bitacoraMap.get(`${cursoId}|${fecha}`)
    if (!entry) return null
    return (
      <div className="px-3 py-2 rounded-lg border bg-sky-900/80 border-sky-400/60 shadow-xl opacity-90 w-52 pointer-events-none">
        <p className="text-sky-300 text-xs font-medium">Copiar plan</p>
        {entry.tema && <p className="text-gray-200 text-xs mt-0.5 leading-tight">{truncar(entry.tema, 6)}</p>}
      </div>
    )
  }

  if (cursos.length === 0) return (
    <p className="text-gray-500 text-sm text-center py-8">No hay cursos con horarios configurados.</p>
  )

  const cursoA = cursos.find(c => c.id === cursoAId)
  const cursoB = cursos.find(c => c.id === cursoBId)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={e => setOverId(e.over ? String(e.over.id) : null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setOverId(null) }}
    >
      <div className="space-y-4">

        {/* Controles */}
        <div className="flex flex-wrap gap-4 items-end p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <div>
            <label className="label">Curso A</label>
            <select value={cursoAId} onChange={e => setCursoAId(e.target.value)} className="input text-sm">
              {cursos.map(c => <option key={c.id} value={c.id}>{c.asignatura}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Curso B — comparar</label>
            <select
              value={cursoBId ?? ''}
              onChange={e => { setCursoBId(e.target.value || null); setOffsetB(0) }}
              className="input text-sm"
            >
              <option value="">Sin comparar</option>
              {cursos.filter(c => c.id !== cursoAId).map(c => (
                <option key={c.id} value={c.id}>{c.asignatura}</option>
              ))}
            </select>
          </div>

          {!cursoBId && (
            <div>
              <label className="label">Horizonte A</label>
              <div className="flex gap-2">
                {[1, 2].map(n => (
                  <button key={n} type="button" onClick={() => setMesesA(n)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mesesA === n ? 'border-brand-500 bg-brand-600/20 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  >
                    {n} {n === 1 ? 'mes' : 'meses'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cursoBId && (
            <p className="text-[10px] text-gray-500 self-end pb-1">Arrastra ⠿ para mover/copiar un plan al otro curso</p>
          )}
        </div>

        {dragPendiente && (
          <PlanDropModal
            source={{ asignatura: cursos.find(c => c.id === dragPendiente.srcCursoId)?.asignatura ?? '', fecha: dragPendiente.srcFecha, tema: dragPendiente.srcTema }}
            dest={{ asignatura: dragPendiente.dstAsignatura, fecha: dragPendiente.dstFecha, hasPlan: dragPendiente.dstHasPlan, tema: dragPendiente.dstTema }}
            onConfirm={async (accion, colision) => {
              const result = await gestionarDragPlanificacion(
                dragPendiente.srcBitacoraId,
                dragPendiente.dstCursoId,
                dragPendiente.dstFecha,
                accion,
                colision,
                { tema: dragPendiente.srcTema, actividades_json: dragPendiente.srcActividades, observaciones: dragPendiente.srcObservaciones }
              )
              if (!result.error) loadBitacoras()
              return result
            }}
            onClose={() => setDragPendiente(null)}
          />
        )}

        {/* Columnas */}
        <div className={`grid gap-6 ${cursoBId ? 'md:grid-cols-2' : 'grid-cols-1'}`}>

          {/* Curso A */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-200">{cursoA?.asignatura}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setOffsetA(o => o - 1)} disabled={offsetA <= minOffsetA}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs disabled:opacity-30 disabled:cursor-not-allowed">←</button>
                <span className="text-[10px] text-gray-500 w-20 text-center">{`${MESES_S[desdeA.getMonth()]} – ${MESES_S[hastaA.getMonth()]} ${hastaA.getFullYear()}`}</span>
                <button onClick={() => setOffsetA(o => o + 1)} disabled={offsetA >= maxOffsetA}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs disabled:opacity-30 disabled:cursor-not-allowed">→</button>
                {offsetA !== 0 && <button onClick={() => setOffsetA(0)} className="text-[10px] text-gray-600 hover:text-gray-400 px-1">hoy</button>}
              </div>
            </div>
            {fechasA.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-6">Sin clases en este período.</p>
            ) : (
              fechasA.map(({ fecha, clase }) => {
                const { dia, mes } = fmtFecha(fecha)
                const dropId = `${cursoAId}__${fecha}`
                const isOver = overId === dropId && activeId !== null && !activeId.startsWith(cursoAId + '__')
                return (
                  <div key={fecha} className="flex gap-3">
                    <div className="w-24 flex-shrink-0 pt-2 text-right">
                      <p className="text-xs text-gray-300 font-medium">{dia}</p>
                      <p className="text-[10px] text-gray-600">{mes}</p>
                    </div>
                    <DroppableSlot id={dropId} isOver={isOver}>
                      {renderCard(clase, fecha, cursoAId)}
                    </DroppableSlot>
                  </div>
                )
              })
            )}
          </div>

          {/* Curso B */}
          {cursoBId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-gray-200">{cursoB?.asignatura}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOffsetB(o => o - 1)} disabled={offsetB <= minOffsetB}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs disabled:opacity-30 disabled:cursor-not-allowed">←</button>
                  <span className="text-[10px] text-gray-500 w-20 text-center">{`${MESES_S[desdeB.getMonth()]} – ${MESES_S[hastaB.getMonth()]} ${hastaB.getFullYear()}`}</span>
                  <button onClick={() => setOffsetB(o => o + 1)} disabled={offsetB >= maxOffsetB}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs disabled:opacity-30 disabled:cursor-not-allowed">→</button>
                  {offsetB !== 0 && <button onClick={() => setOffsetB(0)} className="text-[10px] text-gray-600 hover:text-gray-400 px-1">hoy</button>}
                </div>
              </div>
              {fechasB.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-6">Sin clases en este período.</p>
              ) : (
                fechasB.map(({ fecha, clase }) => {
                  const { dia, mes } = fmtFecha(fecha)
                  const dropId = `${cursoBId}__${fecha}`
                  const isOver = overId === dropId && activeId !== null && !activeId.startsWith(cursoBId + '__')
                  return (
                    <div key={fecha} className="flex gap-3">
                      <div className="w-24 flex-shrink-0 pt-2 text-right">
                        <p className="text-xs text-gray-300 font-medium">{dia}</p>
                        <p className="text-[10px] text-gray-600">{mes}</p>
                      </div>
                      <DroppableSlot id={dropId} isOver={isOver}>
                        {renderCard(clase, fecha, cursoBId)}
                      </DroppableSlot>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Modales */}
        {planificarModal && (
          <PlanificarModal
            cursoId={planificarModal.clase.cursos?.id ?? planificarModal.clase.curso_id}
            asignatura={planificarModal.clase.cursos?.asignatura ?? ''}
            fecha={planificarModal.fecha}
            horaInicio={planificarModal.clase.hora_inicio}
            horaFin={planificarModal.clase.hora_fin}
            onClose={() => setPlanificarModal(null)}
            onSaved={() => { setPlanificarModal(null); loadBitacoras() }}
          />
        )}

      </div>

      <DragOverlay dropAnimation={null}>
        {renderOverlay()}
      </DragOverlay>
    </DndContext>
  )
}
