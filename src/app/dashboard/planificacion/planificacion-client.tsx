'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PlanificarModal } from '@/components/agenda/PlanificarModal'
import { ReplanificarModal } from '@/components/agenda/ReplanificarModal'
import { DragDropConfirmModal } from '@/components/agenda/DragDropConfirmModal'
import { gestionarDragPlanificacion, type AccionDrag } from '@/lib/actions/bitacora'

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

function getClaseForDay(clases: Clase[], dayName: string): Clase | undefined {
  return clases.find(c => c.dia_semana === dayName)
}

function truncarTema(tema: string, maxWords = 8): string {
  const words = tema.trim().split(/\s+/)
  if (words.length <= maxWords) return tema
  return words.slice(0, maxWords).join(' ') + '…'
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  clases: Clase[]
  profesorId: string
}

export function PlanificacionClient({ clases, profesorId: _profesorId }: Props) {
  const supabase = createClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [bitacoraMap, setBitacoraMap] = useState<Map<string, BitacoraEntry>>(new Map())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showTutoriasCurso, setShowTutoriasCurso] = useState(false)
  const [planificarModal, setPlanificarModal] = useState<{
    clase: Clase
    fecha: string
  } | null>(null)
  const [replanificarModal, setReplanificarModal] = useState<{
    cursoId: string
    asignatura: string
    fecha: string
    tema: string
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

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

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
      .select('id, curso_id, fecha, estado, tema, actividades_json, observaciones, hora_inicio_real')
      .eq('profesor_id', user.id)
      .in('curso_id', cursoIds)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax)

    const m = new Map<string, BitacoraEntry>()
    for (const b of (data ?? []) as { id: string; curso_id: string; fecha: string; estado: string; tema: string | null; actividades_json: unknown; observaciones: string | null; hora_inicio_real: string | null }[]) {
      m.set(`${b.curso_id}|${b.fecha}`, {
        id: b.id,
        estado: b.estado,
        tema: b.tema ?? '',
        actividades_json: Array.isArray(b.actividades_json) ? b.actividades_json as BitacoraEntry['actividades_json'] : [],
        observaciones: b.observaciones ?? null,
        hora_inicio_real: b.hora_inicio_real ?? null,
      })
    }
    setBitacoraMap(m)
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) loadBitacoras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, clases.length, isMounted])

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

    const renderBadges = () => (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {isTutoria && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">👨‍🏫 Tutoría</span>}
        {clase.centro_computo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">💻 Cómputo</span>}
      </div>
    )

    if (!entry) {
      return (
        <button
          onClick={() => setPlanificarModal({ clase, fecha })}
          className="w-full h-full min-h-[52px] text-left p-2 rounded-lg bg-yellow-900/20 border border-yellow-500/30 hover:bg-yellow-900/30 transition-colors"
        >
          <div className="text-yellow-400 text-xs font-medium">⚠ Sin planificar</div>
          {renderBadges()}
          <div className="text-gray-500 text-[10px] mt-0.5">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</div>
        </button>
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

    if (entry.estado === 'cumplido') {
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
          <Link
            href={`/dashboard/modo-clase/${entry.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-1.5 py-0.5 rounded text-center hover:bg-gray-800 transition-colors"
          >
            Ver resumen
          </Link>
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
        <Link
          href={`/dashboard/modo-clase/${entry.id}`}
          onClick={e => e.stopPropagation()}
          className="text-[10px] text-white font-semibold bg-brand-600 hover:bg-brand-500 px-1.5 py-0.5 rounded text-center transition-colors"
        >
          ▶ Iniciar clase
        </Link>
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
                  </td>
                  <td className="py-2 px-3">
                    {entry?.estado === 'cumplido' && (
                      <Link
                        href={`/dashboard/modo-clase/${entry.id}`}
                        className="text-[10px] text-gray-400 hover:text-gray-200 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors"
                      >
                        Ver resumen
                      </Link>
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
                        <button
                          onClick={() => setReplanificarModal({
                            cursoId: grupo.curso.id,
                            asignatura: grupo.curso.asignatura,
                            fecha,
                            tema: entry.tema,
                          })}
                          className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-600/30 px-2 py-0.5 rounded hover:bg-amber-900/20 transition-colors"
                        >
                          Replanificar
                        </button>
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
    <div className="space-y-4">
      {/* Sección Hoy */}
      {weekOffset === 0 && clasesDeHoy.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Hoy</span>
          </div>
          <div className="divide-y divide-gray-800">
            {clasesDeHoy.map(clase => {
              const entry = bitacoraMap.get(`${clase.cursos?.id ?? clase.curso_id}|${hoyStr}`)
              const sinPlan = !entry
              const cumplida = entry?.estado === 'cumplido'
              const enProgreso = !cumplida && !!entry?.hora_inicio_real
              const planificada = !cumplida && !enProgreso && !!entry

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
                    {entry && (
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
          </div>
        </div>
      )}

      {/* Header navegación */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            ←
          </button>
          <span className="text-gray-300 text-sm font-medium">{fmtRange(weekDates)}</span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            →
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Hoy
            </button>
          )}
        </div>

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
            {weekDates.map(date => (
              <div key={date.toISOString()} className="px-2 py-2.5 text-center">
                <div className="text-xs text-gray-400 font-medium">
                  {DIAS_SHORT[date.getDay()]} {date.getDate()}
                </div>
              </div>
            ))}
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
                    const isCompletedTarget = targetEntry?.estado === 'cumplido'
                    const sameSource = dragSource?.cursoId === curso.id && dragSource?.fecha === fecha
                    const isEmptyTarget = !targetEntry
                    const isDraggingCompleted = dragSource && bitacoraMap.get(`${dragSource.cursoId}|${dragSource.fecha}`)?.estado === 'cumplido'

                    return (
                      <div
                        key={fecha}
                        className={`p-1.5 ${dragOverKey === targetKey ? 'ring-2 ring-blue-500/50 rounded-xl' : ''}`}
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

      {/* Herramientas */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Herramientas de clase</p>
        <div className="flex gap-3 flex-wrap">
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
          clases={clases}
          allowCopyMove={(() => {
            const key = `${planificarModal.clase.cursos?.id ?? planificarModal.clase.curso_id}|${planificarModal.fecha}`
            const entry = bitacoraMap.get(key)
            return entry?.estado === 'cumplido'
          })()}
          onClose={() => setPlanificarModal(null)}
          onSaved={() => {
            setPlanificarModal(null)
            loadBitacoras()
          }}
        />
      )}

      {replanificarModal && (
        <ReplanificarModal
          cursoId={replanificarModal.cursoId}
          asignatura={replanificarModal.asignatura}
          origenFecha={replanificarModal.fecha}
          origenTema={replanificarModal.tema}
          onClose={() => setReplanificarModal(null)}
          onDone={() => {
            setReplanificarModal(null)
            loadBitacoras()
          }}
        />
      )}

      {dragModalPayload && (
        <DragDropConfirmModal
          source={{ asignatura: dragModalPayload.source.asignatura, fecha: dragModalPayload.source.fecha, tema: dragModalPayload.source.tema }}
          dest={{
            asignatura: dragModalPayload.target.asignatura,
            fecha: dragModalPayload.target.fecha,
            hasPlan: dragModalPayload.target.hasPlan,
            tema: dragModalPayload.target.tema,
          }}
          onConfirm={async mode => {
            setDragError(null)
            const colision = dragModalPayload.target.hasPlan ? 'reemplazar' : 'vacio'
            if (mode.action !== 'copiar' && mode.action !== 'mover') {
              return { error: 'Acción inválida' }
            }
            const result = await gestionarDragPlanificacion(
              dragModalPayload.source.id,
              dragModalPayload.target.cursoId,
              dragModalPayload.target.fecha,
              mode.action,
              colision,
              {
                tema: dragModalPayload.source.tema,
                actividades_json: dragModalPayload.source.actividades_json,
                observaciones: dragModalPayload.source.observaciones,
              }
            )
            if (result.error) {
              setDragError(result.error)
              return { error: result.error }
            }
            setDragModalPayload(null)
            setDragSource(null)
            setDragTarget(null)
            loadBitacoras()
            return {}
          }}
          onClose={() => {
            setDragModalPayload(null)
            setDragSource(null)
            setDragTarget(null)
            setDragOverKey(null)
            setDragError(null)
          }}
        />
      )}
    </div>
  )
}
