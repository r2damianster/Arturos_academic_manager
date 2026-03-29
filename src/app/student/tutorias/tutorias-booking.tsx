'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Horario {
  id: string
  profesor_id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: 'disponible' | 'reservado' | 'no_disponible'
  profesores: { nombre: string }
}

interface Reserva {
  id: string
  horario_id: string
  estado: string
  notas: string | null
  horarios: {
    dia_semana: string
    hora_inicio: string
    hora_fin: string
  }
}

interface StudentInfo {
  nombre: string
  email: string
  carrera: string | null
  telefono: string | null
  auth_user_id: string
  estudiante_ids?: string[]
}

interface TutoriasBookingProps {
  horarios: Horario[]
  misReservas: Reserva[]
  studentInfo: StudentInfo
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIAS_ORDER = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  'miércoles': 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sábado: 'Sáb',
}

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 19) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

function formatTime(time: string) {
  return time.slice(0, 5)
}

function getDiaLabel(dia: string) {
  return DIAS_LABEL[dia.toLowerCase()] ?? dia
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TutoriasBooking({ horarios, misReservas, studentInfo }: TutoriasBookingProps) {
  const supabase = createClient()

  // Group horarios by profesor_id
  const profesorIds = [...new Set(horarios.map(h => h.profesor_id))]
  const byProfesor: Record<string, Horario[]> = {}
  for (const h of horarios) {
    if (!byProfesor[h.profesor_id]) byProfesor[h.profesor_id] = []
    byProfesor[h.profesor_id].push(h)
  }

  // Active tab professor
  const [activeProfesorId, setActiveProfesorId] = useState<string>(profesorIds[0] ?? '')

  // Selected slot for booking panel
  const [selectedSlot, setSelectedSlot] = useState<Horario | null>(null)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Local state to optimistically update reservas and horarios
  const [localReservas, setLocalReservas] = useState<Reserva[]>(misReservas)
  const [localHorarios, setLocalHorarios] = useState<Horario[]>(horarios)

  // ── Booking ──────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!selectedSlot) return
    setLoading(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from('reservas').insert({
        estudiante_nombre: studentInfo.nombre,
        estudiante_carrera: studentInfo.carrera ?? '',
        email: studentInfo.email,
        telefono: studentInfo.telefono,
        fecha: new Date().toISOString().split('T')[0],
        horario_id: selectedSlot.id,
        estado: 'pendiente',
        auth_user_id: studentInfo.auth_user_id,
        notas: notas || null,
      })

      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('horarios')
        .update({ estado: 'reservado' })
        .eq('id', selectedSlot.id)

      if (updateError) throw updateError

      // Optimistic local update
      const newReserva: Reserva = {
        id: crypto.randomUUID(),
        horario_id: selectedSlot.id,
        estado: 'pendiente',
        notas: notas || null,
        horarios: {
          dia_semana: selectedSlot.dia_semana,
          hora_inicio: selectedSlot.hora_inicio,
          hora_fin: selectedSlot.hora_fin,
        },
      }
      setLocalReservas(prev => [...prev, newReserva])
      setLocalHorarios(prev =>
        prev.map(h => h.id === selectedSlot.id ? { ...h, estado: 'reservado' } : h)
      )

      setSuccessMsg(`Reserva confirmada para el ${selectedSlot.dia_semana} a las ${formatTime(selectedSlot.hora_inicio)}`)
      setSelectedSlot(null)
      setNotas('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la reserva')
    } finally {
      setLoading(false)
    }
  }

  // ── Cancel reserva ────────────────────────────────────────────────────────

  async function handleCancelarReserva(reserva: Reserva) {
    setError(null)
    try {
      const { error: delError } = await supabase
        .from('reservas')
        .delete()
        .eq('id', reserva.id)

      if (delError) throw delError

      await supabase
        .from('horarios')
        .update({ estado: 'disponible' })
        .eq('id', reserva.horario_id)

      setLocalReservas(prev => prev.filter(r => r.id !== reserva.id))
      setLocalHorarios(prev =>
        prev.map(h => h.id === reserva.horario_id ? { ...h, estado: 'disponible' } : h)
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cancelar la reserva')
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getSlotForCell(profesorId: string, dia: string, time: string): Horario | undefined {
    return localHorarios.find(
      h =>
        h.profesor_id === profesorId &&
        h.dia_semana.toLowerCase() === dia.toLowerCase() &&
        formatTime(h.hora_inicio) === time
    )
  }

  const profesorHorarios = activeProfesorId ? byProfesor[activeProfesorId] ?? [] : []
  const activeDias = DIAS_ORDER.filter(dia =>
    profesorHorarios.some(h => h.dia_semana.toLowerCase() === dia.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (horarios.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 text-sm">No hay horarios de tutoría disponibles para tus cursos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Global feedback messages ── */}
      {successMsg && (
        <div className="px-4 py-3 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm flex items-center justify-between gap-3">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-300 text-lg leading-none">&times;</button>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* ── Section 1: Mis reservas activas ── */}
      {localReservas.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-white text-sm uppercase tracking-wide text-gray-400">
            Mis reservas activas
          </h2>
          <div className="space-y-2">
            {localReservas.map(r => {
              const horario = localHorarios.find(h => h.id === r.horario_id)
              const profesorNombre = horario?.profesores?.nombre ?? '—'
              const dia = r.horarios?.dia_semana ?? '—'
              const inicio = r.horarios?.hora_inicio ? formatTime(r.horarios.hora_inicio) : '—'
              const fin = r.horarios?.hora_fin ? formatTime(r.horarios.hora_fin) : '—'

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-blue-900/20 border border-blue-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-200 capitalize">{dia}</p>
                    <p className="text-xs text-blue-400">{inicio} – {fin} · {profesorNombre}</p>
                    {r.notas && (
                      <p className="text-xs text-gray-500 mt-0.5 italic truncate">{r.notas}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelarReserva(r)}
                    className="flex-shrink-0 text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-1 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section 2: Horarios disponibles ── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wide text-gray-400">
          Horarios disponibles
        </h2>

        {/* Professor tabs — only shown when there are multiple professors */}
        {profesorIds.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {profesorIds.map(pid => {
              const nombre = byProfesor[pid]?.[0]?.profesores?.nombre ?? 'Profesor'
              return (
                <button
                  key={pid}
                  onClick={() => { setActiveProfesorId(pid); setSelectedSlot(null) }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    activeProfesorId === pid
                      ? 'bg-brand-800 border-brand-600 text-brand-200'
                      : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {nombre}
                </button>
              )
            })}
          </div>
        )}

        {/* Single professor label */}
        {profesorIds.length === 1 && (
          <p className="text-sm text-gray-400">
            Prof. <span className="text-white font-medium">{byProfesor[profesorIds[0]]?.[0]?.profesores?.nombre ?? '—'}</span>
          </p>
        )}

        {/* Grid */}
        {activeDias.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">Sin horarios configurados para este profesor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-14 pr-2 text-right text-gray-600 font-normal pb-2">Hora</th>
                  {activeDias.map(dia => (
                    <th key={dia} className="text-center font-medium text-gray-400 pb-2 px-1 min-w-[72px]">
                      {getDiaLabel(dia)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(time => {
                  const hasSomething = activeDias.some(dia => getSlotForCell(activeProfesorId, dia, time))
                  if (!hasSomething) return null

                  return (
                    <tr key={time} className="group">
                      <td className="pr-2 text-right text-gray-600 py-0.5 align-top pt-1">{time}</td>
                      {activeDias.map(dia => {
                        const slot = getSlotForCell(activeProfesorId, dia, time)

                        if (!slot) {
                          return <td key={dia} className="px-1 py-0.5" />
                        }

                        if (slot.estado === 'no_disponible') {
                          return (
                            <td key={dia} className="px-1 py-0.5">
                              <div className="h-8 rounded border border-gray-800/40 bg-gray-900/20" />
                            </td>
                          )
                        }

                        if (slot.estado === 'reservado') {
                          return (
                            <td key={dia} className="px-1 py-0.5">
                              <div className="h-8 rounded border border-gray-700 bg-gray-800/40 flex items-center justify-center cursor-not-allowed">
                                <span className="text-gray-600 text-[10px]">Ocupado</span>
                              </div>
                            </td>
                          )
                        }

                        // disponible
                        const isSelected = selectedSlot?.id === slot.id
                        return (
                          <td key={dia} className="px-1 py-0.5">
                            <button
                              onClick={() => {
                                setSelectedSlot(isSelected ? null : slot)
                                setNotas('')
                                setError(null)
                              }}
                              className={`w-full h-8 rounded border text-[10px] font-medium transition-colors ${
                                isSelected
                                  ? 'bg-emerald-700/80 border-emerald-500 text-emerald-100 ring-1 ring-emerald-400'
                                  : 'bg-emerald-900/40 border-emerald-700 text-emerald-300 hover:bg-emerald-700/60 cursor-pointer'
                              }`}
                              title={`${slot.dia_semana} ${formatTime(slot.hora_inicio)}–${formatTime(slot.hora_fin)}`}
                            >
                              {formatTime(slot.hora_inicio)}
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

        {/* Legend */}
        <div className="flex gap-4 flex-wrap text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-900/60 border border-emerald-700 inline-block" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-800/60 border border-gray-700 inline-block" />
            Ocupado
          </span>
        </div>
      </div>

      {/* ── Booking confirmation panel ── */}
      {selectedSlot && (
        <div className="card border border-emerald-800/60 bg-emerald-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">¿Confirmar reserva?</h3>
            <button
              onClick={() => { setSelectedSlot(null); setNotas('') }}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none"
              aria-label="Cerrar panel"
            >
              &times;
            </button>
          </div>

          {/* Slot details */}
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <span className="stat-value capitalize text-base">{selectedSlot.dia_semana}</span>
              <span className="stat-label">Día</span>
            </div>
            <div className="stat-card">
              <span className="stat-value text-base">{formatTime(selectedSlot.hora_inicio)}</span>
              <span className="stat-label">Inicio</span>
            </div>
            <div className="stat-card">
              <span className="stat-value text-base">{formatTime(selectedSlot.hora_fin)}</span>
              <span className="stat-label">Fin</span>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Profesor: <span className="text-gray-200 font-medium">{selectedSlot.profesores?.nombre ?? '—'}</span>
          </p>

          {/* Student info (read-only) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tus datos</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input opacity-60 cursor-not-allowed text-sm"
                  value={studentInfo.nombre}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="label">Correo</label>
                <input
                  type="email"
                  className="input opacity-60 cursor-not-allowed text-sm"
                  value={studentInfo.email}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="label">Carrera</label>
                <input
                  type="text"
                  className="input opacity-60 cursor-not-allowed text-sm"
                  value={studentInfo.carrera ?? '—'}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Optional notes */}
          <div>
            <label className="label" htmlFor="notas-tutor">
              Notas para el profesor <span className="text-gray-600 font-normal">(opcional)</span>
            </label>
            <textarea
              id="notas-tutor"
              className="input resize-none text-sm"
              rows={3}
              placeholder="Ej. Tengo dudas sobre el tema 3..."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Confirmando...' : 'Confirmar reserva'}
            </button>
            <button
              onClick={() => { setSelectedSlot(null); setNotas('') }}
              disabled={loading}
              className="btn-ghost flex-1 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
