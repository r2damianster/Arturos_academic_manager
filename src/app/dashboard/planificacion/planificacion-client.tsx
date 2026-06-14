'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanificarModal } from '@/components/agenda/PlanificarModal'
import { PlanDropModal } from '@/components/agenda/PlanDropModal'
import { PlanificacionExtensiva } from '@/components/agenda/PlanificacionExtensiva'
import { gestionarDragPlanificacion, eliminarPlanificacion, getClasesFuturas, trasladarActividades, crearBitacoraEspontanea, reactivarClase, type AccionDrag } from '@/lib/actions/bitacora'
import { GeneradorPanel } from '@/components/planificacion/GeneradorPanel'
import { SuspenderClasesModal } from '@/components/agenda/SuspenderClasesModal'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  sin_planificacion: boolean
  razon_suspension: string | null
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const DIAS_LONG  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_S    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }
function fmt(t: string) { return t?.slice(0, 5) ?? '' }

function fmtRange(dates: Date[]) {
  const a = dates[0], b = dates[dates.length - 1]
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${MESES_S[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MESES_S[a.getMonth()]} – ${b.getDate()} ${MESES_S[b.getMonth()]} ${b.getFullYear()}`
}

function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const start = new Date(today)
  if (today.getDay() === 0) start.setDate(start.getDate() + 1)
  start.setDate(start.getDate() + offset * 7)
  const dates: Date[] = []
  const cur = new Date(start)
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function getWeekFromDate(startDate: Date): Date[] {
  const dates: Date[] = []
  const cur = new Date(startDate)
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function getClaseForDay(clases: Clase[], dayName: string): Clase | undefined {
  return clases.find(c => c.dia_semana === dayName)
}

function truncarTema(tema: string, maxWords = 8): string {
  const words = tema.trim().split(/\s+/)
  if (words.length <= maxWords) return tema
  return words.slice(0, maxWords).join(' ') + '…'
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CursoSimple {
  id: string
  asignatura: string
}

interface Props {
  clases: Clase[]
  cursos: CursoSimple[]
  profesorId: string
}

export function PlanificacionClient({ clases, cursos, profesorId: _profesorId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const didMount = useRef(false)

  const [viewMode, setViewMode] = useState<'semana' | 'extensivo'>(
    () => searchParams.get('view') === 'extensivo' ? 'extensivo' : 'semana'
  )
  const [selectedDate, setSelectedDate] = useState(() => {
    const p = searchParams.get('date')
    if (p) return p
    const t = new Date(); t.setHours(0, 0, 0, 0)
    if (t.getDay() === 0) t.setDate(t.getDate() + 1)
    return dateToStr(t)
  })
  const [weekOffset, setWeekOffset] = useState(() => {
    const p = searchParams.get('date')
    if (!p) return 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const stored = new Date(p + 'T00:00:00')
    const diffDays = Math.round((stored.getTime() - today.getTime()) / (24 * 3600 * 1000))
    return Math.floor(diffDays / 7)
  })
  const [isMounted, setIsMounted] = useState(false)
  const [hoyOpen, setHoyOpen] = useState(false)
  const [bitacoraMap, setBitacoraMap] = useState<Map<string, BitacoraEntry>>(new Map())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showTutoriasCurso, setShowTutoriasCurso] = useState(false)
  const [planificarModal, setPlanificarModal] = useState<{
    clase: Clase
    fecha: string
  } | null>(null)
  const [dragSource, setDragSource] = useState<{
    id: string
    cursoId: string
    fecha: string
    tema: string
    actividades_json: { actividad: string; recurso: string }[]
    observaciones: string | null
    asignatura: string
  } | null>(null)
  const [dragTarget, setDragTarget] = useState<{
    cursoId: string
    fecha: string
    hasPlan: boolean
    asignatura: string
    tema?: string
  } | null>(null)
  const [dragModalPayload, setDragModalPayload] = useState<{
    source: NonNullable<typeof dragSource>
    target: NonNullable<typeof dragTarget>
  } | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [espontaneaLoading, setEspontaneaLoading] = useState<string | null>(null)
  const [showGenerador, setShowGenerador] = useState(false)
  const [showSuspender, setShowSuspender] = useState(false)
  const [reactivandoKey, setReactivandoKey] = useState<string | null>(null)

  // ── Traslado de actividades desde planificación ──────────────────────────
  type ClaseDestinoInfo = { id: string; fecha: string; tema: string | null }
  const [trasladoPanel, setTrasladoPanel] = useState<{ bitacoraId: string; sourceCursoId: string; actividades: { actividad: string; recurso: string }[] } | null>(null)
  const [trasladoDestinos, setTrasladoDestinos] = useState<ClaseDestinoInfo[] | 'loading' | null>(null)
  const [trasladoTargetId, setTrasladoTargetId] = useState<string | null>(null)
  const [trasladoCursoId, setTrasladoCursoId] = useState<string | null>(null)
  const [trasladoMode, setTrasladoMode] = useState<'move' | 'copy'>('move')
  const [selectedTrasladoIdx, setSelectedTrasladoIdx] = useState<Set<number>>(new Set())
  const [trasladoSaving, setTrasladoSaving] = useState(false)
  const [trasladoError, setTrasladoError] = useState<string | null>(null)
  const [trasladoOk, setTrasladoOk] = useState(false)

  async function abrirTrasladoPlan(bitacoraId: string, actividades: { actividad: string; recurso: string }[], sourceCursoId: string) {
    setTrasladoPanel({ bitacoraId, sourceCursoId, actividades })
    setTrasladoCursoId(sourceCursoId)
    setSelectedTrasladoIdx(new Set())
    setTrasladoOk(false)
    setTrasladoError(null)
    setTrasladoMode('move')
    setTrasladoDestinos('loading')
    setTrasladoTargetId(null)
    const futuras = await getClasesFuturas(bitacoraId)
    setTrasladoDestinos(futuras.length > 0 ? futuras : null)
    if (futuras.length > 0) setTrasladoTargetId(futuras[0].id)
  }

  async function handleTrasladoCursoChange(newCursoId: string) {
    if (!trasladoPanel) return
    setTrasladoCursoId(newCursoId)
    setTrasladoTargetId(null)
    setTrasladoDestinos('loading')
    const isSameCourse = newCursoId === trasladoPanel.sourceCursoId
    const futuras = await getClasesFuturas(trasladoPanel.bitacoraId, isSameCourse ? undefined : newCursoId)
    setTrasladoDestinos(futuras.length > 0 ? futuras : null)
    if (futuras.length > 0) setTrasladoTargetId(futuras[0].id)
  }

  async function confirmarTrasladoPlan() {
    if (!trasladoPanel || selectedTrasladoIdx.size === 0 || !trasladoTargetId) return
    setTrasladoSaving(true)
    setTrasladoError(null)
    const result = await trasladarActividades(trasladoPanel.bitacoraId, Array.from(selectedTrasladoIdx), trasladoTargetId, trasladoMode)
    if (result.error) {
      setTrasladoError(result.error)
      setTrasladoSaving(false)
      return
    }
    if (trasladoMode === 'move') {
      loadBitacoras()
    }
    setTrasladoSaving(false)
    setTrasladoOk(true)
    setTimeout(() => {
      setTrasladoPanel(null)
      setTrasladoOk(false)
    }, 2000)
  }

  const weekDates = useMemo(() => getWeekFromDate(new Date(selectedDate + 'T12:00:00')), [selectedDate])

  function navDay(delta: 1 | -1) {
    const cur = new Date(selectedDate + 'T12:00:00')
    cur.setDate(cur.getDate() + delta)
    if (cur.getDay() === 0) cur.setDate(cur.getDate() + delta) // saltar domingo
    const newDate = dateToStr(cur)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const curNorm = new Date(newDate + 'T00:00:00')
    const diffDays = Math.round((curNorm.getTime() - today.getTime()) / (24 * 3600 * 1000))
    const newOffset = Math.floor(diffDays / 7)
    if (newOffset < minOffset || newOffset > maxOffset) return
    setWeekOffset(newOffset)
    setSelectedDate(newDate)
  }

  async function handleTomarAsistenciaEspontanea(cursoId: string, fecha: string) {
    const key = `${cursoId}|${fecha}`
    setEspontaneaLoading(key)
    try {
      const result = await crearBitacoraEspontanea(cursoId, fecha)
      if (result.error) { console.error(result.error); return }
      if (result.id) {
        setBitacoraMap(prev => {
          const m = new Map(prev)
          m.set(key, {
            id: result.id!,
            estado: 'planificado',
            tema: '(Sin planificación)',
            actividades_json: [],
            observaciones: null,
            hora_inicio_real: null,
            sin_planificacion: true,
            razon_suspension: null,
          })
          return m
        })
      }
      router.push(`/dashboard/cursos/${cursoId}/pase-lista`)
    } finally {
      setEspontaneaLoading(null)
    }
  }

  async function handleDeletePlan(cursoId: string, fecha: string) {
    const key = `${cursoId}|${fecha}`
    setDeletingKey(key)
    try {
      await eliminarPlanificacion({ cursoId, fecha })
      setBitacoraMap(prev => { const m = new Map(prev); m.delete(key); return m })
    } catch (err) {
      console.error('Error eliminando plan:', err)
    } finally {
      setDeletingKey(null)
      setDeleteConfirmKey(null)
    }
  }

  async function handleReactivar(cursoId: string, fecha: string) {
    const key = `${cursoId}|${fecha}`
    setReactivandoKey(key)
    try {
      await reactivarClase(cursoId, fecha)
      await loadBitacoras()
    } finally {
      setReactivandoKey(null)
    }
  }

  function navWeek(delta: 1 | -1) {
    const newOff = weekOffset + delta
    if (newOff < minOffset || newOff > maxOffset) return
    const cur = new Date(selectedDate + 'T12:00:00')
    cur.setDate(cur.getDate() + delta * 7)
    setWeekOffset(newOff)
    setSelectedDate(dateToStr(cur))
  }

  // Límites de navegación basados en fechas de los cursos
  const { minOffset, maxOffset } = useMemo(() => {
    const fechasInicio = clases.map(c => c.cursos?.fecha_inicio).filter(Boolean) as string[]
    const fechasFin    = clases.map(c => c.cursos?.fecha_fin).filter(Boolean) as string[]
    if (fechasInicio.length === 0 && fechasFin.length === 0) return { minOffset: -52, maxOffset: 52 }
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    let min = -52, max = 52
    if (fechasInicio.length > 0) {
      const earliest = new Date(Math.min(...fechasInicio.map(f => new Date(f).getTime())))
      min = Math.floor((earliest.getTime() - hoy.getTime()) / (7 * 24 * 3600 * 1000)) - 1
    }
    if (fechasFin.length > 0) {
      const latest = new Date(Math.max(...fechasFin.map(f => new Date(f).getTime())))
      max = Math.ceil((latest.getTime() - hoy.getTime()) / (7 * 24 * 3600 * 1000)) + 1
    }
    return { minOffset: min, maxOffset: max }
  }, [clases])

  const clasesVisibles = useMemo(() => {
    return showTutoriasCurso ? clases : clases.filter(c => c.tipo !== 'tutoria_curso')
  }, [clases, showTutoriasCurso])

  const courseGroups = useMemo(() => {
    const map = new Map<string, { curso: Curso; clases: Clase[] }>()
    for (const c of clasesVisibles) {
      if (!c.cursos) continue
      const key = c.cursos.id
      if (!map.has(key)) map.set(key, { curso: c.cursos, clases: [] })
      map.get(key)!.clases.push(c)
    }
    return Array.from(map.values())
  }, [clasesVisibles])

  async function loadBitacoras() {
    if (weekDates.length === 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fechaMin = dateToStr(weekDates[0])
    const fechaMax = dateToStr(weekDates[weekDates.length - 1])
    const cursoIds = [...new Set(clases.map(c => c.cursos?.id).filter(Boolean))]
    if (cursoIds.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('bitacora_clase')
      .select('id, curso_id, fecha, estado, tema, actividades_json, observaciones, hora_inicio_real, sin_planificacion, razon_suspension')
      .eq('profesor_id', user.id)
      .in('curso_id', cursoIds)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax)

    const m = new Map<string, BitacoraEntry>()
    for (const b of (data ?? []) as { id: string; curso_id: string; fecha: string; estado: string; tema: string | null; actividades_json: unknown; observaciones: string | null; hora_inicio_real: string | null; sin_planificacion: boolean; razon_suspension: string | null }[]) {
      m.set(`${b.curso_id}|${b.fecha}`, {
        id: b.id,
        estado: b.estado,
        tema: b.tema ?? '',
        actividades_json: Array.isArray(b.actividades_json) ? b.actividades_json as BitacoraEntry['actividades_json'] : [],
        observaciones: b.observaciones ?? null,
        hora_inicio_real: b.hora_inicio_real ?? null,
        sin_planificacion: b.sin_planificacion ?? false,
        razon_suspension: b.razon_suspension ?? null,
      })
    }
    setBitacoraMap(m)
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    const params = new URLSearchParams()
    if (viewMode === 'extensivo') params.set('view', 'extensivo')
    params.set('date', selectedDate)
    router.replace(`/dashboard/planificacion?${params.toString()}`, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate])

  useEffect(() => {
    if (isMounted) loadBitacoras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, clases.length, isMounted])

  // Calcular cuántas clases hay sin planificar esta semana
  const sinPlanificar = useMemo(() => {
    let count = 0
    for (const { curso, clases: grupoClases } of courseGroups) {
      for (const date of weekDates) {
        const dayName = DIAS_LONG[date.getDay()]
        const clase = getClaseForDay(grupoClases, dayName)
        if (!clase) continue
        const key = `${curso.id}|${dateToStr(date)}`
        const entry = bitacoraMap.get(key)
        if (!entry) count++
      }
    }
    return count
  }, [courseGroups, weekDates, bitacoraMap])

  function handleToggleExpand(cursoId: string) {
    setExpanded(prev => prev === cursoId ? null : cursoId)
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function renderCellContent(clase: Clase, fecha: string, cursoId: string) {
    const key = `${cursoId}|${fecha}`
    const entry = bitacoraMap.get(key)
    const isTutoria = clase.tipo === 'tutoria_curso'

    const cursoInfo = courseGroups.find(g => g.curso.id === cursoId)?.curso
    const fechaInicio = cursoInfo?.fecha_inicio
    const fechaFin = cursoInfo?.fecha_fin
    const fueraDeRango = (fechaInicio && fecha < fechaInicio) || (fechaFin && fecha > fechaFin)

    if (fueraDeRango) {
      return (
        <div className="w-full h-full min-h-[52px] p-2 rounded-lg bg-gray-800/20 border border-gray-700/30 flex items-center justify-center">
          <span className="text-gray-700 text-[10px] text-center leading-tight">Fuera del<br/>período</span>
        </div>
      )
    }

    const renderBadges = () => (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {isTutoria && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">👨‍🏫 Tutoría</span>}
        {clase.centro_computo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">💻 Cómputo</span>}
      </div>
    )

    if (entry?.estado === 'suspendido') {
      const reactKey = `${cursoId}|${fecha}`
      return (
        <div className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-red-950/30 border border-red-800/40 flex flex-col gap-1">
          <div className="text-red-400 text-xs font-medium">🚫 Suspendida</div>
          {renderBadges()}
          <div className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
          {entry.razon_suspension && (
            <div className="text-gray-400 text-[10px] leading-tight italic">{entry.razon_suspension}</div>
          )}
          <button
            onClick={() => handleReactivar(cursoId, fecha)}
            disabled={reactivandoKey === reactKey}
            className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 self-start"
          >
            {reactivandoKey === reactKey ? '…' : '↩ Reactivar'}
          </button>
        </div>
      )
    }

    if (!entry) {
      const espontaneaKey = `${cursoId}|${fecha}`
      return (
        <div className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-yellow-900/20 border border-yellow-500/30 flex flex-col gap-1">
          <button onClick={() => setPlanificarModal({ clase, fecha })} className="text-left w-full">
            <div className="text-yellow-400 text-xs font-medium">⚠ Sin planificar</div>
            {renderBadges()}
            <div className="text-gray-500 text-[10px] mt-0.5">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
          </button>
          <div className="flex gap-1 mt-0.5">
            <button
              onClick={() => setPlanificarModal({ clase, fecha })}
              className="text-[10px] text-green-400 hover:text-green-300 border border-green-700/40 px-1.5 py-0.5 rounded hover:bg-green-900/20 transition-colors"
            >
              + Planificar
            </button>
            <button
              onClick={() => handleTomarAsistenciaEspontanea(cursoId, fecha)}
              disabled={espontaneaLoading === espontaneaKey}
              className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded hover:bg-amber-900/20 transition-colors disabled:opacity-50"
            >
              {espontaneaLoading === espontaneaKey ? '…' : '📋 Lista'}
            </button>
          </div>
        </div>
      )
    }

    const dragHandlers = {
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        const e2 = bitacoraMap.get(`${cursoId}|${fecha}`)
        if (!e2) return
        setDragSource({ id: e2.id, cursoId, fecha, tema: e2.tema, actividades_json: e2.actividades_json, observaciones: e2.observaciones, asignatura: clase.cursos?.asignatura ?? '' })
      },
      onDragEnd: () => setDragSource(null),
    }

    const isDelConfirm = deleteConfirmKey === key
    const isDeleting   = deletingKey === key
    const isCumplido   = entry.estado === 'cumplido'

    const deleteBtn = (
      <div className="flex items-center gap-1">
        {isDelConfirm ? (
          <>
            <span className="text-[10px] text-red-400">{isCumplido ? '⚠ ¿Borrar clase cumplida?' : '¿Eliminar?'}</span>
            <button onClick={() => handleDeletePlan(cursoId, fecha)} disabled={isDeleting}
              className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50">
              {isDeleting ? '…' : 'Sí'}
            </button>
            <button onClick={() => setDeleteConfirmKey(null)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200">
              No
            </button>
          </>
        ) : (
          <button onClick={e => { e.stopPropagation(); setDeleteConfirmKey(key) }}
            className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-1 py-0.5 rounded hover:bg-red-900/20"
            title="Eliminar plan">
            🗑
          </button>
        )}
      </div>
    )

    if (entry.sin_planificacion && !isCumplido) {
      return (
        <div
          {...dragHandlers}
          className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-amber-900/20 border border-amber-500/30 flex flex-col gap-1"
        >
          <button onClick={() => setPlanificarModal({ clase, fecha })} className="text-left w-full">
            <div className="text-amber-400 text-xs font-medium">⚠ Sin plan</div>
            {renderBadges()}
            <div className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
          </button>
          <div className="flex gap-1 items-center flex-wrap">
            <Link
              href={`/dashboard/modo-clase/${entry.id}`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-white font-semibold bg-brand-600 hover:bg-brand-500 px-1.5 py-0.5 rounded text-center transition-colors"
            >
              ▶ Iniciar clase
            </Link>
            <button
              onClick={e => { e.stopPropagation(); setPlanificarModal({ clase, fecha }) }}
              className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
            >
              ✏ Agregar plan
            </button>
            <Link
              href={`/dashboard/cursos/${cursoId}/pase-lista`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors"
            >
              📋 Lista
            </Link>
            {deleteBtn}
          </div>
        </div>
      )
    }

    if (isCumplido) {
      return (
        <div
          {...dragHandlers}
          className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-emerald-900/20 border border-emerald-500/30 flex flex-col gap-1"
        >
          <button onClick={() => setPlanificarModal({ clase, fecha })} className="text-left w-full">
            <div className="text-emerald-400 text-xs font-medium">✓ Cumplido</div>
            {renderBadges()}
            <div className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
            {entry.tema && <div className="text-gray-300 text-[10px] leading-tight">{truncarTema(entry.tema)}</div>}
          </button>
          <div className="flex gap-1 items-center flex-wrap">
            <Link
              href={`/dashboard/modo-clase/${entry.id}`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-1.5 py-0.5 rounded text-center hover:bg-gray-800 transition-colors"
            >
              Ver resumen
            </Link>
            {entry.actividades_json?.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); abrirTrasladoPlan(entry.id, entry.actividades_json, clase.curso_id) }}
                className="text-[10px] text-amber-500 hover:text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
                title="Trasladar actividades a otro plan"
              >
                →
              </button>
            )}
            {deleteBtn}
          </div>
        </div>
      )
    }

    return (
      <div
        {...dragHandlers}
        className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-sky-900/20 border border-sky-500/30 flex flex-col gap-1"
      >
        <button onClick={() => setPlanificarModal({ clase, fecha })} className="text-left w-full">
          <div className="text-sky-400 text-xs font-medium">Planificado</div>
          {renderBadges()}
          <div className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
          {entry.tema && <div className="text-gray-300 text-[10px] leading-tight">{truncarTema(entry.tema)}</div>}
        </button>
        <div className="flex gap-1 items-center flex-wrap">
          <Link
            href={`/dashboard/modo-clase/${entry.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-white font-semibold bg-brand-600 hover:bg-brand-500 px-1.5 py-0.5 rounded text-center transition-colors"
          >
            ▶ Iniciar clase
          </Link>
          {entry.actividades_json?.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); abrirTrasladoPlan(entry.id, entry.actividades_json, clase.curso_id) }}
              className="text-[10px] text-amber-500 hover:text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
              title="Trasladar actividades a otro plan"
            >
              →
            </button>
          )}
          {deleteBtn}
        </div>
      </div>
    )
  }

  function renderTipoBadge(clase: Clase) {
    if (clase.tipo === 'tutoria_curso') {
      return <span className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-600/30 px-1.5 py-0.5 rounded-full">Tutoría Curso</span>
    }
    return <span className="text-[10px] bg-sky-900/40 text-sky-300 border border-sky-600/30 px-1.5 py-0.5 rounded-full">Clase</span>
  }

  function renderDetailRow(grupo: { curso: Curso; clases: Clase[] }) {
    const rowsWithClase = weekDates
      .map(date => {
        const dayName = DIAS_LONG[date.getDay()]
        const clase = getClaseForDay(grupo.clases, dayName)
        return clase ? { date, clase } : null
      })
      .filter(Boolean) as { date: Date; clase: Clase }[]

    if (rowsWithClase.length === 0) {
      return (
        <div className="p-4 text-gray-500 text-xs">Sin clases esta semana.</div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 px-3 font-medium">Día</th>
              <th className="text-left py-2 px-3 font-medium">Hora</th>
              <th className="text-left py-2 px-3 font-medium">Tipo</th>
              <th className="text-left py-2 px-3 font-medium">Tema</th>
              <th className="text-left py-2 px-3 font-medium">Actividades</th>
              <th className="text-left py-2 px-3 font-medium">Estado</th>
              <th className="text-left py-2 px-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithClase.map(({ date, clase }) => {
              const fecha = dateToStr(date)
              const key = `${grupo.curso.id}|${fecha}`
              const entry = bitacoraMap.get(key)
              const dayLabel = `${DIAS_SHORT[date.getDay()]} ${date.getDate()}`

              return (
                <tr key={fecha} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-300">{dayLabel}</td>
                  <td className="py-2 px-3 text-gray-400">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</td>
                  <td className="py-2 px-3">
                    {clase.centro_computo
                      ? <span className="text-[10px] bg-violet-900/40 text-violet-300 border border-violet-600/30 px-1.5 py-0.5 rounded-full">Centro Cómputo</span>
                      : clase.tipo === 'tutoria_curso'
                        ? <span className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-600/30 px-1.5 py-0.5 rounded-full">Tutoría Curso</span>
                        : <span className="text-[10px] bg-sky-900/40 text-sky-300 border border-sky-600/30 px-1.5 py-0.5 rounded-full">Clase</span>
                    }
                  </td>
                  <td className="py-2 px-3 text-gray-300 max-w-[160px]">
                    {entry?.tema ? truncarTema(entry.tema) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2 px-3 text-gray-400">
                    {entry?.actividades_json?.length
                      ? <span className="text-sky-400">{entry.actividades_json.length}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="py-2 px-3">
                    {!entry && <span className="text-yellow-400 text-[10px]">Sin planificar</span>}
                    {entry?.estado === 'planificado' && <span className="text-sky-400 text-[10px]">Planificado</span>}
                    {entry?.estado === 'cumplido' && <span className="text-emerald-400 text-[10px]">Cumplido</span>}
                    {entry?.estado === 'suspendido' && (
                      <span className="text-red-400 text-[10px]">
                        🚫 Suspendida{entry.razon_suspension ? ` — ${entry.razon_suspension}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {entry?.estado === 'cumplido' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/dashboard/modo-clase/${entry.id}`}
                          className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors"
                        >
                          Ver resumen
                        </Link>
                        {entry.actividades_json?.length > 0 && (
                          <button
                            onClick={() => abrirTrasladoPlan(entry.id, entry.actividades_json, grupo.curso.id)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-600/30 px-2 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
                          >
                            → Trasladar act.
                          </button>
                        )}
                      </div>
                    )}
                    {entry?.estado === 'planificado' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/dashboard/modo-clase/${entry.id}`}
                          className="text-[10px] text-white font-semibold bg-brand-600 hover:bg-brand-500 px-2.5 py-0.5 rounded transition-colors whitespace-nowrap"
                        >
                          ▶ Iniciar clase
                        </Link>
                        <button
                          onClick={() => setPlanificarModal({ clase, fecha })}
                          className="text-[10px] text-sky-400 hover:text-sky-300 border border-sky-600/30 px-2 py-0.5 rounded hover:bg-sky-900/20 transition-colors"
                        >
                          Editar
                        </button>
{entry.actividades_json?.length > 0 && (
                          <button
                            onClick={() => abrirTrasladoPlan(entry.id, entry.actividades_json, grupo.curso.id)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-600/30 px-2 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
                          >
                            → Trasladar act.
                          </button>
                        )}
                      </div>
                    )}
                    {!entry && (
                      <button
                        onClick={() => setPlanificarModal({ clase, fecha })}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-600/30 px-2 py-0.5 rounded hover:bg-emerald-900/20 transition-colors"
                      >
                        + Planificar
                      </button>
                    )}
                    {entry?.estado === 'suspendido' && (
                      <button
                        onClick={() => handleReactivar(grupo.curso.id, fecha)}
                        disabled={reactivandoKey === key}
                        className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {reactivandoKey === key ? '…' : '↩ Reactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (!isMounted) {
    return <div className="space-y-4 animate-pulse"><div className="h-10 bg-gray-800 rounded-lg w-full"></div><div className="h-40 bg-gray-900 rounded-xl w-full"></div></div>
  }

  if (clases.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-gray-400 text-sm">No tienes horarios de clase configurados.</p>
        <p className="text-gray-600 text-xs mt-1">Configura tus cursos y horarios para comenzar a planificar.</p>
      </div>
    )
  }

  const hoyStr = dateToStr(new Date())
  const hoyDayName = DIAS_LONG[new Date().getDay()]
  const clasesDeHoy = clases.filter(c => c.dia_semana === hoyDayName)

  return (
    <div className="space-y-5">
      {/* Sección Hoy */}
      {weekOffset === 0 && clasesDeHoy.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <button
            onClick={() => setHoyOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
          >
            <span className="text-sm font-semibold text-white">Hoy</span>
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${hoyOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {hoyOpen && <div className="divide-y divide-gray-800">
            {clasesDeHoy.map(clase => {
              const entry = bitacoraMap.get(`${clase.cursos?.id ?? clase.curso_id}|${hoyStr}`)
              const suspendida = entry?.estado === 'suspendido'
              const sinPlan = !entry
              const cumplida = entry?.estado === 'cumplido'
              const enProgreso = !cumplida && !!entry?.hora_inicio_real
              const planificada = !cumplida && !enProgreso && !suspendida && !!entry

              const btnLabel = cumplida ? 'Ver resumen' : enProgreso ? 'Continuar clase' : 'Iniciar clase'
              const btnColor = cumplida
                ? 'bg-gray-700 hover:bg-gray-600'
                : enProgreso
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-brand-600 hover:bg-brand-500'

              return (
                <div key={clase.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-100 truncate">{clase.cursos?.asignatura ?? 'Curso'}</span>
                      {clase.centro_computo && (
                        <span className="px-1.5 py-0 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">💻 Cómputo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</span>
                      {entry?.tema && <span className="text-xs text-gray-400 truncate">· {truncarTema(entry.tema, 6)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {suspendida && (
                      <>
                        <span className="text-xs text-red-400 font-medium">
                          🚫 Suspendida{entry?.razon_suspension ? ` — ${entry.razon_suspension}` : ''}
                        </span>
                        <button
                          onClick={() => handleReactivar(clase.cursos?.id ?? clase.curso_id, hoyStr)}
                          disabled={reactivandoKey === `${clase.cursos?.id ?? clase.curso_id}|${hoyStr}`}
                          className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          ↩ Reactivar
                        </button>
                      </>
                    )}
                    {sinPlan && (
                      <button
                        onClick={() => setPlanificarModal({ clase, fecha: hoyStr })}
                        className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-600/30 px-3 py-1.5 rounded-lg hover:bg-yellow-900/20 transition-colors"
                      >
                        + Planificar
                      </button>
                    )}
                    {planificada && (
                      <button
                        onClick={() => setPlanificarModal({ clase, fecha: hoyStr })}
                        className="text-xs text-gray-400 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Editar plan
                      </button>
                    )}
                    {entry && !suspendida && (
                      <Link
                        href={`/dashboard/modo-clase/${entry.id}`}
                        className={`${btnColor} text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap`}
                      >
                        {btnLabel}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>}
        </div>
      )}

      {/* Toggle vista */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(['semana', 'extensivo'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              viewMode === mode
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {mode === 'semana' ? '📅 Semana' : '📋 Por clase'}
          </button>
        ))}
      </div>

      {/* Vista semanal — solo visible en modo semana */}
      {viewMode === 'semana' && <>

      {/* Header navegación */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navWeek(-1)} disabled={weekOffset <= minOffset}
            title="Semana anterior"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
          >‹‹</button>
          <button onClick={() => navDay(-1)} disabled={weekOffset <= minOffset}
            title="Día anterior"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
          >‹</button>
          <div className="text-center min-w-[120px]">
            <div className="text-gray-300 text-sm font-medium leading-tight">{fmtRange(weekDates)}</div>
            {(() => { const sd = new Date(selectedDate + 'T12:00:00'); return (
              <div className="text-brand-400 text-[11px] font-medium">{DIAS_SHORT[sd.getDay()]} {sd.getDate()}</div>
            )})()}
          </div>
          <button onClick={() => navDay(1)} disabled={weekOffset >= maxOffset}
            title="Día siguiente"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
          >›</button>
          <button onClick={() => navWeek(1)} disabled={weekOffset >= maxOffset}
            title="Semana siguiente"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
          >››</button>
          {weekOffset !== 0 && (
            <button
              onClick={() => { setWeekOffset(0); const t = new Date(); t.setHours(0,0,0,0); if (t.getDay()===0) t.setDate(t.getDate()+1); setSelectedDate(dateToStr(t)) }}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors ml-1"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSuspender(true)}
            className="text-xs text-red-400 hover:text-red-300 border border-red-700/40 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors whitespace-nowrap"
          >
            🚫 Suspender clases
          </button>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-gray-400">Mostrar tutorías de curso</span>
            <button
              onClick={() => setShowTutoriasCurso(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${showTutoriasCurso ? 'bg-teal-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showTutoriasCurso ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Aviso clases sin planificar */}
      {sinPlanificar > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <span className="text-yellow-400 text-sm">⚠</span>
          <span className="text-yellow-300 text-sm">
            {sinPlanificar} {sinPlanificar === 1 ? 'clase sin planificar' : 'clases sin planificar'} esta semana
          </span>
        </div>
      )}

      {courseGroups.length === 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
          <p className="text-gray-500 text-sm">No hay clases para mostrar con los filtros actuales.</p>
        </div>
      )}

      {/* Grid principal */}
      {courseGroups.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          {/* Header días */}
          <div className="grid border-b border-gray-800" style={{ gridTemplateColumns: 'minmax(180px, 1fr) repeat(6, minmax(0, 1fr))' }}>
            <div className="px-3 py-2.5 text-xs text-gray-600 font-medium">Asignatura</div>
            {weekDates.map(date => {
              const isSelDay = dateToStr(date) === selectedDate
              return (
                <button key={date.toISOString()} onClick={() => setSelectedDate(dateToStr(date))}
                  className={`px-2 py-2.5 text-center w-full transition-colors ${isSelDay ? 'bg-brand-900/40 border-b-2 border-brand-500' : 'hover:bg-gray-800/40'}`}>
                  <div className={`text-xs font-medium ${isSelDay ? 'text-brand-300' : 'text-gray-400'}`}>
                    {DIAS_SHORT[date.getDay()]} {date.getDate()}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Filas por curso */}
          {courseGroups.map(({ curso, clases: grupoClases }) => {
            const isExpanded = expanded === curso.id

            // Calcular progreso
            const slotsEstaSemana = weekDates
              .map(d => ({ date: d, clase: getClaseForDay(grupoClases, DIAS_LONG[d.getDay()]) }))
              .filter(s => s.clase !== undefined)
            const total = slotsEstaSemana.length
            const planificados = slotsEstaSemana.filter(s => {
              const key = `${curso.id}|${dateToStr(s.date)}`
              return bitacoraMap.has(key)
            }).length
            const pct = total > 0 ? Math.round((planificados / total) * 100) : 0
            const tieneTutoriaCurso = grupoClases.some(c => c.tipo === 'tutoria_curso')
            const tieneCentroComputo = grupoClases.some(c => c.centro_computo)

            return (
              <div key={curso.id} className="border-b border-gray-800 last:border-b-0">
                {/* Fila del curso */}
                <div className="grid hover:bg-gray-800/30" style={{ gridTemplateColumns: 'minmax(180px, 1fr) repeat(6, minmax(0, 1fr))' }}>
                  {/* Celda nombre */}
                  <div className="px-3 py-2">
                    <button
                      onClick={() => handleToggleExpand(curso.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-start gap-1.5 flex-wrap mb-1.5">
                        <span className="text-gray-200 text-xs font-medium group-hover:text-white transition-colors leading-tight">{curso.asignatura}</span>
                        <span className={`text-gray-400 text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mb-1.5">
                        {tieneTutoriaCurso && (
                          <span className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-600/30 px-1.5 py-0 rounded-full">Tutoría Curso</span>
                        )}
                        {tieneCentroComputo && (
                          <span className="text-[10px] bg-violet-900/40 text-violet-300 border border-violet-600/30 px-1.5 py-0 rounded-full">💻</span>
                        )}
                      </div>
                      {total > 0 && (
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>{planificados}/{total}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Celdas por día */}
                  {weekDates.map(date => {
                    const dayName = DIAS_LONG[date.getDay()]
                    const clase = getClaseForDay(grupoClases, dayName)
                    const fecha = dateToStr(date)
                    const targetKey = `${curso.id}|${fecha}`
                    const targetEntry = bitacoraMap.get(targetKey)
                    const isCompletedTarget = targetEntry?.estado === 'cumplido' || targetEntry?.estado === 'suspendido'
                    const sameSource = dragSource?.cursoId === curso.id && dragSource?.fecha === fecha
                    const isEmptyTarget = !targetEntry
                    const isDraggingCompleted = dragSource && bitacoraMap.get(`${dragSource.cursoId}|${dragSource.fecha}`)?.estado === 'cumplido'

                    return (
                      <div
                        key={fecha}
                        className={`p-1.5 transition-colors ${fecha === selectedDate ? 'bg-brand-900/10' : ''} ${dragOverKey === targetKey ? 'ring-2 ring-blue-500/50 rounded-xl' : ''}`}
                        onDragOver={e => {
                          if (!dragSource || sameSource) return
                          if (isCompletedTarget) return
                          e.preventDefault()
                          setDragOverKey(targetKey)
                        }}
                        onDragEnter={e => {
                          if (!dragSource || sameSource) return
                          if (isCompletedTarget) return
                          e.preventDefault()
                          setDragOverKey(targetKey)
                        }}
                        onDragLeave={() => {
                          if (dragOverKey === targetKey) setDragOverKey(null)
                        }}
                        onDrop={e => {
                          if (!dragSource || sameSource) return
                          if (isCompletedTarget) return
                          e.preventDefault()
                          const targetData = {
                            cursoId: curso.id,
                            fecha,
                            hasPlan: !isEmptyTarget,
                            asignatura: curso.asignatura,
                            tema: targetEntry?.tema,
                          }
                          setDragTarget(targetData)
                          setDragModalPayload({ source: dragSource, target: targetData })
                          setDragOverKey(null)
                        }}
                      >
                        {clase
                          ? renderCellContent(clase, fecha, curso.id)
                          : <div className="min-h-[52px] rounded-lg bg-gray-800/30" />
                        }
                      </div>
                    )
                  })}
                </div>

                {/* Fila expandida */}
                {isExpanded && (
                  <div className="border-t border-gray-800 bg-gray-950/50">
                    <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-800/50">
                      <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Detalle — {curso.asignatura}</span>
                      {renderTipoBadge(grupoClases[0])}
                    </div>
                    {renderDetailRow({ curso, clases: grupoClases })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>}

      {/* Herramientas */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Herramientas de clase</p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowGenerador(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-brand-900/30 hover:bg-brand-900/50 border border-brand-700/50 text-sm text-brand-200 transition-colors"
          >
            <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.75.75 0 01-.53.22H9.77a.75.75 0 01-.53-.22l-.347-.347z" />
            </svg>
            Generar contenido semanal
          </button>
          <Link
            href="/dashboard/herramientas"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Ruleta de estudiantes
          </Link>
          <Link
            href="/dashboard/herramientas"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Agrupación aleatoria
          </Link>
        </div>
      </div>

      {/* Modales */}
      {planificarModal && (
        <PlanificarModal
          cursoId={planificarModal.clase.cursos?.id ?? planificarModal.clase.curso_id}
          asignatura={planificarModal.clase.cursos?.asignatura ?? ''}
          fecha={planificarModal.fecha}
          horaInicio={planificarModal.clase.hora_inicio}
          horaFin={planificarModal.clase.hora_fin}
          todosCursos={cursos}
          onClose={() => setPlanificarModal(null)}
          onSaved={() => {
            setPlanificarModal(null)
            loadBitacoras()
          }}
        />
      )}

{dragModalPayload && (
        <PlanDropModal
          source={{ asignatura: dragModalPayload.source.asignatura, fecha: dragModalPayload.source.fecha, tema: dragModalPayload.source.tema }}
          dest={{ asignatura: dragModalPayload.target.asignatura, fecha: dragModalPayload.target.fecha, hasPlan: dragModalPayload.target.hasPlan, tema: dragModalPayload.target.tema }}
          onConfirm={async (accion, colision) => {
            const result = await gestionarDragPlanificacion(
              dragModalPayload.source.id,
              dragModalPayload.target.cursoId,
              dragModalPayload.target.fecha,
              accion,
              colision,
              { tema: dragModalPayload.source.tema, actividades_json: dragModalPayload.source.actividades_json, observaciones: dragModalPayload.source.observaciones }
            )
            if (!result.error) {
              setDragSource(null)
              setDragTarget(null)
              loadBitacoras()
            }
            return result
          }}
          onClose={() => {
            setDragModalPayload(null)
            setDragSource(null)
            setDragTarget(null)
            setDragOverKey(null)
          }}
        />
      )}

      {viewMode === 'extensivo' && (
        <PlanificacionExtensiva clases={clases} todosCursos={cursos} />
      )}

      {showGenerador && (
        <GeneradorPanel
          clases={clases}
          onClose={() => setShowGenerador(false)}
        />
      )}

      {showSuspender && (
        <SuspenderClasesModal
          cursos={cursos}
          fechaInicioDefault={dateToStr(weekDates[0])}
          fechaFinDefault={dateToStr(weekDates[weekDates.length - 1])}
          onClose={() => setShowSuspender(false)}
          onSaved={() => loadBitacoras()}
        />
      )}

      {/* Panel de traslado de actividades */}
      {trasladoPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-gray-900 border border-amber-700/50 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-amber-300">Trasladar actividades</p>
              <button onClick={() => setTrasladoPanel(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            {cursos.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Curso destino:</p>
                <select
                  value={trasladoCursoId ?? ''}
                  onChange={e => handleTrasladoCursoChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-600"
                >
                  {cursos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.asignatura}{c.id === trasladoPanel?.sourceCursoId ? ' (este curso)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {trasladoDestinos === 'loading' && (
              <p className="text-xs text-gray-500">Buscando clases futuras…</p>
            )}
            {trasladoDestinos === null && (
              <p className="text-xs text-red-400">No hay clases futuras planificadas en ese curso.</p>
            )}
            {trasladoDestinos && trasladoDestinos !== 'loading' && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Clase destino:</p>
                  <select
                    value={trasladoTargetId ?? ''}
                    onChange={e => setTrasladoTargetId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-600"
                  >
                    {trasladoDestinos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fecha}{c.tema ? ` · ${c.tema.slice(0, 40)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 w-fit">
                  {(['move', 'copy'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setTrasladoMode(m)}
                      className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${
                        trasladoMode === m ? 'bg-amber-700 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {m === 'move' ? 'Mover' : 'Copiar'}
                    </button>
                  ))}
                </div>
                {trasladoMode === 'copy' && (
                  <p className="text-[10px] text-gray-500">La actividad queda también en este plan.</p>
                )}

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-500">Selecciona actividades:</p>
                  {trasladoPanel.actividades.map((a, i) => (
                    <label key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTrasladoIdx.has(i)}
                        onChange={e => {
                          const next = new Set(selectedTrasladoIdx)
                          if (e.target.checked) next.add(i)
                          else next.delete(i)
                          setSelectedTrasladoIdx(next)
                        }}
                        className="accent-amber-500 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-300 flex-1 truncate">{a.actividad}</span>
                    </label>
                  ))}
                </div>

                {trasladoError && <p className="text-xs text-red-400">{trasladoError}</p>}
                {trasladoOk && (
                  <p className="text-xs text-emerald-400 text-center">
                    ✓ {trasladoMode === 'move' ? 'Actividades movidas' : 'Actividades copiadas'}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={confirmarTrasladoPlan}
                    disabled={selectedTrasladoIdx.size === 0 || trasladoSaving || !trasladoTargetId}
                    className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    {trasladoSaving
                      ? (trasladoMode === 'move' ? 'Moviendo…' : 'Copiando…')
                      : `${trasladoMode === 'move' ? 'Mover' : 'Copiar'}${selectedTrasladoIdx.size > 0 ? ` (${selectedTrasladoIdx.size})` : ''}`}
                  </button>
                  <button onClick={() => setTrasladoPanel(null)} className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
