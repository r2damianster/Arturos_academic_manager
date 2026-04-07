'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activarHorario, asignarTutoriaDirecta, type DuracionTutoria } from '@/lib/actions/tutorias'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string   // 'disponible' | 'no_disponible'
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
  cancelado_por?: string | null
  cancelado_at?: string | null
  asistio?: boolean | null
  completada_at?: string | null
  notas?: string | null
}

interface Estudiante {
  id: string
  nombre: string
  email: string
  auth_user_id: string | null
  carrera?: string | null
  telefono?: string | null
}

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  cursos: {
    id: string
    asignatura: string
  } | null
  anuncios_tutoria_curso?: {
    estudiante_id: string
    fecha: string
    estudiantes: { nombre: string, carrera: string, email: string }
  }[]
}

interface Props {
  horarios: Horario[]
  reservas: Reserva[]
  clases: Clase[]
  estudiantes: Estudiante[]
  profesorNombre: string
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_JS: Record<number, string> = {
  1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado',
}
const DAY_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MAX_WEEK_OFFSET = 16 // ~4 months ahead

const DURACIONES: { value: DuracionTutoria; label: string }[] = [
  { value: '1s',          label: '1 semana' },
  { value: '2s',          label: '2 semanas' },
  { value: '1m',          label: '1 mes' },
  { value: '2m',          label: '2 meses' },
  { value: '3m',          label: '3 meses' },
  { value: '4m',          label: '4 meses' },
  { value: 'permanente',  label: 'Permanente' },
]

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  const dow = today.getDay()
  const start = new Date(today)
  if (dow === 0) start.setDate(start.getDate() + 1)
  start.setDate(start.getDate() + weekOffset * 7)
  const dates: Date[] = []
  const cur = new Date(start)
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string { return toDateStr(new Date()) }

function fmtDateRange(dates: Date[]): string {
  const a = dates[0], b = dates[dates.length - 1]
  const sameMonth = a.getMonth() === b.getMonth()
  if (sameMonth) return `${a.getDate()}–${b.getDate()} ${MONTH_SHORT[a.getMonth()]}`
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`
}

function fmt(t: string) { return t?.slice(0, 5) ?? '' }
function initials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }

function isSlotActiveOnDate(h: Horario, dateStr: string): boolean {
  if (h.estado !== 'disponible') return false
  if (!h.disponible_hasta) return true          // permanente
  return dateStr <= h.disponible_hasta
}

// ─── Time slots ───────────────────────────────────────────────────────────────

const DEFAULT_START = 9   // 09:00 fallback
const DEFAULT_END   = 17  // 17:00 fallback

function allSlots(): string[] {
  const s: string[] = []
  for (let hh = 0; hh <= 23; hh++) {
    s.push(`${String(hh).padStart(2,'0')}:00`)
    s.push(`${String(hh).padStart(2,'0')}:30`)
  }
  return s
}
const ALL_SLOTS = allSlots()

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function getDynamicSlots(horarios: { hora_inicio: string; hora_fin: string }[], clases: { hora_inicio: string; hora_fin: string }[]): string[] {
  const allEvents = [...horarios, ...clases]
  if (allEvents.length === 0) {
    return ALL_SLOTS.filter(s => s >= `${String(DEFAULT_START).padStart(2,'0')}:00` && s < `${String(DEFAULT_END).padStart(2,'0')}:00`)
  }

  const starts = allEvents.map(e => toMinutes(fmt(e.hora_inicio)))
  const ends   = allEvents.map(e => toMinutes(fmt(e.hora_fin)))

  const tMin = Math.max(0,    Math.min(...starts) - 60)  // –1h, no bajar de 00:00
  const tMax = Math.min(1440, Math.max(...ends)   + 60)  // +1h, no pasar de 24:00

  // snap to the nearest :00 or :30
  const snapMin = Math.floor(tMin / 30) * 30
  const snapMax = Math.ceil(tMax  / 30) * 30

  return ALL_SLOTS.filter(s => {
    const m = toMinutes(s)
    return m >= snapMin && m < snapMax
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TutoriasManager({ horarios: init, reservas: initRes, clases, estudiantes, profesorNombre }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios]     = useState<Horario[]>(init)
  const [reservas, setReservas]     = useState<Reserva[]>(initRes)
  const [, startTransition]         = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [popover, setPopover]       = useState<string | null>(null) // `${horarioId}|${dateStr}`
  const [acting,  setActing]        = useState<number | null>(null)
  const [err, setErr]               = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Duration picker: shown when clicking a no_disponible slot
  const [durPicker, setDurPicker]   = useState<number | null>(null) // horario id
  const [durDateStr, setDurDateStr] = useState<string | null>(null) // clicked date
  const [durSaving, setDurSaving]   = useState(false)

  // Direct assignment panel
  const [showAssign, setShowAssign] = useState(false)
  const [assignEst, setAssignEst]   = useState<string>('')       // estudiante id
  const [assignHor, setAssignHor]   = useState<string>('')       // horario id (string for select)
  const [assignDate, setAssignDate] = useState<string>(todayStr())
  const [assignNota, setAssignNota] = useState<string>('')
  const [assigning, setAssigning]   = useState(false)
  const [assignMsg, setAssignMsg]   = useState<string | null>(null)

  // Historial filters
  const [fNombre,  setFNombre]  = useState('')
  const [fCarrera, setFCarrera] = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')

  const profesorId = horarios[0]?.profesor_id ?? ''

  const weekDates    = getWeekDates(weekOffset)

  // Dynamic time slots: scan all horarios + clases to find Tmin/Tmax for this week
  const timeSlots = getDynamicSlots(horarios, clases)

  const horarioMap   = new Map<string, Horario>()
  for (const h of horarios) {
    horarioMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)
  }

  const claseMap = new Map<string, Clase>()
  for (const c of clases) {
    const start = fmt(c.hora_inicio)
    const end = fmt(c.hora_fin)
    for (const slot of ALL_SLOTS) {
      if (slot >= start && slot < end) {
        claseMap.set(`${c.dia_semana}|${slot}`, c)
      }
    }
  }

  const reservaBySlotDate = new Map<string, Reserva>()
  for (const r of reservas) {
    if (r.estado === 'pendiente' || r.estado === 'confirmada') {
      reservaBySlotDate.set(`${r.horario_id}|${r.fecha}`, r)
    }
  }

  const pendientes = reservas
    .filter(r => r.estado === 'pendiente' || r.estado === 'confirmada')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const historial  = reservas.filter(r => r.estado !== 'pendiente' && r.estado !== 'confirmada')

  const historialFiltrado = historial.filter(r => {
    if (fNombre  && !r.estudiante_nombre.toLowerCase().includes(fNombre.toLowerCase()))   return false
    if (fCarrera && !r.estudiante_carrera.toLowerCase().includes(fCarrera.toLowerCase())) return false
    if (fDesde   && r.fecha < fDesde) return false
    if (fHasta   && r.fecha > fHasta) return false
    return true
  })

  const hoy = toDateStr(new Date())
  const nDisp = horarios.filter(h => isSlotActiveOnDate(h, hoy)).length

  const activeDias = weekDates.filter(date => {
    const diaKey = DAY_JS[date.getDay()]
    return horarios.some(h => h.dia_semana === diaKey) || clases.some(c => c.dia_semana === diaKey)
  })

  // ── Toggle slot ────────────────────────────────────────────────────────────
  async function toggleSlot(h: Horario, dateStr: string) {
    const key = `${h.id}|${dateStr}`
    if (reservaBySlotDate.has(key)) { setPopover(popover === key ? null : key); return }

    if (isSlotActiveOnDate(h, dateStr)) {
      // Truncate disponible_hasta to day BEFORE clicked date
      // → semanas previas permanecen verdes, esta semana en adelante queda gris
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const nuevoHasta = d.toISOString().split('T')[0]
      setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, disponible_hasta: nuevoHasta } : x))
      setErr(null)
      startTransition(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('horarios')
          .update({ disponible_hasta: nuevoHasta })
          .eq('id', h.id)
        if (error) {
          setErr('Error al guardar')
          setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, disponible_hasta: h.disponible_hasta } : x))
        }
      })
    } else {
      // Show duration picker to reactivate
      setDurPicker(durPicker === h.id ? null : h.id)
      setDurDateStr(dateStr)
    }
  }

  async function confirmarDuracion(h: Horario, duracion: Pick<DuracionTutoria, never> | string) {
    setDurSaving(true); setErr(null)
    const res = await activarHorario(h.id, duracion as DuracionTutoria)
    if (res.error) { setErr(res.error); setDurSaving(false); return }
    setHorarios(prev => prev.map(x =>
      x.id === h.id ? { ...x, estado: 'disponible', disponible_hasta: res.disponible_hasta ?? null } : x
    ))
    setDurPicker(null); setDurDateStr(null); setDurSaving(false)
  }

  // ── Professor actions on reservas ──────────────────────────────────────────
  async function accionReserva(r: Reserva, accion: 'asistio' | 'no_asistio' | 'cancelar') {
    setActing(r.id); setErr(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: rpcErr } = await (supabase as any).rpc('gestionar_reserva_profesor', {
      p_reserva_id: r.id, p_accion: accion,
    })
    if (rpcErr || !(data as { ok: boolean })?.ok) {
      setErr(rpcErr?.message ?? (data as { error?: string })?.error ?? 'Error al procesar')
      setActing(null); return
    }
    const now = new Date().toISOString()
    setReservas(prev => prev.map(x => {
      if (x.id !== r.id) return x
      if (accion === 'asistio')    return { ...x, estado:'completada', asistio:true,  completada_at:now }
      if (accion === 'no_asistio') return { ...x, estado:'completada', asistio:false, completada_at:now }
      return { ...x, estado:'cancelado', cancelado_por:'profesor', cancelado_at:now }
    }))
    setPopover(null); setActing(null)
  }

  // ── Batch ──────────────────────────────────────────────────────────────────
  async function batchNoDisponible() {
    setHorarios(prev => prev.map(h => ({ ...h, estado:'no_disponible', disponible_hasta: null })))
    startTransition(async () => {
      await (supabase as any).from('horarios').update({ estado:'no_disponible', disponible_hasta: null }).eq('profesor_id', profesorId)
    })
  }
  async function batchLV() {
    const lv = ['lunes','martes','miércoles','jueves','viernes']
    setHorarios(prev => prev.map(h => ({
      ...h,
      estado: lv.includes(h.dia_semana) ? 'disponible' : h.estado,
      disponible_hasta: lv.includes(h.dia_semana) ? null : h.disponible_hasta,
    })))
    startTransition(async () => {
      await (supabase as any).from('horarios')
        .update({ estado:'disponible', disponible_hasta: null })
        .eq('profesor_id', profesorId).in('dia_semana', lv)
    })
  }

  // ── Direct assignment ──────────────────────────────────────────────────────
  async function handleAsignar() {
    if (!assignEst || !assignHor || !assignDate) return
    const est = estudiantes.find(e => e.id === assignEst)
    if (!est?.auth_user_id) { setAssignMsg('❌ Este estudiante no tiene cuenta vinculada.'); return }
    setAssigning(true); setAssignMsg(null)
    const res = await asignarTutoriaDirecta({
      horarioId:         Number(assignHor),
      fecha:             assignDate,
      authUserId:        est.auth_user_id,
      estudianteNombre:  est.nombre,
      estudianteEmail:   est.email,
      estudianteCarrera: est.carrera ?? null,
      estudianteTelefono: est.telefono ?? null,
      nota:              assignNota.trim() || null,
    })
    if (res.error) {
      setAssignMsg(`❌ ${res.error}`)
    } else {
      const h = horarios.find(x => x.id === Number(assignHor))
      // Add to local reservas list
      setReservas(prev => [...prev, {
        id: res.reservaId ?? Math.random(),
        horario_id: Number(assignHor),
        fecha: assignDate,
        estudiante_nombre: est.nombre,
        estudiante_carrera: est.carrera ?? '',
        email: est.email,
        telefono: est.telefono ?? '',
        notas: assignNota.trim() || null,
        estado: 'confirmada',
      }])
      setAssignMsg(`✓ Tutoría asignada a ${est.nombre} — ${assignDate} ${h ? fmt(h.hora_inicio) : ''}`)
      setAssignEst(''); setAssignHor(''); setAssignNota('')
    }
    setAssigning(false)
  }

  // ─── Status badge ──────────────────────────────────────────────────────────
  function StatusBadge({ r }: { r: Reserva }) {
    if (r.estado === 'confirmada')
      return <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">Confirmada</span>
    if (r.estado === 'completada') {
      return r.asistio
        ? <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">Asistió</span>
        : <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">No asistió</span>
    }
    if (r.estado === 'cancelado') {
      return r.cancelado_por === 'estudiante'
        ? <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded">Canceló est.</span>
        : <span className="text-[10px] bg-red-900/40 text-red-400 border border-red-800 px-1.5 py-0.5 rounded">Cancelado prof.</span>
    }
    return null
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {err && (
        <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-xs flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* ── Grid card ─────────────────────────────────────────────────────── */}
      <div className="card space-y-2">

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
              disabled={weekOffset === 0}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-medium text-white min-w-[110px] text-center">
              {weekOffset === 0 ? 'Esta semana · ' : ''}{fmtDateRange(weekDates)}
            </span>
            <button
              onClick={() => setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1))}
              disabled={weekOffset >= MAX_WEEK_OFFSET}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-[10px] text-gray-500">{nDisp} disp · {pendientes.length} pend</span>
            <button onClick={batchNoDisponible} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
              Todo NO disp
            </button>
            <button onClick={batchLV} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
              L–V dispon
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-900/60 border border-emerald-700 inline-block"/>Disponible</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-800 border border-gray-700 inline-block"/>No disponible</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-900/60 border border-blue-700 inline-block"/>Reservado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-900/60 border border-purple-700 inline-block"/>Clase regular</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-900/60 border border-orange-700 inline-block"/>Tutoría de curso</span>
          <span className="text-gray-600 text-[9px]">Clic en gris → activar con duración · Clic en verde → desactivar</span>
        </div>

        {/* Duration picker overlay */}
        {durPicker !== null && (() => {
          const h = horarios.find(x => x.id === durPicker)
          if (!h) return null
          return (
            <div className="border-2 border-brand-500 rounded-lg bg-gray-800 shadow-xl px-4 py-4 space-y-3 relative z-10 my-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Activar <span className="text-brand-400 capitalize">{h.dia_semana}</span> {fmt(h.hora_inicio)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">¿Por cuánto tiempo deseas abrir este horario?</p>
                </div>
                <button onClick={() => { setDurPicker(null); setDurDateStr(null) }} className="text-gray-400 hover:text-white p-2">✕</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {durDateStr && (
                  <button
                    onClick={() => confirmarDuracion(h, `hasta_${durDateStr}`)}
                    disabled={durSaving}
                    title={`Habilitado solo hasta la medianoche del ${durDateStr}`}
                    className="text-[12px] font-medium px-3 py-2 rounded-lg border-2 border-emerald-600 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-700/50 disabled:opacity-40 transition-all shadow-sm"
                  >
                    Solo hasta el {durDateStr} (Puntual)
                  </button>
                )}
                {DURACIONES.map(d => (
                  <button
                    key={d.value}
                    onClick={() => confirmarDuracion(h, d.value)}
                    disabled={durSaving}
                    className="text-[12px] font-medium px-3 py-2 rounded-lg border border-brand-700 bg-brand-900/30 text-brand-300 hover:bg-brand-700/50 hover:border-brand-500 disabled:opacity-40 transition-all"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Grid */}
        {activeDias.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No hay horarios configurados para esta semana.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 280 }}>
              <thead>
                <tr>
                  <th className="w-10 pr-1 text-right text-gray-600 font-normal pb-1 text-[10px]">Hora</th>
                  {activeDias.map(date => {
                    const isToday = toDateStr(date) === toDateStr(new Date())
                    return (
                      <th key={toDateStr(date)} className="text-center font-medium pb-1 px-0.5 min-w-[52px]">
                        <div className={`text-[10px] font-semibold ${isToday ? 'text-brand-400' : 'text-gray-400'}`}>
                          {DAY_SHORT[date.getDay()]}
                        </div>
                        <div className={`text-[11px] font-bold ${isToday ? 'text-brand-300' : 'text-gray-300'}`}>
                          {date.getDate()}
                          <span className="text-[9px] font-normal text-gray-500 ml-0.5">{MONTH_SHORT[date.getMonth()]}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(time => {
                  const diaKeys = activeDias.map(d => DAY_JS[d.getDay()])
                  const hasSomething = diaKeys.some(dia => horarioMap.has(`${dia}|${time}`) || claseMap.has(`${dia}|${time}`))
                  if (!hasSomething) return null
                  return (
                    <tr key={time}>
                      <td className="pr-1 text-right text-gray-600 py-0.5 text-[9px] whitespace-nowrap">{time}</td>
                      {activeDias.map(date => {
                        const diaKey  = DAY_JS[date.getDay()]
                        const dateStr = toDateStr(date)
                        const h = horarioMap.get(`${diaKey}|${time}`)
                        const clase = claseMap.get(`${diaKey}|${time}`)

                        if (clase) {
                          if (clase.tipo === 'tutoria_curso') {
                            const isTutoriaOpen = popover === `tutoria|${clase.id}|${dateStr}`
                            const anunciosDelDia = clase.anuncios_tutoria_curso?.filter(a => a.fecha === dateStr) || []
                            const isFirstSlot = time === fmt(clase.hora_inicio)
                            return (
                              <td key={dateStr} className="px-0.5 py-0.5 relative">
                                <button
                                  onClick={() => isFirstSlot ? setPopover(isTutoriaOpen ? null : `tutoria|${clase.id}|${dateStr}`) : undefined}
                                  className={`w-full h-5 rounded border flex items-center justify-center transition-colors ${
                                    isTutoriaOpen ? 'bg-orange-600/80 border-orange-400 ring-1 ring-orange-400' : 'bg-orange-900/30 border-orange-800/60 hover:bg-orange-800/50'
                                  } ${!isFirstSlot ? 'cursor-default' : ''}`}
                                  title={`Tutoría Grupal: ${clase.cursos?.asignatura}`}
                                >
                                  {isFirstSlot && (
                                    <span className="text-[7px] text-orange-300 font-bold px-0.5 truncate flex gap-1">
                                      {clase.cursos?.asignatura}
                                      {anunciosDelDia.length > 0 && <span className="bg-orange-500 text-white rounded-full px-1">{anunciosDelDia.length}</span>}
                                    </span>
                                  )}
                                </button>
                                {isTutoriaOpen && isFirstSlot && (
                                  <div className="absolute left-0 top-6 z-50 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 space-y-2 pointer-events-auto"
                                    onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="min-w-0 pr-4">
                                        <p className="text-white text-xs font-semibold">Tutoría: {clase.cursos?.asignatura}</p>
                                        <p className="text-gray-400 text-[10px]">{dateStr} · {fmt(clase.hora_inicio)} - {fmt(clase.hora_fin)}</p>
                                      </div>
                                      <button onClick={() => setPopover(null)} className="text-gray-500 hover:text-gray-300 ml-1 flex-shrink-0">✕</button>
                                    </div>
                                    <div className="text-[10px]">
                                      <p className="font-semibold text-gray-300 mb-1 border-b border-gray-700 pb-1">Estudiantes asistentes ({anunciosDelDia.length}):</p>
                                      {anunciosDelDia.length === 0 ? (
                                        <p className="text-gray-500 italic">Nadie ha confirmado asistencia aún.</p>
                                      ) : (
                                        <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                          {anunciosDelDia.map(a => (
                                            <li key={a.estudiante_id} className="text-gray-300">
                                              • {a.estudiantes.nombre.split(' ')[0]} <span className="text-gray-500 text-[9px]">{a.estudiantes.carrera}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          }
                          
                          // Clase normal
                          return (
                            <td key={dateStr} className="px-0.5 py-0.5">
                              <div className="w-full h-5 rounded border border-purple-800/60 bg-purple-900/30 flex items-center justify-center overflow-hidden" title={`Clase: ${clase.cursos?.asignatura}`}>
                                <span className="text-[7px] text-purple-300 font-bold px-0.5 truncate">{clase.cursos?.asignatura}</span>
                              </div>
                            </td>
                          )
                        }

                        if (!h) return <td key={dateStr} className="px-0.5 py-0.5" />

                        const popKey  = `${h.id}|${dateStr}`
                        const reserva = reservaBySlotDate.get(popKey)
                        const isReserved = !!reserva
                        const isOpen  = popover === popKey
                        const isDurOpen = durPicker === h.id

                        // Disponible but expired for this date
                        const activeOnDate = isSlotActiveOnDate(h, dateStr)

                        if (isReserved) {
                          return (
                            <td key={dateStr} className="px-0.5 py-0.5 relative">
                              <button
                                onClick={() => setPopover(isOpen ? null : popKey)}
                                className={`w-full h-5 rounded border text-[8px] font-bold transition-colors ${
                                  isOpen
                                    ? 'bg-blue-600/80 border-blue-400 text-white ring-1 ring-blue-400'
                                    : 'bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-700/60'
                                }`}
                              >
                                {initials(reserva!.estudiante_nombre)}
                              </button>
                              {isOpen && reserva && (
                                <div className="absolute left-0 top-6 z-50 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 space-y-2"
                                  onClick={e => e.stopPropagation()}>
                                  <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                      <p className="text-white text-xs font-semibold truncate">{reserva.estudiante_nombre}</p>
                                      <p className="text-gray-400 text-[10px] truncate">{reserva.estudiante_carrera}</p>
                                      <p className="text-gray-500 text-[10px]">{reserva.fecha} · {fmt(h.hora_inicio)}</p>
                                      {reserva.email && <p className="text-gray-600 text-[10px] truncate">{reserva.email}</p>}
                                      {reserva.notas && <p className="text-gray-500 text-[10px] italic mt-1">"{reserva.notas}"</p>}
                                      {reserva.estado === 'confirmada' && (
                                        <p className="text-blue-400 text-[10px] mt-1">Asignada directamente</p>
                                      )}
                                    </div>
                                    <button onClick={() => setPopover(null)} className="text-gray-500 hover:text-gray-300 ml-1 flex-shrink-0">✕</button>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button onClick={() => accionReserva(reserva, 'asistio')} disabled={acting === reserva.id}
                                      className="flex-1 text-[10px] bg-emerald-800/60 text-emerald-300 border border-emerald-700 py-1 rounded hover:bg-emerald-700/60 disabled:opacity-40 transition-colors">
                                      {acting === reserva.id ? '...' : '✓ Asistió'}
                                    </button>
                                    <button onClick={() => accionReserva(reserva, 'no_asistio')} disabled={acting === reserva.id}
                                      className="flex-1 text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700 py-1 rounded hover:bg-amber-700/40 disabled:opacity-40 transition-colors">
                                      ✗ No asistió
                                    </button>
                                    <button onClick={() => accionReserva(reserva, 'cancelar')} disabled={acting === reserva.id}
                                      className="flex-1 text-[10px] text-gray-400 border border-gray-600 py-1 rounded hover:bg-gray-700 disabled:opacity-40 transition-colors">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          )
                        }

                        if (!activeOnDate) {
                          // Slot exists but expired or no_disponible — gray clickable
                          return (
                            <td key={dateStr} className="px-0.5 py-0.5">
                              <button
                                onClick={() => toggleSlot(h, dateStr)}
                                className={`w-full h-5 rounded border transition-colors ${
                                  isDurOpen && h.estado === 'no_disponible'
                                    ? 'border-brand-600 bg-brand-900/20'
                                    : 'border-gray-800/30 bg-gray-900/20 hover:bg-gray-800/40'
                                }`}
                              />
                            </td>
                          )
                        }

                        // disponible & active for this date
                        return (
                          <td key={dateStr} className="px-0.5 py-0.5">
                            <button
                              onClick={() => toggleSlot(h, dateStr)}
                              className="w-full h-5 rounded border border-emerald-800/60 bg-emerald-900/30 hover:bg-emerald-700/50 transition-colors"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Asignar tutoría directa ────────────────────────────────────────── */}
      <div className="card space-y-3">
        <button
          onClick={() => { setShowAssign(v => !v); setAssignMsg(null) }}
          className="flex items-center gap-2 w-full text-left"
        >
          <svg className={`w-3.5 h-3.5 text-brand-400 transition-transform ${showAssign ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-semibold text-white">Asignar tutoría directa a estudiante</span>
        </button>

        {showAssign && (
          <div className="space-y-3 pt-1">
            {assignMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                assignMsg.startsWith('✓')
                  ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
                  : 'bg-red-900/30 border-red-800 text-red-300'
              }`}>
                {assignMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Estudiante</label>
                <select className="input text-xs" value={assignEst} onChange={e => setAssignEst(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {estudiantes.map(e => (
                    <option key={e.id} value={e.id} disabled={!e.auth_user_id}>
                      {e.nombre}{!e.auth_user_id ? ' (sin cuenta)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs">Horario disponible</label>
                <select className="input text-xs" value={assignHor} onChange={e => setAssignHor(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {horarios.filter(h => h.estado === 'disponible').map(h => (
                    <option key={h.id} value={String(h.id)}>
                      {h.dia_semana} {fmt(h.hora_inicio)}–{fmt(h.hora_fin)}
                      {h.disponible_hasta ? ` (hasta ${h.disponible_hasta})` : ' (permanente)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs">Fecha de la sesión</label>
                <input
                  type="date" className="input text-xs"
                  value={assignDate}
                  min={todayStr()}
                  onChange={e => setAssignDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label text-xs">Nota / Motivo <span className="text-gray-600">(opcional)</span></label>
                <input
                  type="text" className="input text-xs"
                  placeholder="Ej: Revisión de ensayo..."
                  value={assignNota}
                  maxLength={200}
                  onChange={e => setAssignNota(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleAsignar}
              disabled={!assignEst || !assignHor || !assignDate || assigning}
              className="btn-primary text-sm disabled:opacity-40"
            >
              {assigning ? 'Asignando...' : 'Asignar y notificar por email'}
            </button>
          </div>
        )}
      </div>

      {/* ── Pending reservations ──────────────────────────────────────────── */}
      {pendientes.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-xs font-semibold text-white">Reservas activas ({pendientes.length})</h3>
          {pendientes.map(r => {
            const h = horarios.find(x => x.id === r.horario_id)
            const dateLabel = r.fecha
              ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
              : '—'
            return (
              <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-blue-900/10 border border-blue-900/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {initials(r.estudiante_nombre)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white truncate">{r.estudiante_nombre}</p>
                        <StatusBadge r={r} />
                      </div>
                      <p className="text-[10px] text-gray-400">{r.estudiante_carrera}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 ml-8">
                    {dateLabel} {h ? `· ${fmt(h.hora_inicio)}–${fmt(h.hora_fin)}` : ''}
                    {r.email && <span className="ml-2 text-gray-600">{r.email}</span>}
                  </p>
                  {r.notas && <p className="text-[10px] text-gray-600 italic ml-8 mt-0.5">"{r.notas}"</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => accionReserva(r, 'asistio')} disabled={acting === r.id}
                    className="text-[10px] bg-emerald-800/50 text-emerald-300 border border-emerald-800 px-2 py-1 rounded hover:bg-emerald-700/50 disabled:opacity-40 transition-colors">
                    {acting === r.id ? '...' : '✓ Asistió'}
                  </button>
                  <button onClick={() => accionReserva(r, 'no_asistio')} disabled={acting === r.id}
                    className="text-[10px] bg-amber-900/30 text-amber-300 border border-amber-800 px-2 py-1 rounded hover:bg-amber-700/40 disabled:opacity-40 transition-colors">
                    ✗ No asistió
                  </button>
                  <button onClick={() => accionReserva(r, 'cancelar')} disabled={acting === r.id}
                    className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Historial ─────────────────────────────────────────────────────── */}
      {historial.length > 0 && (
        <div className="card space-y-2">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white w-full text-left"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Historial ({historial.length} tutorías)
          </button>

          {showHistory && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input type="text" placeholder="Estudiante..." value={fNombre} onChange={e => setFNombre(e.target.value)} className="input text-xs py-1.5" />
                <input type="text" placeholder="Carrera..." value={fCarrera} onChange={e => setFCarrera(e.target.value)} className="input text-xs py-1.5" />
                <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} className="input text-xs py-1.5" title="Desde" />
                <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} className="input text-xs py-1.5" title="Hasta" />
              </div>
              {(fNombre || fCarrera || fDesde || fHasta) && (
                <button onClick={() => { setFNombre(''); setFCarrera(''); setFDesde(''); setFHasta('') }}
                  className="text-[10px] text-gray-500 hover:text-gray-300">
                  ✕ Limpiar — {historialFiltrado.length} resultado{historialFiltrado.length !== 1 ? 's' : ''}
                </button>
              )}
              {historialFiltrado.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">Sin resultados</p>
              ) : historialFiltrado.map(r => {
                const h = horarios.find(x => x.id === r.horario_id)
                const dateLabel = r.fecha
                  ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
                  : '—'
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-800">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-200 truncate">{r.estudiante_nombre}</p>
                        <StatusBadge r={r} />
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">
                        {r.estudiante_carrera} · {dateLabel}{h ? ` · ${fmt(h.hora_inicio)}` : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Close grid popover on outside click (durPicker is inline — no overlay needed) */}
      {popover && (
        <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
      )}
    </div>
  )
}
