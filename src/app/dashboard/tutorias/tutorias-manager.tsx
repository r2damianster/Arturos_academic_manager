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
const DIAS_SHORT: Record<string, string> = {
  lunes: 'L', martes: 'M', 'miércoles': 'X', jueves: 'J', viernes: 'V', 'sábado': 'S',
}
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue', viernes: 'Vie', 'sábado': 'Sáb',
}

function getSlots(): string[] {
  const s: string[] = []
  for (let h = 7; h <= 19; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`)
    s.push(`${String(h).padStart(2, '0')}:30`)
  }
  return s.filter(x => x <= '19:30')
}
const TIME_SLOTS = getSlots()

function fmt(t: string) { return t.slice(0, 5) }
function initials(n: string) {
  return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function TutoriasManager({ horarios: init, reservas: initRes }: TutoriasManagerProps) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<Horario[]>(init)
  const [reservas, setReservas] = useState<Reserva[]>(initRes)
  const [isPending, startTransition] = useTransition()
  const [popover, setPopover] = useState<number | null>(null)
  const [canceling, setCanceling] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const profesorId = horarios[0]?.profesor_id ?? ''

  const horarioMap = new Map<string, Horario>()
  for (const h of horarios) horarioMap.set(`${h.dia_semana}|${fmt(h.hora_inicio)}`, h)

  const reservaMap = new Map<number, Reserva>()
  for (const r of reservas) reservaMap.set(r.horario_id, r)

  const nDisp = horarios.filter(h => h.estado === 'disponible').length
  const nRes  = horarios.filter(h => h.estado === 'reservado').length

  async function toggleSlot(h: Horario) {
    if (h.estado === 'reservado') { setPopover(popover === h.id ? null : h.id); return }
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

  async function cancelarReserva(r: Reserva) {
    setCanceling(r.id)
    await supabase.from('reservas').update({ estado: 'cancelado' }).eq('id', r.id)
    await supabase.from('horarios').update({ estado: 'no_disponible' }).eq('id', r.horario_id)
    setCanceling(null)
    setReservas(prev => prev.filter(x => x.id !== r.id))
    setHorarios(prev => prev.map(h => h.id === r.horario_id ? { ...h, estado: 'no_disponible' } : h))
    setPopover(null)
  }

  async function batchNoDisponible() {
    setHorarios(prev => prev.map(h => h.estado !== 'reservado' ? { ...h, estado: 'no_disponible' } : h))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado: 'no_disponible' })
        .eq('profesor_id', profesorId).neq('estado', 'reservado')
    })
  }

  async function batchDisponibleLV() {
    const lv = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
    setHorarios(prev => prev.map(h =>
      lv.includes(h.dia_semana) && h.hora_inicio >= '07:00' && h.hora_inicio < '19:00' && h.estado !== 'reservado'
        ? { ...h, estado: 'disponible' } : h
    ))
    startTransition(async () => {
      await supabase.from('horarios').update({ estado: 'disponible' })
        .eq('profesor_id', profesorId).in('dia_semana', lv)
        .gte('hora_inicio', '07:00').lt('hora_inicio', '19:00').neq('estado', 'reservado')
    })
  }

  function slotLabel(hid: number) {
    const h = horarios.find(x => x.id === hid)
    return h ? `${DIAS_LABEL[h.dia_semana] ?? h.dia_semana} ${fmt(h.hora_inicio)}` : '—'
  }

  return (
    <div className="space-y-4">

      {/* Top bar: stats + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400 font-semibold">{nDisp} disponibles</span>
          <span className="text-blue-400 font-semibold">{nRes} reservados</span>
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
      <div className="flex gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-800 border border-emerald-600 inline-block"/>Disponible (clic=desactivar)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-900 border border-blue-600 inline-block"/>Reservado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-800/60 border border-gray-700 inline-block"/>No disponible (clic=activar)</span>
      </div>

      {/* Grid — scrollable horizontally */}
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
                <td className="text-right text-gray-600 px-1 py-px text-[9px] select-none whitespace-nowrap">
                  {slot}
                </td>
                {DIAS.map(dia => {
                  const h = horarioMap.get(`${dia}|${slot}`)
                  if (!h) return <td key={dia} className="px-0.5 py-px" />

                  const r = reservaMap.get(h.id)
                  const isOpen = popover === h.id

                  return (
                    <td key={dia} className="px-0.5 py-px relative">
                      <button
                        onClick={() => toggleSlot(h)}
                        title={h.estado === 'reservado' ? `Reservado: ${r?.estudiante_nombre ?? ''}` : h.estado}
                        className={`w-full h-5 rounded-sm text-[9px] font-medium transition-colors ${
                          h.estado === 'disponible'
                            ? 'bg-emerald-900/60 border border-emerald-700 text-emerald-400 hover:bg-emerald-700/60'
                            : h.estado === 'reservado'
                            ? 'bg-blue-900/60 border border-blue-700 text-blue-300 hover:bg-blue-800/60'
                            : 'bg-gray-800/30 border border-gray-800 text-gray-700 hover:bg-gray-700/30'
                        }`}
                      >
                        {h.estado === 'reservado' ? (r ? initials(r.estudiante_nombre) : '●') : ''}
                      </button>

                      {/* Popover for reservado */}
                      {isOpen && r && (
                        <div className="absolute z-50 left-0 top-6 w-52 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 space-y-1.5 text-xs"
                          style={{ minWidth: 200 }}>
                          <div className="flex justify-between items-center mb-0.5">
                            <p className="font-semibold text-white text-[11px]">Reserva</p>
                            <button onClick={() => setPopover(null)} className="text-gray-500 hover:text-gray-300">✕</button>
                          </div>
                          <p className="text-gray-200 font-medium">{r.estudiante_nombre}</p>
                          <p className="text-gray-400">{r.estudiante_carrera}</p>
                          <p className="text-gray-400">{r.email}</p>
                          {r.telefono && <p className="text-gray-400">{r.telefono}</p>}
                          {r.notas && <p className="text-gray-500 italic border-t border-gray-800 pt-1 mt-1">"{r.notas}"</p>}
                          <button
                            onClick={() => cancelarReserva(r)}
                            disabled={canceling === r.id}
                            className="w-full mt-1 py-1 text-[10px] bg-red-950 border border-red-800 text-red-400 rounded hover:bg-red-900/60 transition-colors disabled:opacity-40">
                            {canceling === r.id ? 'Cancelando...' : 'Cancelar reserva'}
                          </button>
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

      {/* Reservas list */}
      {reservas.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-white">Reservas activas ({reservas.length})</h3>
          <div className="divide-y divide-gray-800">
            {reservas.map(r => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 font-medium">{r.estudiante_nombre}</p>
                  <p className="text-xs text-gray-500">{r.estudiante_carrera} · {r.email}</p>
                  <p className="text-xs text-blue-400">{slotLabel(r.horario_id)}</p>
                  {r.notas && <p className="text-xs text-gray-600 italic">"{r.notas}"</p>}
                </div>
                <button
                  onClick={() => cancelarReserva(r)}
                  disabled={canceling === r.id}
                  className="flex-shrink-0 text-xs text-red-400 border border-red-800 px-2 py-1 rounded hover:bg-red-950 transition-colors disabled:opacity-40">
                  {canceling === r.id ? '...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {reservas.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-4">Sin reservas activas</p>
      )}
    </div>
  )
}
