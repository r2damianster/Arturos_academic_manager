'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { anunciarAsistenciaTutoria, cancelarAnuncioTutoria } from '@/lib/actions/tutorias'

interface Horario {
  id: number
  profesor_id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  disponible_hasta: string | null
  profesores: { nombre: string } | null
}

interface Reserva {
  id: number
  horario_id: number
  fecha: string
  estado: string
  notas: string | null
  horarios: { dia_semana: string; hora_inicio: string; hora_fin: string } | null
}

interface OccupiedSlot { horario_id: number; fecha: string }

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  profesor_id: string
  tipo: string
  curso_id: string | null
}

interface StudentInfo {
  nombre: string; email: string; carrera: string | null
  telefono: string | null; auth_user_id: string
}

interface Props {
  horarios: Horario[]
  clases: Clase[]
  occupiedSlots: OccupiedSlot[]
  misReservas: Reserva[]
  studentInfo: StudentInfo
  estudianteCursoIds: string[]
  estudianteByCurso: Record<string, string>
  misAnuncios: { horario_clase_id: string; fecha: string; estudiante_id: string }[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_JS: Record<number, string> = {
  1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado',
}
const DAY_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MAX_WEEK_OFFSET = 16 // ~4 months ahead

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  const dow   = today.getDay()
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

function fmtDateRange(dates: Date[]): string {
  const a = dates[0], b = dates[dates.length - 1]
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTH_SHORT[a.getMonth()]}`
    : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`
}

function fmt(t: string) { return t?.slice(0, 5) ?? '' }

function isSlotActiveOnDate(h: Horario, dateStr: string): boolean {
  if (h.estado !== 'disponible') return false
  if (!h.disponible_hasta) return true
  return dateStr <= h.disponible_hasta
}

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

export function TutoriasBooking({
  horarios: initH,
  clases: initClases,
  occupiedSlots: initOcc,
  misReservas: initR,
  studentInfo,
  estudianteCursoIds,
  estudianteByCurso,
  misAnuncios,
}: Props) {
  const supabase = createClient()
  const [horarios]  = useState<Horario[]>(initH)
  const [clases]    = useState<Clase[]>(initClases)
  const [occupied, setOccupied] = useState<OccupiedSlot[]>(initOcc)
  const [reservas, setReservas] = useState<Reserva[]>(initR)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<{ horario: Horario; date: Date } | null>(null)
  const [notas,   setNotas]   = useState('')
  const [loading, setLoading] = useState(false)
  const [canceling, setCanceling] = useState<number | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Announce state: `horario_clase_id|fecha`
  const [localAnuncios, setLocalAnuncios] = useState<Set<string>>(
    () => new Set(misAnuncios.map(a => `${a.horario_clase_id}|${a.fecha}`))
  )
  const [anuncioLoading, setAnuncioLoading] = useState<string | null>(null)

  const weekDates    = getWeekDates(weekOffset)

  // Group horarios by profesor
  const profesorIds = [...new Set(horarios.map(h => h.profesor_id))]
  const byProf: Record<string, Horario[]> = {}
  for (const h of horarios) {
    if (!byProf[h.profesor_id]) byProf[h.profesor_id] = []
    byProf[h.profesor_id].push(h)
  }
  const [activePid, setActivePid] = useState(profesorIds[0] ?? '')

  const profHorarios = byProf[activePid] ?? []

  // Slot lookup by (dia|hora)
  const slotMap = new Map<string, Horario>()
  for (const h of profHorarios) slotMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)

  // Occupied set: `horarioId|dateStr`
  const occupiedSet = new Set(occupied.map(o => `${o.horario_id}|${o.fecha}`))

  // Clases map for active professor: `dia|time` → Clase
  const profClases = clases.filter(c => c.profesor_id === activePid)
  const claseMap = new Map<string, Clase>() // `dia|time` → Clase
  for (const c of profClases) {
    const start = fmt(c.hora_inicio)
    const end = fmt(c.hora_fin)
    for (const slot of TIME_SLOTS) {
      if (slot >= start && slot < end) {
        claseMap.set(`${c.dia_semana}|${slot}`, c)
      }
    }
  }

  // My reservas set: `horarioId|dateStr`
  const mySet = new Set(reservas.map(r => `${r.horario_id}|${r.fecha}`))

  // Active days: any tutoria slot OR any class from the student's own course
  const activeDias = weekDates.filter(date => {
    const diaKey = DAY_JS[date.getDay()]
    const hasTutoriaSlot = profHorarios.some(h => h.dia_semana === diaKey)
    const hasPropiaCurso = profClases.some(c =>
      c.dia_semana === diaKey &&
      estudianteCursoIds.includes(c.curso_id ?? '')
    )
    return hasTutoriaSlot || hasPropiaCurso
  })

  // ── Toggle tutoria_curso announce ─────────────────────────────────────────
  async function handleAnuncio(clase: Clase, dateStr: string) {
    const key = `${clase.id}|${dateStr}`
    const isAnnounced = localAnuncios.has(key)
    // Resolve the correct estudiante_id for this class's course
    const estudianteId = (clase.curso_id && estudianteByCurso[clase.curso_id])
      ? estudianteByCurso[clase.curso_id]
      : Object.values(estudianteByCurso)[0] ?? ''
    setAnuncioLoading(key)
    setError(null)
    try {
      if (isAnnounced) {
        const res = await cancelarAnuncioTutoria({
          horarioClaseId: clase.id,
          estudianteId,
          fecha: dateStr,
        })
        if (res.error) throw new Error(res.error)
        setLocalAnuncios(prev => { const s = new Set(prev); s.delete(key); return s })
        setSuccess('Asistencia cancelada.')
      } else {
        const res = await anunciarAsistenciaTutoria({
          horarioClaseId: clase.id,
          estudianteId,
          fecha: dateStr,
        })
        if (res.error) throw new Error(res.error)
        setLocalAnuncios(prev => new Set([...prev, key]))
        setSuccess('¡Asistencia confirmada!')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar asistencia')
    } finally {
      setAnuncioLoading(null)
    }
  }

  // ── Confirm booking ────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!selected) return
    setLoading(true); setError(null)
    const sessionDate = toDateStr(selected.date)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc('reservar_tutoria', {
        p_horario_id:   selected.horario.id,
        p_nombre:       studentInfo.nombre,
        p_carrera:      studentInfo.carrera ?? '',
        p_email:        studentInfo.email,
        p_telefono:     studentInfo.telefono ?? '',
        p_auth_user_id: studentInfo.auth_user_id,
        p_notas:        notas || null,
        p_fecha:        sessionDate,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { ok: boolean; error?: string; reserva_id?: number }
      if (!result.ok) throw new Error(result.error ?? 'Error al reservar')

      const newReserva: Reserva = {
        id: result.reserva_id ?? Math.random(),
        horario_id: selected.horario.id,
        fecha: sessionDate,
        estado: 'pendiente',
        notas: notas || null,
        horarios: {
          dia_semana: selected.horario.dia_semana,
          hora_inicio: selected.horario.hora_inicio,
          hora_fin: selected.horario.hora_fin,
        },
      }
      setReservas(prev => [...prev, newReserva])
      setOccupied(prev => [...prev, { horario_id: selected.horario.id, fecha: sessionDate }])
      setSuccess(`Tutoría agendada: ${selected.horario.dia_semana} ${sessionDate} ${fmt(selected.horario.hora_inicio)}`)
      setSelected(null); setNotas('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar')
    } finally {
      setLoading(false)
    }
  }

  // ── Cancel booking ─────────────────────────────────────────────────────────
  async function handleCancelar(r: Reserva) {
    setCanceling(r.id); setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc('cancelar_mi_reserva', { p_reserva_id: r.id })
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Error al cancelar')
      setReservas(prev => prev.filter(x => x.id !== r.id))
      setOccupied(prev => prev.filter(o => !(o.horario_id === r.horario_id && o.fecha === r.fecha)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCanceling(null)
    }
  }

  if (horarios.length === 0 && profClases.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 text-sm">No hay horarios de tutoría disponibles para tus cursos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Feedback global */}
      {success && (
        <div className="px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm flex justify-between">
          <span>✓ {success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-600">✕</button>
        </div>
      )}

      {/* My active reservas */}
      {reservas.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-white">Mis tutorías agendadas</h2>
          {reservas.map(r => {
            const ini = r.horarios?.hora_inicio ? fmt(r.horarios.hora_inicio) : '—'
            const fin = r.horarios?.hora_fin    ? fmt(r.horarios.hora_fin)    : '—'
            const profH = horarios.find(h => h.id === r.horario_id)
            const dateLabel = r.fecha
              ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })
              : '—'
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-800">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-200 capitalize">{dateLabel} · {ini}–{fin}</p>
                  <p className="text-xs text-blue-400">Prof. {profH?.profesores?.nombre ?? '—'}</p>
                  {r.notas && <p className="text-xs text-gray-500 italic truncate">"{r.notas}"</p>}
                </div>
                <button onClick={() => handleCancelar(r)} disabled={canceling === r.id}
                  className="flex-shrink-0 text-xs text-red-400 border border-red-800 px-2 py-1 rounded hover:bg-red-950 transition-colors disabled:opacity-40">
                  {canceling === r.id ? '...' : 'Cancelar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Grid */}
      <div className="card space-y-3">
        {/* Professor tabs */}
        {profesorIds.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {profesorIds.map(pid => (
              <button key={pid} onClick={() => { setActivePid(pid); setSelected(null) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activePid === pid ? 'bg-brand-700/40 border-brand-500 text-brand-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {byProf[pid]?.[0]?.profesores?.nombre ?? 'Profesor'}
              </button>
            ))}
          </div>
        )}
        {profesorIds.length === 1 && (
          <p className="text-xs text-gray-400">
            Prof. <span className="text-white font-medium">{byProf[profesorIds[0]]?.[0]?.profesores?.nombre ?? '—'}</span>
          </p>
        )}

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWeekOffset(o => Math.max(0, o - 1)); setSelected(null) }}
            disabled={weekOffset === 0}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-medium text-white flex-1 text-center">
            {weekOffset === 0 ? 'Semana actual · ' : ''}{fmtDateRange(weekDates)}
          </span>
          <button
            onClick={() => { setWeekOffset(o => Math.min(MAX_WEEK_OFFSET, o + 1)); setSelected(null) }}
            disabled={weekOffset >= MAX_WEEK_OFFSET}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-950/50 border border-indigo-800/60 inline-block"/>Clase</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-900/60 border border-emerald-600 inline-block"/>Disponible</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-900/60 border border-orange-600 inline-block"/>Tutoría de curso</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-violet-900/60 border border-violet-700 inline-block"/>Agendado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-900/60 border border-blue-700 inline-block"/>Tu reserva</span>
        </div>

        {/* Calendar grid */}
        {activeDias.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No hay horarios disponibles esta semana.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]" style={{ minWidth: 280 }}>
              <thead>
                <tr>
                  <th className="w-12 pr-2 text-right text-gray-600 font-normal pb-1.5 text-[10px]">Hora</th>
                  {activeDias.map(date => {
                    const isToday = toDateStr(date) === toDateStr(new Date())
                    return (
                      <th key={toDateStr(date)} className="text-center font-medium pb-1.5 px-1 min-w-[56px]">
                        <div className={`text-[10px] font-semibold ${isToday ? 'text-brand-400' : 'text-gray-400'}`}>
                          {DAY_SHORT[date.getDay()]}
                        </div>
                        <div className={`text-[12px] font-bold ${isToday ? 'text-brand-300' : 'text-gray-200'}`}>
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
                  const hasSomething = activeDias.some(date => {
                    const diaKey = DAY_JS[date.getDay()]
                    const hasSlot = slotMap.has(`${diaKey}|${time}`)
                    const c = claseMap.get(`${diaKey}|${time}`)
                    const hasPropiaCurso = !!c && estudianteCursoIds.includes(c.curso_id ?? '')
                    return hasSlot || hasPropiaCurso
                  })
                  if (!hasSomething) return null
                  return (
                    <tr key={time}>
                      <td className="pr-2 text-right text-gray-600 py-0.5 text-[10px] whitespace-nowrap">{time}</td>
                      {activeDias.map(date => {
                        const diaKey  = DAY_JS[date.getDay()]
                        const dateStr = toDateStr(date)
                        const slot    = slotMap.get(`${diaKey}|${time}`)
                        const clase   = claseMap.get(`${diaKey}|${time}`)

                        const slotKey  = `${slot?.id}|${dateStr}`
                        const isMine   = slot ? mySet.has(slotKey) : false
                        const isOccupied = slot ? (occupiedSet.has(slotKey) && !isMine) : false
                        const activeOnDate = slot ? isSlotActiveOnDate(slot, dateStr) : false

                        // Any class belonging to the student's own course
                        const isPropiaCurso = !!clase && estudianteCursoIds.includes(clase.curso_id ?? '')
                        // tutoria_curso of student's own course — orange announce
                        const isTutoriaCurso = isPropiaCurso && clase!.tipo === 'tutoria_curso'
                        // any other class type of student's own course (clase, centro_computo, etc.)
                        const isClasePropia = isPropiaCurso && !isTutoriaCurso
                        // class of a different course — show as blocked
                        const isOtroCurso = !!clase && !isPropiaCurso

                        // No slot + no own class → empty cell
                        if (!activeOnDate && !isMine && !isPropiaCurso) return <td key={dateStr} className="px-1 py-0.5" />

                        if (isMine) {
                          return (
                            <td key={dateStr} className="px-1 py-0.5">
                              <div className="h-7 rounded border border-blue-700 bg-blue-900/40 flex items-center justify-center">
                                <span className="text-blue-300 text-[9px] font-medium">✓ Mío</span>
                              </div>
                            </td>
                          )
                        }

                        // tutoria_curso — orange announce button
                        if (isTutoriaCurso) {
                          const anuncioKey = `${clase!.id}|${dateStr}`
                          const isAnnounced = localAnuncios.has(anuncioKey)
                          const isLoadingThis = anuncioLoading === anuncioKey
                          return (
                            <td key={dateStr} className="px-1 py-0.5">
                              <button
                                onClick={() => handleAnuncio(clase!, dateStr)}
                                disabled={isLoadingThis}
                                title={isAnnounced ? 'Cancelar asistencia' : 'Confirmar que asistiré'}
                                className={`w-full h-7 rounded border text-[9px] font-medium transition-colors disabled:opacity-50 ${
                                  isLoadingThis
                                    ? 'bg-orange-900/30 border-orange-700 text-orange-500'
                                    : isAnnounced
                                      ? 'bg-orange-600/70 border-orange-400 text-white ring-1 ring-orange-400'
                                      : 'bg-orange-900/40 border-orange-700 text-orange-300 hover:bg-orange-700/60'
                                }`}
                              >
                                {isLoadingThis ? '...' : isAnnounced ? '✓ Asistiré' : 'Asistiré'}
                              </button>
                            </td>
                          )
                        }

                        // Class of another course — invisible
                        if (isOtroCurso) return <td key={dateStr} className="px-1 py-0.5" />

                        // Class of student's own course (clase, centro_computo, etc.)
                        if (isClasePropia) {
                          const label =
                            clase!.tipo === 'clase' ? 'Clase'
                            : clase!.tipo === 'centro_computo' ? 'Centro Cómputo'
                            : clase!.tipo
                          return (
                            <td key={dateStr} className="px-1 py-0.5">
                              <div className="h-7 rounded border border-indigo-800/60 bg-indigo-950/50 flex items-center justify-center pointer-events-none">
                                <span className="text-indigo-400 text-[9px] font-medium">{label}</span>
                              </div>
                            </td>
                          )
                        }

                        // Occupied by another student
                        if (isOccupied) {
                          return (
                            <td key={dateStr} className="px-1 py-0.5">
                              <div className="h-7 rounded border border-violet-900 bg-violet-950/40 flex items-center justify-center pointer-events-none">
                                <span className="text-violet-500 text-[9px]">Agendado</span>
                              </div>
                            </td>
                          )
                        }

                        if (!slot || !activeOnDate) return <td key={dateStr} className="px-1 py-0.5" />

                        // disponible — book button
                        const isSelected = selected?.horario.id === slot.id && toDateStr(selected.date) === dateStr
                        return (
                          <td key={dateStr} className="px-1 py-0.5">
                            <button
                              onClick={() => {
                                if (isSelected) { setSelected(null) } else { setSelected({ horario: slot, date }); setNotas(''); setError(null) }
                              }}
                              className={`w-full h-7 rounded border text-[9px] font-medium transition-colors ${
                                isSelected
                                  ? 'bg-emerald-600/80 border-emerald-400 text-white ring-1 ring-emerald-400'
                                  : 'bg-emerald-900/40 border-emerald-700 text-emerald-300 hover:bg-emerald-700/60'
                              }`}
                            >
                              {fmt(slot.hora_inicio)}
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

      {/* Sidebar overlay */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => { setSelected(null); setNotas('') }}
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col bg-gray-900 border-l border-gray-700 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h3 className="font-semibold text-white">Agendar tutoría</h3>
                <p className="text-xs text-gray-400 mt-0.5">Reserva una sesión con tu profesor</p>
              </div>
              <button
                onClick={() => { setSelected(null); setNotas('') }}
                className="text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg p-1.5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Date & time */}
              <div className="rounded-xl bg-emerald-900/20 border border-emerald-800/50 px-4 py-3 space-y-1">
                <p className="text-white font-semibold capitalize">
                  {selected.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-emerald-300 text-sm">
                  {fmt(selected.horario.hora_inicio)} – {fmt(selected.horario.hora_fin)}
                </p>
                <p className="text-gray-400 text-xs">
                  Prof. {selected.horario.profesores?.nombre ?? '—'}
                </p>
              </div>

              {/* Student info */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tus datos</p>
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 divide-y divide-gray-700">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Nombre</span>
                    <span className="text-sm text-gray-200 font-medium">{studentInfo.nombre}</span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Correo</span>
                    <span className="text-xs text-gray-300 truncate max-w-[160px]">{studentInfo.email}</span>
                  </div>
                  {studentInfo.carrera && (
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Carrera</span>
                      <span className="text-xs text-gray-300 truncate max-w-[160px]">{studentInfo.carrera}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider" htmlFor="notas-input">
                  Motivo / Notas <span className="text-gray-700 normal-case font-normal">(opcional)</span>
                </label>
                <textarea
                  id="notas-input"
                  className="input resize-none text-sm w-full"
                  rows={3}
                  placeholder="Ej. Tengo dudas sobre el ensayo del tema 3..."
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  maxLength={300}
                />
                <p className="text-right text-[10px] text-gray-600">{notas.length}/300</p>
              </div>

              {/* Error inline */}
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-gray-800 space-y-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="btn-primary w-full text-sm py-3 disabled:opacity-60"
              >
                {loading ? 'Confirmando...' : '✓ Confirmar reserva'}
              </button>
              <button
                onClick={() => { setSelected(null); setNotas('') }}
                disabled={loading}
                className="btn-ghost w-full text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
