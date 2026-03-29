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
  estado: string          // pendiente | completada | cancelado
  cancelado_por?: string | null   // estudiante | profesor | null
  cancelado_at?: string | null
  asistio?: boolean | null
  notas?: string | null
}

interface TutoriasManagerProps {
  horarios: Horario[]
  reservas: Reserva[]
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const DIAS_SHORT: Record<string, string> = { lunes:'L', martes:'M', 'miércoles':'X', jueves:'J', viernes:'V', 'sábado':'S' }
const DIAS_LABEL: Record<string, string> = { lunes:'Lun', martes:'Mar', 'miércoles':'Mié', jueves:'Jue', viernes:'Vie', 'sábado':'Sáb' }

function getSlots(): string[] {
  const s: string[] = []
  for (let h = 7; h <= 19; h++) {
    s.push(`${String(h).padStart(2,'0')}:00`)
    s.push(`${String(h).padStart(2,'0')}:30`)
  }
  return s.filter(x => x <= '19:30')
}
const TIME_SLOTS = getSlots()
function fmt(t: string) { return t?.slice(0,5) ?? '' }
function initials(n: string) { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() }

export function TutoriasManager({ horarios: init, reservas: initRes }: TutoriasManagerProps) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>(init)
  const [reservas, setReservas] = useState<Reserva[]>(initRes)
  const [isPending, startTransition] = useTransition()
  const [popover, setPopover]   = useState<number | null>(null)
  const [acting,  setActing]    = useState<number | null>(null)
  const [err, setErr]           = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const profesorId = horarios[0]?.profesor_id ?? ''

  const horarioMap = new Map<string, Horario>()
  for (const h of horarios) horarioMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)

  const reservaByHorario = new Map<number, Reserva>()
  for (const r of reservas) {
    if (r.estado === 'pendiente') reservaByHorario.set(r.horario_id, r)
  }

  const pendientes  = reservas.filter(r => r.estado === 'pendiente')
  const historial   = reservas.filter(r => r.estado !== 'pendiente')
  const nDisp = horarios.filter(h => h.estado === 'disponible').length
  const nRes  = horarios.filter(h => h.estado === 'reservado').length

  // ── Toggle individual slot ─────────────────────────────────────────────────
  async function toggleSlot(h: Horario) {
    if (h.estado === 'reservado') { setPopover(popover === h.id ? null : h.id); return }
    const next = h.estado === 'disponible' ? 'no_disponible' : 'disponible'
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, estado: next } : x))
    setErr(null)
    startTransition(async () => {
      const { error } = await supabase.from('horarios').update({ estado: next }).eq('id', h.id)
      if (error) { setErr('Error al guardar'); setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, estado: h.estado } : x)) }
    })
  }

  // ── Professor actions via RPC ──────────────────────────────────────────────
  async function accionReserva(r: Reserva, accion: 'asistio' | 'no_asistio' | 'cancelar') {
    setActing(r.id)
    setErr(null)
    const { data, error: rpcErr } = await supabase.rpc('gestionar_reserva_profesor', {
      p_reserva_id: r.id,
      p_accion: accion,
    })
    if (rpcErr || !(data as { ok: boolean }).ok) {
      setErr('Error al procesar la acción')
      setActing(null)
      return
    }
    // Update local state
    const now = new Date().toISOString()
    if (accion === 'asistio') {
      setReservas(prev => prev.map(x => x.id === r.id ? { ...x, estado:'completada', asistio:true, completada_at:now } : x))
    } else if (accion === 'no_asistio') {
      setReservas(prev => prev.map(x => x.id === r.id ? { ...x, estado:'completada', asistio:false, completada_at:now } : x))
    } else {
      setReservas(prev => prev.map(x => x.id === r.id ? { ...x, estado:'cancelado', cancelado_por:'profesor', cancelado_at:now } : x))
    }
    setHorarios(prev => prev.map(h => h.id === r.horario_id ? { ...h, estado:'disponible' } : h))
    setPopover(null)
    setActing(null)
  }

  // ── Batch actions ──────────────────────────────────────────────────────────
  async function batchNoDisponible() {
    setHorarios(prev => prev.map(h => h.estado !== 'reservado' ? { ...h, estado:'no_disponible' } : h))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado:'no_disponible' }).eq('profesor_id', profesorId).neq('estado','reservado')
    })
  }
  async function batchDisponibleLV() {
    const lv = ['lunes','martes','miércoles','jueves','viernes']
    setHorarios(prev => prev.map(h =>
      lv.includes(h.dia_semana) && h.hora_inicio >= '07:00' && h.hora_inicio < '19:00' && h.estado !== 'reservado'
        ? { ...h, estado:'disponible' } : h
    ))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado:'disponible' })
        .eq('profesor_id', profesorId).in('dia_semana', lv)
        .gte('hora_inicio','07:00').lt('hora_inicio','19:00').neq('estado','reservado')
    })
  }

  function slotLabel(hid: number) {
    const h = horarios.find(x => x.id === hid)
    return h ? `${DIAS_LABEL[h.dia_semana] ?? h.dia_semana} ${fmt(h.hora_inicio)}` : '—'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400 font-semibold">{nDisp} disponibles</span>
          <span className="text-blue-400 font-semibold">{nRes} reservados</span>
          {pendientes.length > 0 && <span className="text-yellow-400 font-semibold">{pendientes.length} pendiente{pendientes.length>1?'s':''}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={batchNoDisponible} disabled={isPending}
            className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-40">
            Todo NO disponible
          </button>
          <button onClick={batchDisponibleLV} disabled={isPending}
            className="px-2 py-1 text-xs rounded border border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40">
            L–V disponible
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-red-400 bg-red-950 border border-red-800 px-3 py-1.5 rounded">{err}</p>}

      {/* Leyenda */}
      <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-800 border border-emerald-600 inline-block"/>Disponible</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-900 border border-blue-600 inline-block"/>Reservado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-800/60 border border-gray-700 inline-block"/>No disponible</span>
        <span className="text-gray-600">· Clic para activar/desactivar</span>
      </div>

      {/* Grid */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full border-collapse text-[10px]" style={{ minWidth: 360 }}>
          <thead>
            <tr className="bg-gray-900/70 border-b border-gray-800">
              <th className="w-10 text-gray-600 font-normal px-1 py-1 text-right text-[9px]">Hora</th>
              {DIAS.map(d => (
                <th key={d} className="text-center text-gray-400 font-medium px-0.5 py-1">
                  <span className="hidden sm:inline">{DIAS_LABEL[d]}</span>
                  <span className="sm:hidden">{DIAS_SHORT[d]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, i) => (
              <tr key={slot} className={i % 2 === 0 ? '' : 'bg-gray-900/20'}>
                <td className="text-right text-gray-600 px-1 py-px text-[9px] select-none whitespace-nowrap">{slot}</td>
                {DIAS.map(dia => {
                  const h = horarioMap.get(`${dia}|${slot}`)
                  if (!h) return <td key={dia} className="px-0.5 py-px" />
                  const r = reservaByHorario.get(h.id)
                  const isOpen = popover === h.id
                  return (
                    <td key={dia} className="px-0.5 py-px relative">
                      <button
                        onClick={() => toggleSlot(h)}
                        title={h.estado === 'reservado' ? `Reservado: ${r?.estudiante_nombre ?? ''}` : h.estado}
                        className={`w-full h-5 rounded-sm text-[9px] font-medium transition-colors ${
                          h.estado === 'disponible'  ? 'bg-emerald-900/60 border border-emerald-700 text-emerald-400 hover:bg-emerald-700/60'
                          : h.estado === 'reservado' ? 'bg-blue-900/60 border border-blue-700 text-blue-300 hover:bg-blue-800/60'
                          : 'bg-gray-800/30 border border-gray-800 text-gray-700 hover:bg-gray-700/30'
                        }`}
                      >
                        {h.estado === 'reservado' ? (r ? initials(r.estudiante_nombre) : '●') : ''}
                      </button>

                      {/* Popover */}
                      {isOpen && r && (
                        <div className="absolute z-50 left-0 top-6 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 space-y-1.5 text-xs"
                          style={{ minWidth: 210 }}>
                          <div className="flex justify-between items-center">
                            <p className="font-semibold text-white text-[11px]">Reserva</p>
                            <button onClick={() => setPopover(null)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                          </div>
                          <p className="text-gray-200 font-medium">{r.estudiante_nombre}</p>
                          <p className="text-gray-400">{r.estudiante_carrera}</p>
                          <p className="text-gray-400">{r.email}</p>
                          {r.telefono && <p className="text-gray-400">{r.telefono}</p>}
                          {r.notas && <p className="text-blue-300 italic border-t border-gray-800 pt-1 mt-1">"{r.notas}"</p>}
                          <div className="border-t border-gray-800 pt-2 mt-1 space-y-1">
                            <p className="text-gray-600 text-[10px] mb-1">Marcar resultado:</p>
                            <div className="flex gap-1">
                              <button onClick={() => accionReserva(r,'asistio')} disabled={acting===r.id}
                                className="flex-1 py-1 text-[10px] bg-emerald-900/50 border border-emerald-700 text-emerald-300 rounded hover:bg-emerald-800/60 disabled:opacity-40">
                                ✓ Asistió
                              </button>
                              <button onClick={() => accionReserva(r,'no_asistio')} disabled={acting===r.id}
                                className="flex-1 py-1 text-[10px] bg-yellow-900/40 border border-yellow-800 text-yellow-400 rounded hover:bg-yellow-900/60 disabled:opacity-40">
                                ✗ No asistió
                              </button>
                            </div>
                            <button onClick={() => accionReserva(r,'cancelar')} disabled={acting===r.id}
                              className="w-full py-1 text-[10px] bg-red-950 border border-red-800 text-red-400 rounded hover:bg-red-900/60 disabled:opacity-40">
                              {acting===r.id ? 'Procesando...' : 'Cancelar reserva'}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reservas pendientes */}
      {pendientes.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-white">Reservas pendientes ({pendientes.length})</h3>
          <div className="divide-y divide-gray-800">
            {pendientes.map(r => (
              <div key={r.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 font-medium">{r.estudiante_nombre}</p>
                  <p className="text-xs text-gray-500">{r.estudiante_carrera} · {r.email}</p>
                  <p className="text-xs text-blue-400 font-medium">{slotLabel(r.horario_id)}</p>
                  {r.notas && <p className="text-xs text-blue-300 italic mt-0.5">"{r.notas}"</p>}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => accionReserva(r,'asistio')} disabled={acting===r.id}
                    className="text-xs px-2 py-1 bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded hover:bg-emerald-800/50 disabled:opacity-40">
                    ✓ Asistió
                  </button>
                  <button onClick={() => accionReserva(r,'no_asistio')} disabled={acting===r.id}
                    className="text-xs px-2 py-1 bg-yellow-900/30 border border-yellow-800 text-yellow-400 rounded hover:bg-yellow-900/50 disabled:opacity-40">
                    ✗ No asistió
                  </button>
                  <button onClick={() => accionReserva(r,'cancelar')} disabled={acting===r.id}
                    className="text-xs px-2 py-1 bg-red-950 border border-red-800 text-red-400 rounded hover:bg-red-900/50 disabled:opacity-40">
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-3">Sin reservas pendientes</p>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="card space-y-2">
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center justify-between w-full text-left">
            <h3 className="text-sm font-semibold text-gray-400">
              Historial de tutorías ({historial.length})
            </h3>
            <span className="text-xs text-gray-600">{showHistory ? '▲ Ocultar' : '▼ Ver'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-gray-800/60">
              {historial.map(r => {
                const isCancelado  = r.estado === 'cancelado'
                const isCompletada = r.estado === 'completada'
                return (
                  <div key={r.id} className="py-2 flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                      isCompletada && r.asistio   ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      : isCompletada && !r.asistio ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
                      : isCancelado && r.cancelado_por === 'estudiante' ? 'bg-gray-800 text-gray-500 border border-gray-700'
                      : 'bg-red-950 text-red-500 border border-red-800'
                    }`}>
                      {isCompletada && r.asistio   ? '✓'
                       : isCompletada && !r.asistio ? '✗'
                       : '–'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-300 font-medium">{r.estudiante_nombre}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          isCompletada && r.asistio   ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                          : isCompletada && !r.asistio ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900'
                          : r.cancelado_por === 'estudiante' ? 'bg-gray-800 text-gray-500 border-gray-700'
                          : 'bg-red-950 text-red-500 border-red-900'
                        }`}>
                          {isCompletada && r.asistio    ? 'Asistió'
                           : isCompletada && !r.asistio ? 'No asistió'
                           : r.cancelado_por === 'estudiante' ? 'Canceló estudiante'
                           : 'Cancelado por profesor'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{r.estudiante_carrera} · {slotLabel(r.horario_id)}</p>
                      {r.notas && <p className="text-xs text-gray-600 italic">"{r.notas}"</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
