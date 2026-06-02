'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  activarHorario,
  asignarTutoriaDirecta,
  crearTipoTutoria,
  actualizarTipoTutoria,
  eliminarTipoTutoria,
  type DuracionTutoria,
  type TipoTutoria,
} from '@/lib/actions/tutorias'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string   // 'disponible' | 'no_disponible'
  profesor_id: string
  disponible_hasta: string | null
  permite_multiples?: boolean | null
  buffer_minutos?: number | null
}

interface Reserva {
  id: number
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  telefono: string
  fecha: string
  horario_id: number | null
  estado: string
  cancelado_por?: string | null
  cancelado_at?: string | null
  asistio?: boolean | null
  completada_at?: string | null
  notas?: string | null
  modalidad?: string | null
  link_zoom?: string | null
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
  tiposTutoria?: TipoTutoria[]
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

export function TutoriasManager({ horarios: init, reservas: initRes, clases, estudiantes, profesorNombre, tiposTutoria = [] }: Props) {
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
  const [savingId,  setSavingId]    = useState<number | null>(null) // horario being saved
  const [durConflicto, setDurConflicto] = useState<string | null>(null) // nombre asignatura con tutoria_curso

  // Multi-booking options inside duration picker
  const [durPermitirMultiples, setDurPermitirMultiples] = useState(false)
  const [durBufferMinutos, setDurBufferMinutos]         = useState(2)

  // Tipos de tutoría CRUD
  const [showTipos, setShowTipos]           = useState(false)
  const [tiposLocal, setTiposLocal]         = useState<TipoTutoria[]>(tiposTutoria)
  const [tipoEditId, setTipoEditId]         = useState<number | null>(null)
  const [tipoNombre, setTipoNombre]         = useState('')
  const [tipoDuracion, setTipoDuracion]     = useState(20)
  const [tipoSaving, setTipoSaving]         = useState(false)
  const [tipoMsg, setTipoMsg]               = useState<string | null>(null)

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
    const key = `${h.dia_semana}|${fmt(h.hora_inicio)}`
    const existing = horarioMap.get(key)
    // Prefer disponible over no_disponible when there are duplicate horarios for the same slot
    if (!existing || (h.estado === 'disponible' && existing.estado !== 'disponible')) {
      horarioMap.set(key, h)
    }
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

  // Backup lookup by dia|hora|fecha — catches reservas whose horario_id doesn't match
  // the horarioMap entry (duplicate horarios: same slot, different ids)
  const reservaByDiaHoraFecha = new Map<string, Reserva>()
  for (const r of reservas) {
    if (r.estado !== 'pendiente' && r.estado !== 'confirmada') continue
    const rh = horarios.find(x => x.id === r.horario_id)
    if (!rh) continue
    const key = `${rh.dia_semana}|${fmt(rh.hora_inicio)}|${r.fecha}`
    if (!reservaByDiaHoraFecha.has(key)) reservaByDiaHoraFecha.set(key, r)
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

  const nReservasActivasSemana = (() => {
    if (!weekDates.length) return 0
    const desde = toDateStr(weekDates[0])
    const hasta = toDateStr(weekDates[weekDates.length - 1])
    return reservas.filter(r =>
      r.fecha >= desde && r.fecha <= hasta &&
      (r.estado === 'pendiente' || r.estado === 'confirmada')
    ).length
  })()

  const activeDias = weekDates.filter(date => {
    const diaKey = DAY_JS[date.getDay()]
    return horarios.some(h => h.dia_semana === diaKey) || clases.some(c => c.dia_semana === diaKey)
  })

  // ── Toggle slot ────────────────────────────────────────────────────────────
  function doDeactivate(h: Horario, dateStr: string) {
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
  }

  async function toggleSlot(h: Horario, dateStr: string) {
    const key = `${h.id}|${dateStr}`
    const hasReserva = reservaBySlotDate.has(key)
      || reservaByDiaHoraFecha.has(`${h.dia_semana}|${fmt(h.hora_inicio)}|${dateStr}`)
    if (hasReserva) { setPopover(popover === key ? null : key); return }

    if (isSlotActiveOnDate(h, dateStr)) {
      const activeRes = reservas.filter(r =>
        r.horario_id === h.id &&
        r.fecha >= dateStr &&
        (r.estado === 'pendiente' || r.estado === 'confirmada')
      )
      if (activeRes.length > 0) {
        setWarnSlot({ h, dateStr, names: activeRes.map(r => r.estudiante_nombre) })
        return
      }
      doDeactivate(h, dateStr)
    } else {
      // Detect any conflict at this time slot (clases, tutoria_curso, etc.)
      const conflicto = (() => {
        const start = fmt(h.hora_inicio)
        const end   = fmt(h.hora_fin)
        const seen = new Set<string>()
        const found: string[] = []
        for (const slot of ALL_SLOTS) {
          if (slot >= start && slot < end) {
            const c = claseMap.get(`${h.dia_semana}|${slot}`)
            if (c) {
              const asig = c.cursos?.asignatura ?? 'sin nombre'
              const label = c.tipo === 'tutoria_curso'
                ? `tutoría grupal de ${asig}`
                : `clase de ${asig}`
              if (!seen.has(label)) { seen.add(label); found.push(label) }
            }
          }
        }
        return found.length > 0 ? found.join(', ') : null
      })()
      setDurConflicto(conflicto)
      setDurPicker(durPicker === h.id ? null : h.id)
      setDurDateStr(dateStr)
    }
  }

  async function confirmarDuracion(h: Horario, duracion: Pick<DuracionTutoria, never> | string) {
    // Optimistic: close picker and turn green immediately
    setDurPicker(null); setDurDateStr(null); setDurConflicto(null); setErr(null); setDurSaving(true); setSavingId(h.id)
    setHorarios(prev => prev.map(x =>
      x.id === h.id ? { ...x, estado: 'disponible', disponible_hasta: null } : x
    ))

    const res = await activarHorario(h.id, duracion as DuracionTutoria, {
      permitirMultiples: durPermitirMultiples,
      bufferMinutos: durPermitirMultiples ? durBufferMinutos : undefined,
    })
    setDurSaving(false); setSavingId(null)

    if (res.error) {
      setErr(res.error)
      // Rollback to original state
      setHorarios(prev => prev.map(x => x.id === h.id ? h : x))
      return
    }
    // Sync real disponible_hasta returned by server
    setHorarios(prev => prev.map(x =>
      x.id === h.id ? { ...x, estado: 'disponible', disponible_hasta: res.disponible_hasta ?? null } : x
    ))
    // Reset multi-booking options after saving
    setDurPermitirMultiples(false)
    setDurBufferMinutos(2)
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

  const [confirmBatch, setConfirmBatch] = useState(false)
  const [confirmBatchLV, setConfirmBatchLV] = useState(false)
  const [warnSlot, setWarnSlot] = useState<{ h: Horario; dateStr: string; names: string[] } | null>(null)

  // ── Batch ──────────────────────────────────────────────────────────────────
  async function batchNoDisponible(modo: 'semana' | 'permanente') {
    setConfirmBatch(false)
    if (modo === 'semana') {
      // Truncate disponible_hasta to one day before the viewed week starts
      const d = new Date(toDateStr(weekDates[0]) + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const nuevoHasta = d.toISOString().split('T')[0]
      const activeIds = horarios.filter(h => isSlotActiveOnDate(h, toDateStr(weekDates[0]))).map(h => h.id)
      if (activeIds.length === 0) return
      setHorarios(prev => prev.map(h =>
        activeIds.includes(h.id) ? { ...h, disponible_hasta: nuevoHasta } : h
      ))
      startTransition(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('horarios')
          .update({ disponible_hasta: nuevoHasta })
          .in('id', activeIds)
      })
    } else {
      setHorarios(prev => prev.map(h => ({ ...h, estado:'no_disponible', disponible_hasta: null })))
      startTransition(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('horarios').update({ estado:'no_disponible', disponible_hasta: null }).eq('profesor_id', profesorId)
      })
    }
  }
  async function batchLV(modo: 'semana' | 'permanente') {
    setConfirmBatchLV(false)
    const lv = ['lunes','martes','miércoles','jueves','viernes']
    const disponible_hasta = modo === 'semana'
      ? toDateStr(weekDates[weekDates.length - 1])
      : null
    setHorarios(prev => prev.map(h => ({
      ...h,
      estado: lv.includes(h.dia_semana) ? 'disponible' : h.estado,
      disponible_hasta: lv.includes(h.dia_semana) ? disponible_hasta : h.disponible_hasta,
    })))
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('horarios')
        .update({ estado:'disponible', disponible_hasta })
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
            {confirmBatch ? (
              <span className="flex flex-col gap-1.5 p-2 border border-amber-700/60 rounded-lg bg-amber-950/30 min-w-0">
                <span className="text-[10px] text-amber-300 font-medium">¿Cuánto tiempo desactivar?</span>
                {nReservasActivasSemana > 0 && (
                  <span className="text-[10px] text-red-400">⚠ {nReservasActivasSemana} reserva{nReservasActivasSemana > 1 ? 's' : ''} activa{nReservasActivasSemana > 1 ? 's' : ''} en esta semana</span>
                )}
                <span className="flex gap-1.5 flex-wrap">
                  <button onClick={() => batchNoDisponible('semana')} className="text-[10px] text-amber-300 border border-amber-700 px-2 py-1 rounded hover:bg-amber-900/40 transition-colors">
                    Solo {weekOffset === 0 ? 'esta semana' : 'semana vista'}
                  </button>
                  <button onClick={() => batchNoDisponible('permanente')} className="text-[10px] text-red-400 border border-red-800 px-2 py-1 rounded hover:bg-red-900/30 transition-colors">
                    Permanente (todo)
                  </button>
                  <button onClick={() => setConfirmBatch(false)} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">Cancelar</button>
                </span>
              </span>
            ) : (
              <button onClick={() => setConfirmBatch(true)} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                Todo NO disp
              </button>
            )}
            {confirmBatchLV ? (
              <span className="flex flex-col gap-1.5 p-2 border border-emerald-800/60 rounded-lg bg-emerald-950/20 min-w-0">
                <span className="text-[10px] text-emerald-300 font-medium">¿Por cuánto tiempo activar L–V?</span>
                <span className="flex gap-1.5 flex-wrap">
                  <button onClick={() => batchLV('semana')} className="text-[10px] text-emerald-300 border border-emerald-700 px-2 py-1 rounded hover:bg-emerald-900/40 transition-colors">
                    Solo {weekOffset === 0 ? 'esta semana' : 'semana vista'}
                  </button>
                  <button onClick={() => batchLV('permanente')} className="text-[10px] text-emerald-400 border border-emerald-800 px-2 py-1 rounded hover:bg-emerald-900/30 transition-colors">
                    Permanente
                  </button>
                  <button onClick={() => setConfirmBatchLV(false)} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">Cancelar</button>
                </span>
              </span>
            ) : (
              <button onClick={() => setConfirmBatchLV(true)} className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                L–V dispon
              </button>
            )}
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
                <button onClick={() => { setDurPicker(null); setDurDateStr(null); setDurConflicto(null) }} className="text-gray-400 hover:text-white p-2">✕</button>
              </div>
              {durConflicto && (
                <div className="flex items-start gap-2 px-3 py-2 bg-orange-950/50 border border-orange-700/60 rounded-lg">
                  <span className="text-orange-400 text-sm flex-shrink-0">⚠</span>
                  <p className="text-xs text-orange-300">
                    Este horario coincide con: <strong>{durConflicto}</strong>.
                    Puedes activarlo de todas formas, pero ese bloque ya está ocupado en tu agenda.
                  </p>
                </div>
              )}
              {/* Multi-booking options */}
              <div className="border border-gray-700 rounded-lg px-3 py-2.5 space-y-2.5 bg-gray-800/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 accent-brand-500"
                    checked={durPermitirMultiples}
                    onChange={e => setDurPermitirMultiples(e.target.checked)}
                  />
                  <span className="text-xs text-gray-300">Permitir múltiples estudiantes por turno</span>
                </label>
                {durPermitirMultiples && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-gray-500">Buffer entre turnos:</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className="input text-xs w-16 py-1"
                      value={durBufferMinutos}
                      onChange={e => setDurBufferMinutos(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                )}
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

        {/* Warn slot overlay: reservas activas al desactivar horario */}
        {warnSlot && (
          <div className="border-2 border-amber-500 rounded-lg bg-gray-800 shadow-xl px-4 py-4 space-y-3 relative z-10 my-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-lg flex-shrink-0">⚠</span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Reservas activas en este horario
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Si desactivas este slot, las siguientes reservas quedarán invisibles en el calendario (no se cancelan automáticamente):
                </p>
              </div>
            </div>
            <ul className="text-xs text-amber-200 space-y-0.5 pl-6">
              {warnSlot.names.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => { doDeactivate(warnSlot.h, warnSlot.dateStr); setWarnSlot(null) }}
                className="text-[12px] font-medium px-3 py-2 rounded-lg border border-red-700 bg-red-900/40 text-red-300 hover:bg-red-700/50 transition-all"
              >
                Desactivar de todas formas
              </button>
              <button
                onClick={() => setWarnSlot(null)}
                className="text-[12px] font-medium px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

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
                  const hasSomething = diaKeys.some(dia => horarioMap.has(`${dia}|${time}`))
                  if (!hasSomething) return null
                  return (
                    <tr key={time}>
                      <td className="pr-1 text-right text-gray-600 py-0.5 text-[9px] whitespace-nowrap">{time}</td>
                      {activeDias.map(date => {
                        const diaKey  = DAY_JS[date.getDay()]
                        const dateStr = toDateStr(date)
                        const h = horarioMap.get(`${diaKey}|${time}`)
                        const clase = claseMap.get(`${diaKey}|${time}`)

                        if (!h) return <td key={dateStr} className="px-0.5 py-0.5" />

                        const popKey  = `${h.id}|${dateStr}`
                        const reserva = reservaBySlotDate.get(popKey)
                          ?? reservaByDiaHoraFecha.get(`${diaKey}|${time}|${dateStr}`)
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
                                className={`w-full min-h-[20px] h-auto py-0.5 px-1 rounded border text-[9px] font-medium transition-colors truncate ${
                                  isOpen
                                    ? 'bg-violet-600/80 border-violet-400 text-white ring-1 ring-violet-400'
                                    : 'bg-violet-900/40 border-violet-700/60 text-violet-300 hover:bg-violet-700/50'
                                }`}
                                title={reserva!.estudiante_nombre}
                              >
                                {reserva!.estudiante_nombre.split(' ')[0]}
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
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {reserva.modalidad === 'virtual' && (
                                          <span className="text-[9px] bg-violet-900/40 border border-violet-700 text-violet-300 px-1 py-0.5 rounded">💻 Virtual</span>
                                        )}
                                        {reserva.modalidad === 'presencial' && (
                                          <span className="text-[9px] bg-emerald-900/30 border border-emerald-800 text-emerald-400 px-1 py-0.5 rounded">🏫 Presencial</span>
                                        )}
                                        {reserva.modalidad === 'otro' && (
                                          <span className="text-[9px] bg-gray-800 border border-gray-700 text-gray-400 px-1 py-0.5 rounded">📋 Otro</span>
                                        )}
                                        {reserva.link_zoom && (
                                          <a href={reserva.link_zoom} target="_blank" rel="noopener noreferrer"
                                            className="text-[9px] text-violet-400 underline hover:text-violet-300 truncate max-w-[100px]">
                                            Zoom
                                          </a>
                                        )}
                                      </div>
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
                        const isSaving = savingId === h.id
                        return (
                          <td key={dateStr} className="px-0.5 py-0.5">
                            <button
                              onClick={() => !isSaving && toggleSlot(h, dateStr)}
                              disabled={isSaving}
                              title={h.permite_multiples ? 'Multi-turno activo' : undefined}
                              className={`w-full h-5 rounded border transition-colors relative ${
                                isSaving
                                  ? 'border-emerald-700/40 bg-emerald-900/20 opacity-60 cursor-wait'
                                  : 'border-emerald-800/60 bg-emerald-900/30 hover:bg-emerald-700/50'
                              }`}
                            >
                              {h.permite_multiples && !isSaving && (
                                <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400 -mt-0.5 -mr-0.5" title="Multi-turno" />
                              )}
                            </button>
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
              <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-violet-900/10 border border-violet-900/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
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
                  <div className="flex items-center gap-1.5 ml-8 mt-0.5 flex-wrap">
                    {r.modalidad === 'virtual' && (
                      <span className="text-[9px] bg-violet-900/40 border border-violet-700 text-violet-300 px-1 py-0.5 rounded">💻 Virtual</span>
                    )}
                    {r.modalidad === 'presencial' && (
                      <span className="text-[9px] bg-emerald-900/30 border border-emerald-800 text-emerald-400 px-1 py-0.5 rounded">🏫 Presencial</span>
                    )}
                    {r.modalidad === 'otro' && (
                      <span className="text-[9px] bg-gray-800 border border-gray-700 text-gray-400 px-1 py-0.5 rounded">📋 Otro</span>
                    )}
                    {r.link_zoom && (
                      <a href={r.link_zoom} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-violet-400 underline hover:text-violet-300 truncate max-w-[120px]">
                        Enlace Zoom
                      </a>
                    )}
                  </div>
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

      {/* ── Tipos de tutoría ──────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <button
          onClick={() => { setShowTipos(v => !v); setTipoMsg(null) }}
          className="flex items-center gap-2 w-full text-left"
        >
          <svg className={`w-3.5 h-3.5 text-brand-400 transition-transform ${showTipos ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-semibold text-white">Tipos de tutoría</span>
          <span className="text-[10px] text-gray-500 ml-1">({tiposLocal.length})</span>
        </button>

        {showTipos && (
          <div className="space-y-3 pt-1">
            {tipoMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                tipoMsg.startsWith('✓')
                  ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
                  : 'bg-red-900/30 border-red-800 text-red-300'
              }`}>{tipoMsg}</div>
            )}

            {/* Tabla de tipos */}
            {tiposLocal.length > 0 && (
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-800/40">
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Tipo</th>
                      <th className="text-center px-3 py-2 text-gray-400 font-medium">Duración</th>
                      <th className="text-right px-3 py-2 text-gray-400 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tiposLocal.map(tipo => (
                      <tr key={tipo.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-200">{tipo.nombre}</span>
                            {tipo.es_global && (
                              <span className="text-[9px] bg-blue-900/40 border border-blue-800 text-blue-400 px-1 py-0.5 rounded">Global</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400">{tipo.duracion_minutos} min</td>
                        <td className="px-3 py-2 text-right">
                          {!tipo.es_global && (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => {
                                  setTipoEditId(tipo.id)
                                  setTipoNombre(tipo.nombre)
                                  setTipoDuracion(tipo.duracion_minutos)
                                }}
                                className="text-[10px] text-gray-400 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`¿Eliminar "${tipo.nombre}"?`)) return
                                  const res = await eliminarTipoTutoria(tipo.id)
                                  if (res.error) { setTipoMsg(`❌ ${res.error}`); return }
                                  setTiposLocal(prev => prev.filter(t => t.id !== tipo.id))
                                  setTipoMsg('✓ Tipo eliminado')
                                }}
                                className="text-[10px] text-red-400 border border-red-900 px-2 py-0.5 rounded hover:bg-red-950 transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Form: crear o editar */}
            <div className="border border-gray-700 rounded-lg px-3 py-3 space-y-2.5 bg-gray-800/30">
              <p className="text-xs font-semibold text-gray-400">
                {tipoEditId ? 'Editar tipo' : '+ Agregar tipo'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Nombre</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Ej: Duda rápida o aclaración"
                    value={tipoNombre}
                    onChange={e => setTipoNombre(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="label text-xs">Duración (minutos)</label>
                  <input
                    type="number"
                    className="input text-xs"
                    min={5}
                    max={180}
                    value={tipoDuracion}
                    onChange={e => setTipoDuracion(Math.max(5, parseInt(e.target.value) || 5))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!tipoNombre.trim() || tipoSaving}
                  onClick={async () => {
                    if (!tipoNombre.trim()) return
                    setTipoSaving(true); setTipoMsg(null)
                    if (tipoEditId) {
                      const res = await actualizarTipoTutoria(tipoEditId, { nombre: tipoNombre.trim(), duracion_minutos: tipoDuracion })
                      if (res.error) { setTipoMsg(`❌ ${res.error}`) }
                      else {
                        setTiposLocal(prev => prev.map(t => t.id === tipoEditId ? { ...t, nombre: tipoNombre.trim(), duracion_minutos: tipoDuracion } : t))
                        setTipoMsg('✓ Tipo actualizado')
                        setTipoEditId(null); setTipoNombre(''); setTipoDuracion(20)
                      }
                    } else {
                      const res = await crearTipoTutoria({ nombre: tipoNombre.trim(), duracion_minutos: tipoDuracion })
                      if (res.error) { setTipoMsg(`❌ ${res.error}`) }
                      else {
                        setTiposLocal(prev => [...prev, { id: res.id!, nombre: tipoNombre.trim(), duracion_minutos: tipoDuracion, descripcion: null, es_global: false, activo: true, orden: prev.length + 1 }])
                        setTipoMsg('✓ Tipo creado')
                        setTipoNombre(''); setTipoDuracion(20)
                      }
                    }
                    setTipoSaving(false)
                  }}
                  className="btn-primary text-xs disabled:opacity-40"
                >
                  {tipoSaving ? '...' : tipoEditId ? 'Guardar cambios' : 'Crear tipo'}
                </button>
                {tipoEditId && (
                  <button
                    onClick={() => { setTipoEditId(null); setTipoNombre(''); setTipoDuracion(20) }}
                    className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded hover:bg-gray-800 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Close grid popover on outside click (durPicker is inline — no overlay needed) */}
      {popover && (
        <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
      )}
    </div>
  )
}
