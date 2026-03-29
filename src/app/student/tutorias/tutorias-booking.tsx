'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Horario {
  id: number
  profesor_id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: 'disponible' | 'reservado' | 'no_disponible'
  profesores: { nombre: string } | null
}

interface Reserva {
  id: number
  horario_id: number
  estado: string
  notas: string | null
  horarios: { dia_semana: string; hora_inicio: string; hora_fin: string } | null
}

interface StudentInfo {
  nombre: string
  email: string
  carrera: string | null
  telefono: string | null
  auth_user_id: string
}

interface Props {
  horarios: Horario[]
  misReservas: Reserva[]
  studentInfo: StudentInfo
}

const DIAS_ORDER = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue', viernes: 'Vie', 'sábado': 'Sáb',
}

function slots(): string[] {
  const s: string[] = []
  for (let h = 7; h <= 19; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`)
    s.push(`${String(h).padStart(2, '0')}:30`)
  }
  return s.filter(x => x <= '19:30')
}
const TIME_SLOTS = slots()

function fmt(t: string) { return t?.slice(0, 5) ?? '' }

export function TutoriasBooking({ horarios: initH, misReservas: initR, studentInfo }: Props) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>(initH)
  const [reservas, setReservas] = useState<Reserva[]>(initR)
  const [selected, setSelected] = useState<Horario | null>(null)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [canceling, setCanceling] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Group by profesor
  const profesorIds = [...new Set(horarios.map(h => h.profesor_id))]
  const byProf: Record<string, Horario[]> = {}
  for (const h of horarios) {
    if (!byProf[h.profesor_id]) byProf[h.profesor_id] = []
    byProf[h.profesor_id].push(h)
  }
  const [activePid, setActivePid] = useState(profesorIds[0] ?? '')

  // Lookup for current professor's slots
  const profHorarios = byProf[activePid] ?? []
  const slotMap = new Map<string, Horario>()
  for (const h of profHorarios) slotMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)

  // My booked horario_ids set
  const myHorarioIds = new Set(reservas.map(r => r.horario_id))

  // Active days for this professor
  const activeDias = DIAS_ORDER.filter(d =>
    profHorarios.some(h => h.dia_semana.toLowerCase() === d.toLowerCase())
  )

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('reservar_tutoria', {
        p_horario_id:   selected.id,
        p_nombre:       studentInfo.nombre,
        p_carrera:      studentInfo.carrera ?? '',
        p_email:        studentInfo.email,
        p_telefono:     studentInfo.telefono ?? '',
        p_auth_user_id: studentInfo.auth_user_id,
        p_notas:        notas || null,
      })

      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { ok: boolean; error?: string; reserva_id?: number }
      if (!result.ok) throw new Error(result.error ?? 'Error al reservar')

      // Update local state
      const newReserva: Reserva = {
        id: result.reserva_id ?? Math.random(),
        horario_id: selected.id,
        estado: 'pendiente',
        notas: notas || null,
        horarios: {
          dia_semana: selected.dia_semana,
          hora_inicio: selected.hora_inicio,
          hora_fin: selected.hora_fin,
        },
      }
      setReservas(prev => [...prev, newReserva])
      setHorarios(prev => prev.map(h => h.id === selected.id ? { ...h, estado: 'reservado' } : h))
      setSuccess(`Tutoría agendada: ${selected.dia_semana} ${fmt(selected.hora_inicio)}`)
      setSelected(null)
      setNotas('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelar(r: Reserva) {
    setCanceling(r.id)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('cancelar_mi_reserva', { p_reserva_id: r.id })
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Error al cancelar')

      setReservas(prev => prev.filter(x => x.id !== r.id))
      setHorarios(prev => prev.map(h => h.id === r.horario_id ? { ...h, estado: 'disponible' } : h))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCanceling(null)
    }
  }

  if (horarios.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 text-sm">No hay horarios de tutoría disponibles para tus cursos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Feedback */}
      {success && (
        <div className="px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm flex justify-between">
          <span>✓ {success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-600">✕</button>
        </div>
      )}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600">✕</button>
        </div>
      )}

      {/* Mis reservas activas */}
      {reservas.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-white">Mis tutorías agendadas</h2>
          {reservas.map(r => {
            const dia = r.horarios?.dia_semana ?? '—'
            const ini = r.horarios?.hora_inicio ? fmt(r.horarios.hora_inicio) : '—'
            const fin = r.horarios?.hora_fin ? fmt(r.horarios.hora_fin) : '—'
            const profNombre = horarios.find(h => h.id === r.horario_id)?.profesores?.nombre ?? '—'
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-800">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-200 capitalize">{dia} {ini}–{fin}</p>
                  <p className="text-xs text-blue-400">Prof. {profNombre}</p>
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

      {/* Grid de horarios */}
      <div className="card space-y-3">
        {/* Professor tabs */}
        {profesorIds.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {profesorIds.map(pid => (
              <button key={pid} onClick={() => { setActivePid(pid); setSelected(null) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activePid === pid ? 'bg-brand-700/40 border-brand-500 text-brand-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
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

        {/* Leyenda */}
        <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-900/60 border border-emerald-600 inline-block"/>Disponible</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-900/60 border border-red-700 inline-block"/>Ocupado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-900/60 border border-blue-700 inline-block"/>Tu reserva</span>
        </div>

        {/* Grid */}
        {activeDias.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">El profesor no ha configurado horarios aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]" style={{ minWidth: 300 }}>
              <thead>
                <tr>
                  <th className="w-12 pr-2 text-right text-gray-600 font-normal pb-1.5 text-[10px]">Hora</th>
                  {activeDias.map(d => (
                    <th key={d} className="text-center font-medium text-gray-400 pb-1.5 px-1 min-w-[60px]">
                      {DIAS_LABEL[d] ?? d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(time => {
                  const hasSomething = activeDias.some(d => slotMap.has(`${d}|${time}`))
                  if (!hasSomething) return null
                  return (
                    <tr key={time}>
                      <td className="pr-2 text-right text-gray-600 py-0.5 text-[10px] whitespace-nowrap">{time}</td>
                      {activeDias.map(dia => {
                        const slot = slotMap.get(`${dia}|${time}`)
                        if (!slot) return <td key={dia} className="px-1 py-0.5" />

                        const isMine = myHorarioIds.has(slot.id)
                        const isSelected = selected?.id === slot.id

                        if (slot.estado === 'no_disponible') {
                          return <td key={dia} className="px-1 py-0.5">
                            <div className="h-7 rounded border border-gray-800/30 bg-gray-900/10" />
                          </td>
                        }

                        if (slot.estado === 'reservado' && !isMine) {
                          return <td key={dia} className="px-1 py-0.5">
                            <div className="h-7 rounded border border-red-900 bg-red-950/40 flex items-center justify-center">
                              <span className="text-red-700 text-[9px]">Ocupado</span>
                            </div>
                          </td>
                        }

                        if (isMine) {
                          return <td key={dia} className="px-1 py-0.5">
                            <div className="h-7 rounded border border-blue-700 bg-blue-900/40 flex items-center justify-center">
                              <span className="text-blue-300 text-[9px] font-medium">✓ Mío</span>
                            </div>
                          </td>
                        }

                        // disponible
                        return (
                          <td key={dia} className="px-1 py-0.5">
                            <button
                              onClick={() => { setSelected(isSelected ? null : slot); setNotas(''); setError(null) }}
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

      {/* Confirmation panel */}
      {selected && (
        <div className="card border border-emerald-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">Confirmar tutoría</h3>
            <button onClick={() => { setSelected(null); setNotas('') }} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
          </div>

          <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-sm">
            <p className="text-white font-medium capitalize">{selected.dia_semana} — {fmt(selected.hora_inicio)} a {fmt(selected.hora_fin)}</p>
            <p className="text-gray-400 text-xs mt-0.5">Prof. {selected.profesores?.nombre ?? '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <div><span className="text-gray-600">Nombre: </span><span className="text-gray-200">{studentInfo.nombre}</span></div>
            <div><span className="text-gray-600">Correo: </span><span className="text-gray-200 truncate">{studentInfo.email}</span></div>
          </div>

          <div>
            <label className="label text-xs" htmlFor="notas-input">Motivo / Notas <span className="text-gray-600">(opcional)</span></label>
            <textarea id="notas-input" className="input resize-none text-sm" rows={2}
              placeholder="Ej. Tengo dudas sobre el ensayo del tema 3..."
              value={notas} onChange={e => setNotas(e.target.value)} maxLength={300} />
          </div>

          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={loading}
              className="btn-primary flex-1 text-sm disabled:opacity-60">
              {loading ? 'Confirmando...' : 'Confirmar reserva'}
            </button>
            <button onClick={() => { setSelected(null); setNotas('') }} disabled={loading}
              className="btn-ghost flex-1 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
