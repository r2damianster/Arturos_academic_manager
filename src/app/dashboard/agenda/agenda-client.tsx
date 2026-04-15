'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crearEvento, actualizarEvento, eliminarEvento } from '@/lib/actions/eventos'
import { activarHorario, asignarTutoriaDirecta, eliminarReserva, type DuracionTutoria } from '@/lib/actions/tutorias'
import type { Evento, EventoInput } from '@/lib/actions/eventos'
import { PlanificarModal } from '@/components/agenda/PlanificarModal'
import { PasarListaModal } from '@/components/agenda/PasarListaModal'
import { ReplanificarModal } from '@/components/agenda/ReplanificarModal'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HorarioTutoria {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  profesor_id: string
  disponible_hasta: string | null
}

interface Reserva {
  id: number
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  telefono: string
  fecha: string
  horario_id: number
  estado: string
  notas?: string | null
}

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo: boolean
  cursos: { id: string; asignatura: string } | null
  anuncios_tutoria_curso?: { estudiante_id: string; fecha: string; estudiantes: { nombre: string } }[]
}

interface Estudiante {
  id: string
  nombre: string
  email: string
  auth_user_id: string | null
  carrera?: string | null
  telefono?: string | null
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  personal:  { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/40', dot: 'bg-purple-500' },
  académico: { bg: 'bg-teal-500/15',   text: 'text-teal-300',   border: 'border-teal-500/40',   dot: 'bg-teal-500' },
  laboral:   { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/40',  dot: 'bg-amber-500' },
  social:    { bg: 'bg-pink-500/15',   text: 'text-pink-300',   border: 'border-pink-500/40',   dot: 'bg-pink-500' },
  otro:      { bg: 'bg-gray-500/15',   text: 'text-gray-300',   border: 'border-gray-500/40',   dot: 'bg-gray-500' },
}
function evClr(tipo: string) { return TIPO_COLOR[tipo] ?? TIPO_COLOR.otro }

// ─── Date / time helpers ─────────────────────────────────────────────────────

const DIAS_LONG  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_S    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DURACIONES: { value: DuracionTutoria; label: string }[] = [
  { value: '1s', label: '1 semana' }, { value: '2s', label: '2 semanas' },
  { value: '1m', label: '1 mes' },   { value: '2m', label: '2 meses' },
  { value: '3m', label: '3 meses' }, { value: '4m', label: '4 meses' },
  { value: 'permanente', label: 'Permanente' },
]

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }
function toMin(t: string)   { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function fromMin(t: number) { return `${fmt2(Math.floor(t / 60))}:${fmt2(t % 60)}` }
function fmt(t: string)     { return t?.slice(0, 5) ?? '' }

/** 6 days starting from today + weekOffset*7, skipping Sundays */
function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const start = new Date(today)
  if (today.getDay() === 0) start.setDate(start.getDate() + 1) // skip Sunday start
  start.setDate(start.getDate() + offset * 7)
  const dates: Date[] = []
  const cur = new Date(start)
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function fmtRange(dates: Date[]) {
  const a = dates[0], b = dates[dates.length - 1]
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${MESES_S[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MESES_S[a.getMonth()]} – ${b.getDate()} ${MESES_S[b.getMonth()]} ${b.getFullYear()}`
}

function isSlotActiveOnDate(h: HorarioTutoria, dateStr: string) {
  if (h.estado !== 'disponible') return false
  if (!h.disponible_hasta) return true
  return dateStr <= h.disponible_hasta
}

// ─── Event occurrence helpers ─────────────────────────────────────────────────

function eventOccursOnDay(ev: Evento, dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const [sy, sm, sd] = ev.fecha_inicio.split('-').map(Number)
  const [ey, em, ed] = ev.fecha_fin.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)
  if (!ev.recurrente) return date >= start && date <= end
  const hastaStr = ev.recurrencia_hasta ?? ev.fecha_fin
  const [hy, hm, hd] = hastaStr.split('-').map(Number)
  const hasta = new Date(hy, hm - 1, hd)
  if (date < start || date > hasta) return false
  if (ev.recurrencia === 'diaria') return true
  if (ev.recurrencia === 'semanal') return (ev.recurrencia_dias ?? []).includes(dow)
  if (ev.recurrencia === 'mensual') return date.getDate() === start.getDate()
  return false
}

// ─── Dynamic viewport ─────────────────────────────────────────────────────────

const DEFAULT_START = 8 * 60
const DEFAULT_END   = 18 * 60

function getDynamicSlots(horarios: HorarioTutoria[], clases: Clase[], eventos: Evento[], weekDates: Date[]): string[] {
  const weekStrs = weekDates.map(dateToStr)
  const allMins: number[] = []

  for (const c of clases) allMins.push(toMin(fmt(c.hora_inicio)), toMin(fmt(c.hora_fin)))
  for (const h of horarios) allMins.push(toMin(fmt(h.hora_inicio)), toMin(fmt(h.hora_fin)))
  for (const ev of eventos) {
    if (!ev.todo_el_dia && ev.hora_inicio && weekStrs.some(ds => eventOccursOnDay(ev, ds))) {
      allMins.push(toMin(ev.hora_inicio))
      if (ev.hora_fin) allMins.push(toMin(ev.hora_fin))
    }
  }

  if (allMins.length === 0) return buildSlots(DEFAULT_START, DEFAULT_END)

  const tMin = Math.max(0,    Math.floor((Math.min(...allMins) - 60) / 30) * 30)
  const tMax = Math.min(1440, Math.ceil( (Math.max(...allMins) + 60) / 30) * 30)
  return buildSlots(tMin, tMax)
}

function buildSlots(startMin: number, endMin: number): string[] {
  const slots: string[] = []
  for (let m = startMin; m < endMin; m += 30) slots.push(fromMin(m))
  return slots
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function emptyForm(day: string, hora?: string): EventoInput {
  return {
    titulo: '', descripcion: '', tipo: 'personal',
    fecha_inicio: day, fecha_fin: day,
    hora_inicio: hora ?? null,
    hora_fin: hora ? fromMin(toMin(hora) + 60) : null,
    todo_el_dia: !hora,
    recurrente: false, recurrencia: null, recurrencia_dias: [], recurrencia_hasta: null,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H = 48 // px per 30-min slot

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  eventos: Evento[]
  clases: Clase[]
  horarios: HorarioTutoria[]
  reservas: Reserva[]
  estudiantes: Estudiante[]
  profesorId: string
  profesorNombre: string
}

export function AgendaClient({ eventos: initEv, clases, horarios: initH, reservas: initR, estudiantes }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = dateToStr(new Date())

  const [eventos,    setEventos]    = useState<Evento[]>(initEv)
  const [horarios,   setHorarios]   = useState<HorarioTutoria[]>(initH)
  const [reservas, setReservas] = useState<Reserva[]>(initR)
  const [weekOffset, setWeekOffset] = useState(0)

  // Personal event form
  const [showEvForm,    setShowEvForm]    = useState(false)
  const [editingEvento, setEditingEvento] = useState<string | null>(null) // id del evento siendo editado
  const [evForm,        setEvForm]        = useState<EventoInput>(emptyForm(today))
  const [evSaving,      setEvSaving]      = useState(false)
  const [selEvento,     setSelEvento]     = useState<Evento | null>(null)

  // Tutoría slot UI
  const [durPicker,   setDurPicker]   = useState<number | null>(null)
  const [durDateStr,  setDurDateStr]  = useState<string | null>(null)
  const [durSaving,   setDurSaving]   = useState(false)
  const [popover,     setPopover]     = useState<string | null>(null) // `${horarioId}|${dateStr}`

  // Planificación / pase de lista / replanificación desde agenda
  type ClaseModal = { clase: Clase; fecha: string; mode: 'planificar' | 'lista' }
  const [claseModal,    setClaseModal]    = useState<ClaseModal | null>(null)
  const [clasePicker,   setClasePicker]   = useState<{ clase: Clase; fecha: string } | null>(null)
  const clasePickerRef = useRef<HTMLDivElement>(null)

  // Replanificar
  type ClaseReplanificar = { cursoId: string; asignatura: string; fecha: string; tema: string; bitacoraId: string }
  const [replanificar,  setReplanificar]  = useState<ClaseReplanificar | null>(null)

  // Cerrar clase picker al hacer click fuera
  useEffect(() => {
    if (!clasePicker) return
    function handleClick(e: MouseEvent) {
      if (clasePickerRef.current && !clasePickerRef.current.contains(e.target as Node)) {
        setClasePicker(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [clasePicker])

  // Direct assignment
  const [showAssign,  setShowAssign]  = useState(false)
  const [assignEst,   setAssignEst]   = useState('')
  const [assignHor,   setAssignHor]   = useState('')
  const [assignDate,  setAssignDate]  = useState(today)
  const [assignNota,  setAssignNota]  = useState('')
  const [assigning,   setAssigning]   = useState(false)

  const [, startTransition] = useTransition()

  // Bitácoras de la semana visible (para badges en bloques de clase)
  const [bitacoraMap, setBitacoraMap] = useState<Map<string, { estado: string; tema: string }>>(new Map())

  // ── Derived ────────────────────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const timeSlots = useMemo(() => getDynamicSlots(horarios, clases, eventos, weekDates), [horarios, clases, eventos, weekDates])

  // Cargar bitácoras de la semana visible para mostrar badges
  useEffect(() => {
    const fechaMin = dateToStr(weekDates[0])
    const fechaMax = dateToStr(weekDates[weekDates.length - 1])
    const cursoIds = [...new Set(clases.map(c => c.cursos?.id).filter(Boolean))]
    if (cursoIds.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('bitacora_clase')
      .select('curso_id, fecha, estado, tema')
      .in('curso_id', cursoIds)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        const m = new Map<string, { estado: string; tema: string }>()
        for (const b of (data ?? [])) m.set(`${b.curso_id}|${b.fecha}`, { estado: b.estado, tema: b.tema ?? '' })
        setBitacoraMap(m)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, clases.length])
  const slotStart = timeSlots.length ? toMin(timeSlots[0]) : DEFAULT_START


  // Map: reserva by horario_id|fecha
  const reservaMap = useMemo(() => {
    const m = new Map<string, Reserva>()
    for (const r of reservas) {
      if (r.estado === 'pendiente' || r.estado === 'confirmada')
        m.set(`${r.horario_id}|${r.fecha}`, r)
    }
    return m
  }, [reservas])

  // Personal events per day
  const eventosByDay = useMemo(() => {
    const map = new Map<string, Evento[]>()
    for (const d of weekDates) {
      const ds = dateToStr(d)
      map.set(ds, eventos.filter(ev => eventOccursOnDay(ev, ds)))
    }
    return map
  }, [eventos, weekDates])

  // ── Block positioning ──────────────────────────────────────────────────────

  function blockPos(startTime: string, endTime: string) {
    const startM = toMin(fmt(startTime))
    const endM   = toMin(fmt(endTime))
    const top    = ((startM - slotStart) / 30) * SLOT_H
    const height = Math.max(((endM - startM) / 30) * SLOT_H, SLOT_H * 0.6)
    return { top, height }
  }

  // ── Tutorías toggle ────────────────────────────────────────────────────────

  async function handleToggleSlot(h: HorarioTutoria, dateStr: string) {
    const reservaKey = `${h.id}|${dateStr}`
    if (reservaMap.has(reservaKey)) {
      setPopover(popover === reservaKey ? null : reservaKey)
      return
    }
    if (isSlotActiveOnDate(h, dateStr)) {
      // Deactivate: set disponible_hasta to day before
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const nuevoHasta = d.toISOString().split('T')[0]
      setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, disponible_hasta: nuevoHasta } : x))
      startTransition(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('horarios').update({ disponible_hasta: nuevoHasta }).eq('id', h.id)
      })
    } else {
      // Activate: show duration picker
      setDurPicker(h.id)
      setDurDateStr(dateStr)
    }
  }

  async function handleActivar(duracion: DuracionTutoria) {
    if (!durPicker) return
    setDurSaving(true)
    await activarHorario(durPicker, duracion)
    setDurSaving(false)
    setDurPicker(null)
    setDurDateStr(null)
    router.refresh()
  }

  // ── Personal events ────────────────────────────────────────────────────────

  function openEvForm(dateStr: string, hora?: string) {
    setSelEvento(null)
    setEvForm(emptyForm(dateStr, hora))
    setShowEvForm(true)
  }

  async function handleEvSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEvSaving(true)
    if (editingEvento) {
      const result = await actualizarEvento(editingEvento, evForm)
      if (!result.error) {
        setShowEvForm(false)
        setEditingEvento(null)
        router.refresh()
      }
    } else {
      const result = await crearEvento(evForm)
      if (!result.error) { setShowEvForm(false); router.refresh() }
    }
    setEvSaving(false)
  }

  function handleEvDelete(id: string) {
    setSelEvento(null)
    startTransition(async () => {
      await eliminarEvento(id)
      setEventos(prev => prev.filter(ev => ev.id !== id))
    })
  }

  function handleEliminarReserva(reservaId: number) {
    setPopover(null)
    setReservas(prev => prev.filter(r => r.id !== reservaId))
    startTransition(async () => {
      await eliminarReserva(reservaId)
    })
  }

  function openEvEdit(ev: Evento) {
    setSelEvento(null)
    setEditingEvento(ev.id)
    setEvForm({
      titulo: ev.titulo,
      descripcion: ev.descripcion,
      tipo: ev.tipo as EventoInput['tipo'],
      fecha_inicio: ev.fecha_inicio,
      fecha_fin: ev.fecha_fin,
      hora_inicio: ev.hora_inicio,
      hora_fin: ev.hora_fin,
      todo_el_dia: ev.todo_el_dia,
      recurrente: ev.recurrente,
      recurrencia: ev.recurrencia as EventoInput['recurrencia'],
      recurrencia_dias: ev.recurrencia_dias,
      recurrencia_hasta: ev.recurrencia_hasta,
    })
    setShowEvForm(true)
  }

  // ── Direct assignment ──────────────────────────────────────────────────────

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    const est = estudiantes.find(x => x.id === assignEst)
    if (!est) return
    setAssigning(true)
    await asignarTutoriaDirecta({
      horarioId:          Number(assignHor),
      fecha:              assignDate,
      authUserId:         est.auth_user_id ?? est.id,
      estudianteNombre:   est.nombre,
      estudianteEmail:    est.email,
      estudianteCarrera:  est.carrera ?? null,
      estudianteTelefono: est.telefono ?? null,
      nota:               assignNota || null,
    })
    setAssigning(false)
    setShowAssign(false)
    router.refresh()
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const nDisp    = horarios.filter(h => isSlotActiveOnDate(h, today)).length
  const nPending = reservas.filter(r => r.estado === 'pendiente' || r.estado === 'confirmada').length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(0)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors">Hoy</button>
            <button onClick={() => setWeekOffset(w => w - 1)} className="btn-ghost p-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)} className="btn-ghost p-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <span className="text-sm text-gray-300 font-medium">{fmtRange(weekDates)}</span>
            {/* Saltar a cualquier fecha (útil para editar asistencias pasadas) */}
            <input
              type="date"
              title="Ir a la semana de esta fecha"
              onChange={e => {
                if (!e.target.value) return
                const target = new Date(e.target.value + 'T12:00:00')
                const base = new Date(); base.setHours(12, 0, 0, 0)
                const diff = Math.round((target.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000))
                setWeekOffset(diff)
                e.target.value = ''
              }}
              className="text-xs bg-transparent border border-gray-700 rounded px-1.5 py-1 text-gray-400 hover:border-gray-500 focus:outline-none focus:border-gray-400 cursor-pointer w-8 focus:w-auto transition-all"
            />
            <a
              href={`/dashboard/agenda/imprimir?fecha=${dateToStr(weekDates[0])}&modo=semana`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs px-2 py-1"
              title="Exportar semana como PDF"
            >
              PDF semana
            </a>
            <a
              href={`/dashboard/agenda/imprimir?fecha=${today}&modo=dia`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs px-2 py-1"
              title="Exportar día de hoy como PDF"
            >
              PDF día
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg">
              <span className="text-emerald-400 font-semibold">{nDisp}</span>
              <span className="text-gray-500 ml-1">tutorías dispon.</span>
            </span>
            <span className="text-xs bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg">
              <span className="text-blue-400 font-semibold">{nPending}</span>
              <span className="text-gray-500 ml-1">reservas activas</span>
            </span>
            <button onClick={() => setShowAssign(true)} className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-300 transition-colors">
              Asignar tutoría
            </button>
            <button onClick={() => openEvForm(today)} className="btn-primary text-sm px-4 py-1.5">
              + Evento
            </button>
          </div>
        </div>

        {/* All-day row */}
        {weekDates.some(d => (eventosByDay.get(dateToStr(d)) ?? []).some(ev => ev.todo_el_dia)) && (
          <div className="flex border-b border-gray-800">
            <div className="w-14 flex-shrink-0 text-[10px] text-gray-600 flex items-center justify-end pr-2 py-1">todo día</div>
            {weekDates.map(date => {
              const ds = dateToStr(date)
              const allDay = (eventosByDay.get(ds) ?? []).filter(ev => ev.todo_el_dia)
              return (
                <div key={ds} className="flex-1 border-l border-gray-800 min-h-[24px] px-0.5 py-0.5 space-y-0.5">
                  {allDay.map(ev => {
                    const c = evClr(ev.tipo)
                    return (
                      <div key={ev.id} onClick={() => setSelEvento(ev)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer truncate ${c.bg} ${c.text} ${c.border}`}>
                        {ev.titulo}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Day headers */}
        <div className="flex border-b border-gray-800">
          <div className="w-14 flex-shrink-0" />
          {weekDates.map(date => {
            const ds = dateToStr(date)
            const isToday = ds === today
            const dow = date.getDay()
            return (
              <div key={ds} className={`flex-1 border-l border-gray-800 text-center py-2 ${isToday ? 'bg-brand-600/10' : ''}`}>
                <p className="text-xs text-gray-500">{DIAS_SHORT[dow]}</p>
                <p className={`text-sm font-semibold ${isToday ? 'text-brand-400' : 'text-gray-200'}`}>{date.getDate()}</p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: '72vh' }}>
          <div className="flex">
            {/* Time labels */}
            <div className="w-14 flex-shrink-0">
              {timeSlots.filter((_, i) => i % 2 === 0).map(slot => (
                <div key={slot} className="text-[10px] text-gray-600 text-right pr-2 flex items-start justify-end" style={{ height: SLOT_H * 2 }}>
                  <span className="mt-0.5">{slot}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map(date => {
              const ds      = dateToStr(date)
              const isToday = ds === today
              const diaNombre = DIAS_LONG[date.getDay()]

              // Classes for this day
              const dayClases = clases.filter(c => c.dia_semana === diaNombre)
              // Tutorías horarios for this day
              const dayHorarios = horarios.filter(h => h.dia_semana === diaNombre)
              // Personal events with time for this day
              const dayEventos = (eventosByDay.get(ds) ?? []).filter(ev => !ev.todo_el_dia && ev.hora_inicio)

              return (
                <div key={ds} className={`flex-1 border-l border-gray-800 relative`} style={{ height: timeSlots.length * SLOT_H }}>
                  {/* Slot rows — clickable to create personal event */}
                  {timeSlots.map((slot, si) => (
                    <div key={slot}
                      onClick={() => openEvForm(ds, slot)}
                      className={`absolute w-full border-b cursor-pointer hover:bg-gray-800/30 transition-colors ${si % 2 === 0 ? 'border-gray-800/60' : 'border-gray-800/20 border-dashed'} ${isToday ? 'bg-brand-600/3' : ''}`}
                      style={{ top: si * SLOT_H, height: SLOT_H }}
                    />
                  ))}

                  {/* ── Clase blocks (clickable: planificar / tomar lista) ── */}
                  {dayClases.map(c => {
                    const pos       = blockPos(c.hora_inicio, c.hora_fin)
                    const isTutoria = c.tipo === 'tutoria_curso'
                    const voyHoy    = c.anuncios_tutoria_curso?.filter(a => a.fecha === ds) ?? []
                    const voy       = voyHoy.length
                    const cursoId   = c.cursos?.id
                    const bitKey    = `${cursoId}|${ds}`
                    const bitEstado = cursoId ? bitacoraMap.get(bitKey)?.estado : undefined
                    const isOpen    = clasePicker?.clase.id === c.id && clasePicker?.fecha === ds

                    return (
                      <div key={c.id} className="absolute left-0.5 right-0.5 z-30"
                        style={{ top: pos.top + 1, height: pos.height - 2 }}>

                        {/* Bloque principal */}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setClasePicker(isOpen ? null : { clase: c, fecha: ds })
                          }}
                          className={`w-full h-full rounded border px-1.5 py-1 text-left transition-colors overflow-hidden
                            ${isTutoria
                              ? voy > 0
                                ? 'bg-orange-600/35 border-orange-400/70 hover:bg-orange-600/45'
                                : 'bg-orange-600/25 border-orange-500/50 hover:bg-orange-600/35'
                              : 'bg-blue-600/25 border-blue-500/50 hover:bg-blue-600/35'}`}>
                          <p className={`text-[11px] font-semibold leading-tight truncate
                            ${isTutoria ? 'text-orange-200' : 'text-blue-200'}`}>
                            {c.cursos?.asignatura ?? (isTutoria ? 'Tutoría grupal' : 'Clase')}
                          </p>
                          {pos.height >= SLOT_H && (
                            <p className="text-[10px] leading-none mt-0.5">
                              <span className="opacity-60">{fmt(c.hora_inicio)}–{fmt(c.hora_fin)}</span>
                              {voy > 0 && (
                                <span className="ml-1 text-orange-300 font-medium">· {voy} {voy === 1 ? 'asiste' : 'asisten'}</span>
                              )}
                            </p>
                          )}
                          {/* Badge de estado de planificación */}
                          {bitEstado && pos.height >= SLOT_H * 1.5 && (
                            <p className={`text-[10px] font-medium mt-0.5 ${bitEstado === 'cumplido' ? 'text-emerald-400' : 'text-sky-400'}`}>
                              {bitEstado === 'cumplido' ? '✓ Cumplido' : '📋 Planificado'}
                            </p>
                          )}
                        </button>

                        {/* Picker de acción */}
                        {isOpen && (
                          <div ref={clasePickerRef}
                            className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-1.5 min-w-[180px]"
                            onClick={e => e.stopPropagation()}>

                            {/* Estudiantes que confirmaron asistencia hoy */}
                            {isTutoria && voyHoy.length > 0 && (
                              <div className="px-3 py-2 mb-1 border-b border-gray-700">
                                <p className="text-[11px] text-orange-300 font-medium mb-1">
                                  Confirman asistencia ({voyHoy.length})
                                </p>
                                <ul className="space-y-0.5">
                                  {voyHoy.map((a, i) => (
                                    <li key={i} className="text-[11px] text-gray-300 truncate">
                                      · {a.estudiantes?.nombre ?? '—'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <button
                              onClick={() => { setClasePicker(null); setClaseModal({ clase: c, fecha: ds, mode: 'planificar' }) }}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2">
                              <span>📋</span><span>Planificar clase</span>
                            </button>
                            {bitEstado === 'planificado' && c.cursos?.id && (
                              <button
                                onClick={() => {
                                  const bit = bitacoraMap.get(`${c.cursos!.id}|${ds}`)
                                  setClasePicker(null)
                                  setReplanificar({
                                    cursoId: c.cursos!.id,
                                    asignatura: c.cursos!.asignatura,
                                    fecha: ds,
                                    tema: bit?.tema ?? '',
                                    bitacoraId: '',
                                  })
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2">
                                <span>↻</span><span>Replanificar</span>
                              </button>
                            )}
                            {c.cursos?.id && (
                              <button
                                onClick={() => { setClasePicker(null); setClaseModal({ clase: c, fecha: ds, mode: 'lista' }) }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2">
                                <span>✓</span><span>Tomar lista</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* ── Tutoría horario blocks (interactive) ── */}
                  {dayHorarios.map(h => {
                    const pos     = blockPos(h.hora_inicio, h.hora_fin)
                    const active  = isSlotActiveOnDate(h, ds)
                    const reserva = reservaMap.get(`${h.id}|${ds}`)
                    const popKey  = `${h.id}|${ds}`
                    const isOpen  = popover === popKey

                    return (
                      <div key={h.id} className={`absolute left-0.5 right-0.5 ${isOpen ? 'z-50' : 'z-20'}`} style={{ top: pos.top + 1, height: pos.height - 2 }}>
                        <button
                          onClick={e => { e.stopPropagation(); handleToggleSlot(h, ds) }}
                          className={`w-full h-full rounded border px-1.5 py-1 text-left transition-colors overflow-hidden ${
                            reserva
                              ? 'bg-violet-700/40 border-violet-500/60 hover:bg-violet-700/50'
                              : active
                              ? 'bg-emerald-600/25 border-emerald-500/40 hover:bg-emerald-600/35'
                              : 'bg-gray-700/20 border-gray-600/30 hover:bg-gray-700/30'
                          }`}
                        >
                          <p className={`text-[11px] font-semibold leading-tight truncate ${reserva ? 'text-violet-200' : active ? 'text-emerald-400' : 'text-gray-600'}`}>
                            {reserva ? reserva.estudiante_nombre : active ? 'Disponible' : 'No disponible'}
                          </p>
                          {pos.height >= SLOT_H && (
                            <p className={`text-[10px] leading-none mt-0.5 ${reserva ? 'text-violet-300/60' : 'opacity-50'}`}>
                              {fmt(h.hora_inicio)}–{fmt(h.hora_fin)}
                            </p>
                          )}
                        </button>

                        {/* Popover para reserva con detalle */}
                        {isOpen && reserva && (
                          <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl"
                            onClick={e => e.stopPropagation()}>
                            <p className="font-semibold text-white text-sm">{reserva.estudiante_nombre}</p>
                            {reserva.estudiante_carrera && <p className="text-xs text-gray-400">{reserva.estudiante_carrera}</p>}
                            {reserva.email && <p className="text-xs text-gray-500">{reserva.email}</p>}
                            {reserva.notas && <p className="text-xs text-gray-400 mt-1 italic">"{reserva.notas}"</p>}
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleEliminarReserva(reserva.id)}
                                className="flex-1 py-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors text-xs font-medium">
                                Cancelar reserva
                              </button>
                              <button onClick={() => setPopover(null)} className="text-xs text-gray-600 hover:text-gray-400 px-2">Cerrar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* ── Personal event blocks ── */}
                  {dayEventos.map(ev => {
                    const pos = blockPos(ev.hora_inicio!, ev.hora_fin ?? fromMin(toMin(ev.hora_inicio!) + 60))
                    const c = evClr(ev.tipo)
                    return (
                      <div key={ev.id}
                        onClick={e => { e.stopPropagation(); setSelEvento(ev) }}
                        className={`absolute left-0.5 right-0.5 rounded border px-1.5 py-1 cursor-pointer overflow-hidden z-30 ${c.bg} ${c.border}`}
                        style={{ top: pos.top + 1, height: pos.height - 2 }}>
                        <p className={`text-[11px] font-semibold leading-tight truncate ${c.text}`}>{ev.titulo}</p>
                        {pos.height >= SLOT_H && (
                          <p className={`text-[10px] opacity-70 leading-none mt-0.5 ${c.text}`}>
                            {fmt(ev.hora_inicio!)}{ev.hora_fin ? `–${fmt(ev.hora_fin)}` : ''}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 pt-3 mt-1 border-t border-gray-800 flex-wrap text-xs text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600/60 border border-blue-500/50" /> Clase</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-600/60 border border-orange-500/50" /> Tutoría grupal</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600/40 border border-emerald-500/40" /> Tutoría disponible</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-violet-600/40 border border-violet-500/40" /> Tutoría reservada</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-700/30 border border-gray-600/30" /> No disponible</div>
          {Object.entries(TIPO_COLOR).map(([tipo, c]) => (
            <div key={tipo} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} /><span className="capitalize">{tipo}</span></div>
          ))}
        </div>
      </div>

      {/* ── Duration picker (activar tutoría) ─────────────────────── */}
      {durPicker !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setDurPicker(null); setDurDateStr(null) } }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-xs">
            <h3 className="font-semibold text-white mb-4">¿Por cuánto tiempo disponible?</h3>
            {durDateStr && <p className="text-xs text-gray-500 mb-3">Desde {durDateStr}</p>}
            <div className="space-y-2">
              {DURACIONES.map(d => (
                <button key={d.value} disabled={durSaving}
                  onClick={() => handleActivar(d.value)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition-colors disabled:opacity-40">
                  {d.label}
                </button>
              ))}
            </div>
            <button onClick={() => { setDurPicker(null); setDurDateStr(null) }} className="mt-3 w-full text-center text-xs text-gray-600 hover:text-gray-400">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Event detail popup ────────────────────────────────────── */}
      {selEvento && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setSelEvento(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${evClr(selEvento.tipo).dot}`} />
                <h3 className="font-semibold text-white">{selEvento.titulo}</h3>
              </div>
              <button onClick={() => setSelEvento(null)} className="text-gray-600 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-1 text-sm text-gray-400 mb-4">
              <p className="capitalize">{selEvento.tipo}{selEvento.recurrente ? ' · recurrente' : ''}</p>
              {selEvento.todo_el_dia ? <p>Todo el día</p> : selEvento.hora_inicio && (
                <p>{fmt(selEvento.hora_inicio)}{selEvento.hora_fin ? ` – ${fmt(selEvento.hora_fin)}` : ''}</p>
              )}
              {selEvento.descripcion && <p className="text-gray-500 mt-1">{selEvento.descripcion}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEvEdit(selEvento)}
                className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium">
                Editar
              </button>
              <button onClick={() => handleEvDelete(selEvento.id)}
                className="flex-1 py-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors text-sm font-medium">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New personal event modal ──────────────────────────────── */}
      {showEvForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowEvForm(false); setEditingEvento(null) } }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editingEvento ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button onClick={() => { setShowEvForm(false); setEditingEvento(null) }} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleEvSubmit} className="space-y-4">
              <div>
                <label className="label">Título *</label>
                <input type="text" required autoFocus value={evForm.titulo}
                  onChange={e => setEvForm(f => ({ ...f, titulo: e.target.value }))}
                  className="input" placeholder="Reunión, congreso, cumpleaños..." />
              </div>
              <div>
                <label className="label">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(['personal','académico','laboral','social','otro'] as const).map(t => {
                    const c = evClr(t)
                    return (
                      <button type="button" key={t} onClick={() => setEvForm(f => ({ ...f, tipo: t }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${evForm.tipo === t ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-800 text-gray-500 border-transparent hover:border-gray-700'}`}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio *</label>
                  <input type="date" required value={evForm.fecha_inicio}
                    onChange={e => setEvForm(f => ({ ...f, fecha_inicio: e.target.value, fecha_fin: f.fecha_fin < e.target.value ? e.target.value : f.fecha_fin }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input type="date" value={evForm.fecha_fin} min={evForm.fecha_inicio}
                    onChange={e => setEvForm(f => ({ ...f, fecha_fin: e.target.value || f.fecha_inicio }))}
                    className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={evForm.todo_el_dia}
                  onChange={e => setEvForm(f => ({ ...f, todo_el_dia: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600" />
                <span className="text-sm text-gray-300">Todo el día</span>
              </label>
              {!evForm.todo_el_dia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hora inicio</label>
                    <input type="time" value={evForm.hora_inicio ?? ''}
                      onChange={e => setEvForm(f => ({ ...f, hora_inicio: e.target.value || null }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Hora fin</label>
                    <input type="time" value={evForm.hora_fin ?? ''}
                      onChange={e => setEvForm(f => ({ ...f, hora_fin: e.target.value || null }))} className="input" />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={evForm.recurrente}
                  onChange={e => setEvForm(f => ({ ...f, recurrente: e.target.checked, recurrencia: e.target.checked ? 'semanal' : null, recurrencia_dias: [], recurrencia_hasta: null }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600" />
                <span className="text-sm text-gray-300">Evento recurrente</span>
              </label>
              {evForm.recurrente && (
                <div className="space-y-3 pl-4 border-l-2 border-gray-800">
                  <div className="flex gap-2">
                    {(['diaria','semanal','mensual'] as const).map(r => (
                      <button type="button" key={r} onClick={() => setEvForm(f => ({ ...f, recurrencia: r }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${evForm.recurrencia === r ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {evForm.recurrencia === 'semanal' && (
                    <div className="flex gap-1.5 flex-wrap">
                      {['D','L','M','X','J','V','S'].map((d, i) => {
                        const sel = (evForm.recurrencia_dias ?? []).includes(i)
                        return (
                          <button type="button" key={i}
                            onClick={() => setEvForm(f => { const days = f.recurrencia_dias ?? []; return { ...f, recurrencia_dias: sel ? days.filter(x => x !== i) : [...days, i] } })}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${sel ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div>
                    <label className="label">Repetir hasta</label>
                    <input type="date" value={evForm.recurrencia_hasta ?? ''} min={evForm.fecha_inicio}
                      onChange={e => setEvForm(f => ({ ...f, recurrencia_hasta: e.target.value || null }))} className="input" />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea value={evForm.descripcion ?? ''} rows={2}
                  onChange={e => setEvForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="input resize-none" placeholder="Notas..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEvForm(false); setEditingEvento(null) }} className="btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={evSaving} className="btn-primary flex-1">{evSaving ? 'Guardando...' : editingEvento ? 'Guardar cambios' : 'Crear evento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Direct tutorías assignment ────────────────────────────── */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAssign(false) }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">Asignar tutoría directa</h3>
              <button onClick={() => setShowAssign(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleAsignar} className="space-y-4">
              <div>
                <label className="label">Estudiante *</label>
                <select required value={assignEst} onChange={e => setAssignEst(e.target.value)} className="input">
                  <option value="">Seleccionar...</option>
                  {estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.carrera ? ` · ${e.carrera}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Horario *</label>
                <select required value={assignHor} onChange={e => setAssignHor(e.target.value)} className="input">
                  <option value="">Seleccionar...</option>
                  {horarios.map(h => <option key={h.id} value={h.id}>{h.dia_semana} {fmt(h.hora_inicio)}–{fmt(h.hora_fin)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha *</label>
                <input type="date" required value={assignDate} onChange={e => setAssignDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Nota (opcional)</label>
                <input type="text" value={assignNota} onChange={e => setAssignNota(e.target.value)} className="input" placeholder="Tema a tratar..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={assigning} className="btn-primary flex-1">{assigning ? 'Asignando...' : 'Asignar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close popover on outside click */}
      {popover && (
        <div className="fixed inset-0 z-30" onClick={() => setPopover(null)} />
      )}

      {/* ── Planificar modal ──────────────────────────────────────── */}
      {claseModal?.mode === 'planificar' && claseModal.clase.cursos?.id && (
        <PlanificarModal
          cursoId={claseModal.clase.cursos.id}
          asignatura={claseModal.clase.cursos.asignatura}
          fecha={claseModal.fecha}
          horaInicio={claseModal.clase.hora_inicio}
          horaFin={claseModal.clase.hora_fin}
          centroComputo={claseModal.clase.centro_computo}
          clases={clases}
          onClose={() => setClaseModal(null)}
          onSaved={() => {
            setClaseModal(null)
            // Refrescar badges de bitácora
            setBitacoraMap(prev => {
              const next = new Map(prev)
              next.set(`${claseModal.clase.cursos!.id}|${claseModal.fecha}`, { estado: 'planificado', tema: '' })
              return next
            })
            router.refresh()
          }}
        />
      )}

      {/* ── Pase de lista modal ───────────────────────────────────── */}
      {claseModal?.mode === 'lista' && claseModal.clase.cursos?.id && (
        <PasarListaModal
          cursoId={claseModal.clase.cursos.id}
          asignatura={claseModal.clase.cursos.asignatura}
          fecha={claseModal.fecha}
          horaInicio={claseModal.clase.hora_inicio}
          horaFin={claseModal.clase.hora_fin}
          onClose={() => setClaseModal(null)}
          onSaved={() => {
            setClaseModal(null)
            setBitacoraMap(prev => {
              const next = new Map(prev)
              next.set(`${claseModal.clase.cursos!.id}|${claseModal.fecha}`, { estado: 'cumplido', tema: '' })
              return next
            })
            router.refresh()
          }}
        />
      )}

      {/* ── Replanificar modal ────────────────────────────────────── */}
      {replanificar && (
        <ReplanificarModal
          cursoId={replanificar.cursoId}
          asignatura={replanificar.asignatura}
          origenFecha={replanificar.fecha}
          origenTema={replanificar.tema}
          onClose={() => setReplanificar(null)}
          onDone={() => {
            setReplanificar(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
