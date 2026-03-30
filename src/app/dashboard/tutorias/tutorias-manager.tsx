'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string   // 'disponible' | 'no_disponible'
  profesor_id: string
}

interface Reserva {
  id: number
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  telefono: string
  fecha: string          // YYYY-MM-DD (session date)
  horario_id: number
  estado: string         // pendiente | completada | cancelado
  cancelado_por?: string | null
  cancelado_at?: string | null
  asistio?: boolean | null
  completada_at?: string | null
  notas?: string | null
}

interface Props { horarios: Horario[]; reservas: Reserva[] }

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_JS: Record<number, string> = {
  1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado',
}
const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MAX_WEEK_OFFSET = 4

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  const dow = today.getDay()
  const start = new Date(today)
  if (dow === 0) start.setDate(start.getDate() + 1) // Sunday → next Monday
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

function fmtDateRange(dates: Date[]): string {
  const a = dates[0], b = dates[dates.length - 1]
  const sameMonth = a.getMonth() === b.getMonth()
  if (sameMonth) return `${a.getDate()}–${b.getDate()} ${MONTH_SHORT[a.getMonth()]}`
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`
}

function fmt(t: string) { return t?.slice(0, 5) ?? '' }
function initials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }

// ─── Time slots ───────────────────────────────────────────────────────────────

function getSlots(): string[] {
  const s: string[] = []
  for (let h = 7; h <= 19; h++) {
    s.push(`${String(h).padStart(2,'0')}:00`)
    s.push(`${String(h).padStart(2,'0')}:30`)
  }
  return s.filter(x => x <= '19:30')
}
const TIME_SLOTS = getSlots()

// ─── Component ────────────────────────────────────────────────────────────────

export function TutoriasManager({ horarios: init, reservas: initRes }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios]     = useState<Horario[]>(init)
  const [reservas, setReservas]     = useState<Reserva[]>(initRes)
  const [, startTransition]         = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [popover, setPopover]       = useState<string | null>(null) // `${horarioId}|${dateStr}`
  const [acting,  setActing]        = useState<number | null>(null)
  const [err, setErr]               = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Historial filters
  const [fNombre,  setFNombre]  = useState('')
  const [fCarrera, setFCarrera] = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')

  const profesorId = horarios[0]?.profesor_id ?? ''

  // Current week dates
  const weekDates  = getWeekDates(weekOffset)
  const weekDateStrs = weekDates.map(toDateStr)

  // Lookup: dia_semana → horarios for that day
  const horarioMap = new Map<string, Horario>()
  for (const h of horarios) {
    horarioMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)
  }

  // Lookup: `horarioId|dateStr` → pending reserva
  const reservaBySlotDate = new Map<string, Reserva>()
  for (const r of reservas) {
    if (r.estado === 'pendiente') {
      reservaBySlotDate.set(`${r.horario_id}|${r.fecha}`, r)
    }
  }

  const pendientes = reservas.filter(r => r.estado === 'pendiente')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const historial  = reservas.filter(r => r.estado !== 'pendiente')

  const historialFiltrado = historial.filter(r => {
    if (fNombre  && !r.estudiante_nombre.toLowerCase().includes(fNombre.toLowerCase()))   return false
    if (fCarrera && !r.estudiante_carrera.toLowerCase().includes(fCarrera.toLowerCase())) return false
    if (fDesde   && r.fecha < fDesde) return false
    if (fHasta   && r.fecha > fHasta) return false
    return true
  })

  const nDisp = horarios.filter(h => h.estado === 'disponible').length

  // ── Toggle individual slot ─────────────────────────────────────────────────
  async function toggleSlot(h: Horario, dateStr: string) {
    const key = `${h.id}|${dateStr}`
    if (reservaBySlotDate.has(key)) { setPopover(popover === key ? null : key); return }
    if (h.estado === 'no_disponible') return // can only toggle disponible slots
    // Toggle disponible ↔ no_disponible by clicking
    const next = h.estado === 'disponible' ? 'no_disponible' : 'disponible'
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, estado: next } : x))
    setErr(null)
    startTransition(async () => {
      const { error } = await supabase.from('horarios').update({ estado: next }).eq('id', h.id)
      if (error) {
        setErr('Error al guardar')
        setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, estado: h.estado } : x))
      }
    })
  }

  // ── Professor actions ──────────────────────────────────────────────────────
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
    setHorarios(prev => prev.map(h => ({ ...h, estado:'no_disponible' })))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado:'no_disponible' }).eq('profesor_id', profesorId)
    })
  }
  async function batchLV() {
    const lv = ['lunes','martes','miércoles','jueves','viernes']
    setHorarios(prev => prev.map(h => ({
      ...h, estado: lv.includes(h.dia_semana) ? 'disponible' : h.estado
    })))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado:'disponible' })
        .eq('profesor_id', profesorId).in('dia_semana', lv)
    })
  }

  // ─── Which days have any horarios ────────────────────────────────────────
  const activeDias = weekDates.filter(date => {
    const diaKey = DAY_JS[date.getDay()]
    return horarios.some(h => h.dia_semana === diaKey)
  })

  // ─── Status badge ─────────────────────────────────────────────────────────
  function StatusBadge({ r }: { r: Reserva }) {
    if (r.estado === 'completada') {
      return r.asistio
        ? <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">Asistió</span>
        : <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">No asistió</span>
    }
    if (r.estado === 'cancelado') {
      return r.cancelado_por === 'estudiante'
        ? <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded">Canceló estudiante</span>
        : <span className="text-[10px] bg-red-900/40 text-red-400 border border-red-800 px-1.5 py-0.5 rounded">Cancelado por prof.</span>
    }
    return null
  }

  return (
    <div className="space-y-3">

      {err && (
        <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-xs flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* ── Grid card ───────────────────────────────────────────────────── */}
      <div className="card space-y-2">

        {/* Week navigation */}
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

          {/* Batch actions + small stats */}
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
        </div>

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
                {TIME_SLOTS.map(time => {
                  const diaKeys = activeDias.map(d => DAY_JS[d.getDay()])
                  const hasSomething = diaKeys.some(dia => horarioMap.has(`${dia}|${time}`))
                  if (!hasSomething) return null
                  return (
                    <tr key={time}>
                      <td className="pr-1 text-right text-gray-600 py-0.5 text-[9px] whitespace-nowrap">{time}</td>
                      {activeDias.map(date => {
                        const diaKey  = DAY_JS[date.getDay()]
                        const dateStr = toDateStr(date)
                        const h       = horarioMap.get(`${diaKey}|${time}`)
                        if (!h) return <td key={dateStr} className="px-0.5 py-0.5" />

                        const popKey = `${h.id}|${dateStr}`
                        const reserva = reservaBySlotDate.get(popKey)
                        const isReserved = !!reserva
                        const isOpen  = popover === popKey

                        if (h.estado === 'no_disponible' && !isReserved) {
                          return (
                            <td key={dateStr} className="px-0.5 py-0.5">
                              <button
                                onClick={() => toggleSlot(h, dateStr)}
                                className="w-full h-5 rounded border border-gray-800/30 bg-gray-900/20 hover:bg-gray-800/40 transition-colors"
                              />
                            </td>
                          )
                        }

                        if (isReserved) {
                          return (
                            <td key={dateStr} className="px-0.5 py-0.5 relative">
                              <button
                                onClick={() => { setPopover(isOpen ? null : popKey) }}
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

                        // disponible
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

      {/* ── Pending reservations ─────────────────────────────────────────── */}
      {pendientes.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-xs font-semibold text-white">Reservas pendientes ({pendientes.length})</h3>
          {pendientes.map(r => {
            const h = horarios.find(x => x.id === r.horario_id)
            const dateLabel = r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' }) : '—'
            return (
              <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-blue-900/10 border border-blue-900/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {initials(r.estudiante_nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.estudiante_nombre}</p>
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

      {/* ── Historial ──────────────────────────────────────────────────── */}
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
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="text" placeholder="Estudiante..." value={fNombre} onChange={e => setFNombre(e.target.value)}
                  className="input text-xs py-1.5"
                />
                <input
                  type="text" placeholder="Carrera..." value={fCarrera} onChange={e => setFCarrera(e.target.value)}
                  className="input text-xs py-1.5"
                />
                <input
                  type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
                  className="input text-xs py-1.5" title="Desde"
                />
                <input
                  type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
                  className="input text-xs py-1.5" title="Hasta"
                />
              </div>
              {(fNombre || fCarrera || fDesde || fHasta) && (
                <button onClick={() => { setFNombre(''); setFCarrera(''); setFDesde(''); setFHasta('') }}
                  className="text-[10px] text-gray-500 hover:text-gray-300">
                  ✕ Limpiar filtros — {historialFiltrado.length} resultado{historialFiltrado.length !== 1 ? 's' : ''}
                </button>
              )}

              {/* Rows */}
              {historialFiltrado.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">Sin resultados</p>
              ) : (
                historialFiltrado.map(r => {
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
                          {r.estudiante_carrera} · {dateLabel}
                          {h ? ` · ${fmt(h.hora_inicio)}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Close popover on outside click */}
      {popover && (
        <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
      )}
    </div>
  )
}
