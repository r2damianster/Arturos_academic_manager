'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  profesor_id: string
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

interface TutoriasManagerProps {
  horarios: Horario[]
  reservas: Reserva[]
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  'miércoles': 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  'sábado': 'Sáb',
}

// Generate 30-min time slots from 07:00 to 19:30
function generarSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 19 || true) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  // Remove anything after 19:30
  return slots.filter(s => s <= '19:30')
}

const TIME_SLOTS = generarSlots()

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function TutoriasManager({ horarios: initialHorarios, reservas: initialReservas }: TutoriasManagerProps) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>(initialHorarios)
  const [reservas, setReservas] = useState<Reserva[]>(initialReservas)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activePopover, setActivePopover] = useState<number | null>(null) // horario.id
  const [cancelingId, setCancelingId] = useState<number | null>(null)

  const profesorId = horarios[0]?.profesor_id ?? ''

  // Build lookup: dia+hora -> horario
  const horarioMap = new Map<string, Horario>()
  for (const h of horarios) {
    horarioMap.set(`${h.dia_semana}|${h.hora_inicio}`, h)
  }

  // Build lookup: horario_id -> reserva
  const reservaMap = new Map<number, Reserva>()
  for (const r of reservas) {
    reservaMap.set(r.horario_id, r)
  }

  // Stats
  const totalDisponibles = horarios.filter(h => h.estado === 'disponible').length
  const totalReservados = horarios.filter(h => h.estado === 'reservado').length
  const totalNoDisponibles = horarios.filter(h => h.estado === 'no_disponible').length

  async function toggleSlot(horario: Horario) {
    if (horario.estado === 'reservado') {
      setActivePopover(activePopover === horario.id ? null : horario.id)
      return
    }
    const nuevoEstado = horario.estado === 'disponible' ? 'no_disponible' : 'disponible'
    // Optimistic update
    setHorarios(prev => prev.map(h => h.id === horario.id ? { ...h, estado: nuevoEstado } : h))
    setError(null)
    startTransition(async () => {
      const { error: err } = await supabase
        .from('horarios')
        .update({ estado: nuevoEstado })
        .eq('id', horario.id)
      if (err) {
        setError('Error al actualizar el horario')
        // Revert
        setHorarios(prev => prev.map(h => h.id === horario.id ? { ...h, estado: horario.estado } : h))
      }
    })
  }

  async function cancelarReserva(reserva: Reserva) {
    setCancelingId(reserva.id)
    setError(null)
    const { error: err1 } = await supabase
      .from('reservas')
      .update({ estado: 'cancelado' })
      .eq('id', reserva.id)
    const { error: err2 } = await supabase
      .from('horarios')
      .update({ estado: 'no_disponible' })
      .eq('id', reserva.horario_id)
    setCancelingId(null)
    if (err1 || err2) {
      setError('Error al cancelar la reserva')
      return
    }
    setReservas(prev => prev.filter(r => r.id !== reserva.id))
    setHorarios(prev =>
      prev.map(h => h.id === reserva.horario_id ? { ...h, estado: 'no_disponible' } : h)
    )
    setActivePopover(null)
  }

  async function ponerTodoNoDisponible() {
    setError(null)
    // Optimistic update for non-reserved slots
    setHorarios(prev =>
      prev.map(h => h.estado !== 'reservado' ? { ...h, estado: 'no_disponible' } : h)
    )
    startTransition(async () => {
      const { error: err } = await supabase
        .from('horarios')
        .update({ estado: 'no_disponible' })
        .eq('profesor_id', profesorId)
        .neq('estado', 'reservado')
      if (err) setError('Error al actualizar horarios')
    })
  }

  async function ponerDisponibleLV() {
    setError(null)
    const lv = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
    // Optimistic update
    setHorarios(prev =>
      prev.map(h =>
        lv.includes(h.dia_semana) &&
        h.hora_inicio >= '07:00' &&
        h.hora_inicio < '19:00' &&
        h.estado !== 'reservado'
          ? { ...h, estado: 'disponible' }
          : h
      )
    )
    startTransition(async () => {
      const { error: err } = await supabase
        .from('horarios')
        .update({ estado: 'disponible' })
        .eq('profesor_id', profesorId)
        .in('dia_semana', lv)
        .gte('hora_inicio', '07:00')
        .lt('hora_inicio', '19:00')
        .neq('estado', 'reservado')
      if (err) setError('Error al actualizar horarios')
    })
  }

  function getHorarioLabel(horarioId: number): string {
    const h = horarios.find(x => x.id === horarioId)
    if (!h) return '—'
    return `${DIAS_LABEL[h.dia_semana] ?? h.dia_semana} ${h.hora_inicio}–${h.hora_fin}`
  }

  return (
    <div className="space-y-6">
      {/* Batch action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={ponerTodoNoDisponible}
          disabled={isPending}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          Poner todo NO disponible
        </button>
        <button
          onClick={ponerDisponibleLV}
          disabled={isPending}
          className="btn-primary text-sm disabled:opacity-40"
        >
          Poner todo DISPONIBLE (L–V 07–19h)
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="stat-value">{horarios.length}</span>
          <span className="stat-label">Total slots</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-green-400">{totalDisponibles}</span>
          <span className="stat-label">Disponibles</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-blue-400">{totalReservados}</span>
          <span className="stat-label">Reservados</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-gray-400">{totalNoDisponibles}</span>
          <span className="stat-label">No disponibles</span>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="card overflow-x-auto p-0">
        <div className="min-w-[600px]">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/60">
            <div className="px-2 py-2 text-xs text-gray-500 font-medium text-center border-r border-gray-800">
              Hora
            </div>
            {DIAS.map(dia => (
              <div
                key={dia}
                className="px-1 py-2 text-xs text-gray-400 font-medium text-center border-r border-gray-800 last:border-r-0"
              >
                {DIAS_LABEL[dia]}
              </div>
            ))}
          </div>

          {/* Time slot rows */}
          {TIME_SLOTS.map((slot, i) => (
            <div
              key={slot}
              className={`grid grid-cols-7 border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-900/20'}`}
            >
              {/* Time label */}
              <div className="px-2 py-1 text-xs text-gray-500 text-center border-r border-gray-800 flex items-center justify-center">
                {slot}
              </div>

              {/* Day cells */}
              {DIAS.map(dia => {
                const horario = horarioMap.get(`${dia}|${slot}`)
                if (!horario) {
                  return (
                    <div
                      key={dia}
                      className="px-1 py-1 border-r border-gray-800/50 last:border-r-0 min-h-[28px]"
                    />
                  )
                }

                const reserva = reservaMap.get(horario.id)
                const isPopoverOpen = activePopover === horario.id

                return (
                  <div
                    key={dia}
                    className="px-1 py-1 border-r border-gray-800/50 last:border-r-0 relative"
                  >
                    {horario.estado === 'reservado' && reserva ? (
                      <>
                        <button
                          onClick={() => setActivePopover(isPopoverOpen ? null : horario.id)}
                          className="w-full flex items-center justify-center rounded text-xs font-bold h-6 bg-blue-900/60 text-blue-300 border border-blue-700 hover:bg-blue-900 transition-colors"
                          title={reserva.estudiante_nombre}
                        >
                          {getInitials(reserva.estudiante_nombre)}
                        </button>

                        {/* Popover */}
                        {isPopoverOpen && (
                          <div
                            className="absolute z-50 top-8 left-0 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 space-y-2"
                            style={{ minWidth: '220px' }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-white">Reserva</p>
                              <button
                                onClick={() => setActivePopover(null)}
                                className="text-gray-500 hover:text-gray-300 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="space-y-1 text-xs">
                              <p className="text-gray-200 font-medium">{reserva.estudiante_nombre}</p>
                              <p className="text-gray-400">{reserva.estudiante_carrera}</p>
                              <p className="text-gray-400">{reserva.email}</p>
                              {reserva.telefono && (
                                <p className="text-gray-400">{reserva.telefono}</p>
                              )}
                              {reserva.notas && (
                                <p className="text-gray-500 italic border-t border-gray-800 pt-1 mt-1">
                                  {reserva.notas}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => cancelarReserva(reserva)}
                              disabled={cancelingId === reserva.id}
                              className="w-full mt-1 px-2 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 border border-red-800 rounded transition-colors disabled:opacity-40"
                            >
                              {cancelingId === reserva.id ? 'Cancelando...' : 'Cancelar reserva'}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Toggle switch for disponible / no_disponible */
                      <button
                        onClick={() => toggleSlot(horario)}
                        disabled={isPending}
                        className={`w-full h-6 rounded text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                          horario.estado === 'disponible'
                            ? 'bg-green-900/50 border border-green-700 text-green-400 hover:bg-green-900/80'
                            : 'bg-gray-800/60 border border-gray-700 text-gray-600 hover:bg-gray-700/50'
                        }`}
                        title={horario.estado === 'disponible' ? 'Disponible — clic para desactivar' : 'No disponible — clic para activar'}
                      >
                        {horario.estado === 'disponible' ? '●' : '○'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-900/50 border border-green-700 inline-block" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-900/60 border border-blue-700 inline-block" />
            Reservado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-800/60 border border-gray-700 inline-block" />
            No disponible
          </span>
        </div>
      </div>

      {/* Reservas list */}
      {reservas.length > 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Reservas activas ({reservas.length})</h2>
          <div className="divide-y divide-gray-800">
            {reservas.map(reserva => (
              <div key={reserva.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-900/50 border border-blue-700 flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
                    {getInitials(reserva.estudiante_nombre)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200">{reserva.estudiante_nombre}</p>
                    <p className="text-xs text-gray-500">{reserva.estudiante_carrera}</p>
                    <p className="text-xs text-gray-500">{reserva.email}</p>
                    <p className="text-xs text-blue-400 mt-1 font-medium">
                      {getHorarioLabel(reserva.horario_id)}
                    </p>
                    {reserva.notas && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        &ldquo;{reserva.notas}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => cancelarReserva(reserva)}
                  disabled={cancelingId === reserva.id}
                  className="btn-ghost text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 px-3 py-1.5 flex-shrink-0 disabled:opacity-40"
                >
                  {cancelingId === reserva.id ? 'Cancelando...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {reservas.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm">No hay reservas activas en este momento</p>
        </div>
      )}
    </div>
  )
}
