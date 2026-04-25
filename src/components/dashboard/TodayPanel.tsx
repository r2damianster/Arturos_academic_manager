'use client'

import { useState, useEffect, useMemo } from 'react'

// ── Raw data types ────────────────────────────────────────────────────────────

interface RawClase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo: boolean
  cursos: { asignatura: string } | null
  anuncios_tutoria_curso: { estudiante_id: string; fecha: string }[]
}

interface RawEvento {
  id: string
  titulo: string
  descripcion: string | null
  tipo: string
  todo_el_dia: boolean
  hora_inicio: string | null
  hora_fin: string | null
  recurrente: boolean
  recurrencia: string | null
  recurrencia_dias: number[] | null
  recurrencia_hasta: string | null
  fecha_inicio: string
  fecha_fin: string
}

interface RawHorario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  disponible_hasta: string | null
}

interface RawReserva {
  id: number
  horario_id: number
  fecha: string
  estudiante_nombre: string
  estado: string
}

interface Props {
  clases: RawClase[]
  eventos: RawEvento[]
  horarios: RawHorario[]
  reservas: RawReserva[]
  todayStr: string  // YYYY-MM-DD
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOW_MAP   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_LONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function normalizeDia(d: string) { return d.normalize('NFD').replace(/[̀-ͯ]/g, '') }
function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }

function eventOccursOnDay(ev: RawEvento, dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow  = date.getDay()
  const [sy, sm, sd] = ev.fecha_inicio.split('-').map(Number)
  const [ey, em, ed] = ev.fecha_fin.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)
  if (!ev.recurrente) return date >= start && date <= end
  const hastaStr = ev.recurrencia_hasta ?? ev.fecha_fin
  const [hy, hm, hd] = hastaStr.split('-').map(Number)
  const hasta = new Date(hy, hm - 1, hd)
  if (date < start || date > hasta) return false
  if (ev.recurrencia === 'diaria')  return true
  if (ev.recurrencia === 'semanal') return (ev.recurrencia_dias ?? []).includes(dow)
  if (ev.recurrencia === 'mensual') return date.getDate() === start.getDate()
  return false
}

const EVENTO_COLOR: Record<string, string> = {
  personal: 'purple', académico: 'teal', laboral: 'amber', social: 'pink', otro: 'gray',
}

const COLORS: Record<string, { border: string; badge: string }> = {
  blue:    { border: 'border-l-blue-500',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  teal:    { border: 'border-l-teal-500',    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  emerald: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  gray:    { border: 'border-l-gray-600',    badge: 'bg-gray-700 text-gray-400 border-gray-600' },
  purple:  { border: 'border-l-purple-500',  badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  amber:   { border: 'border-l-amber-500',   badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  pink:    { border: 'border-l-pink-500',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayPanel({ clases, eventos, horarios, reservas, todayStr }: Props) {
  const [dayOffset, setDayOffset] = useState(0)
  const [open, setOpen]           = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('today-panel-open')
    if (saved !== null) setOpen(saved === 'true')
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('today-panel-open', String(next))
  }

  // Target date
  const targetDate = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + dayOffset)
    return date
  }, [todayStr, dayOffset])

  const targetStr = useMemo(() => dateToStr(targetDate), [targetDate])
  const targetDow = useMemo(() => normalizeDia(DOW_MAP[targetDate.getDay()] ?? 'lunes'), [targetDate])

  const labelPrefix = dayOffset === 0 ? 'Hoy' : dayOffset === 1 ? 'Mañana' : dayOffset === -1 ? 'Ayer' : ''
  const labelDia = `${DIAS_LONG[targetDate.getDay()]} ${targetDate.getDate()} de ${MESES_LONG[targetDate.getMonth()]}`

  // Build items for target day
  const items = useMemo(() => {
    const result: { id: string; hora: string | null; horaFin: string | null; titulo: string; detalle: string | null; tipo: string; colorKey: string }[] = []

    for (const c of clases) {
      if (normalizeDia(c.dia_semana) !== targetDow) continue
      const confirmaciones = (c.anuncios_tutoria_curso ?? []).filter(a => a.fecha === targetStr).length
      const esTutoriaCurso = c.tipo === 'tutoria_curso'
      if (esTutoriaCurso && confirmaciones === 0) continue
      const detalles = [
        c.centro_computo ? 'Centro cómputo' : null,
        confirmaciones > 0 ? `${confirmaciones} confirmó asistencia` : null,
      ].filter(Boolean).join(' · ')
      result.push({
        id: `clase-${c.id}`,
        hora:    c.hora_inicio?.slice(0, 5) ?? null,
        horaFin: c.hora_fin?.slice(0, 5)   ?? null,
        titulo:  c.cursos?.asignatura ?? 'Clase',
        detalle: detalles || null,
        tipo:     'clase',
        colorKey: esTutoriaCurso ? 'teal' : 'blue',
      })
    }

    for (const h of horarios) {
      if (normalizeDia(h.dia_semana) !== targetDow) continue
      if (h.estado !== 'disponible') continue
      if (h.disponible_hasta && targetStr > h.disponible_hasta) continue
      const hRes = reservas.filter(r => r.horario_id === h.id && r.fecha === targetStr)
      if (hRes.length === 0) continue
      const nombres = hRes.map(r => `${r.estudiante_nombre} (${r.estado})`).join(' · ')
      result.push({
        id: `tutoria-${h.id}`,
        hora:    h.hora_inicio?.slice(0, 5) ?? null,
        horaFin: h.hora_fin?.slice(0, 5)   ?? null,
        titulo:  hRes.length > 0 ? `Tutoría · ${hRes.length} reserva${hRes.length > 1 ? 's' : ''}` : 'Tutoría disponible',
        detalle: nombres || null,
        tipo:     'tutoria',
        colorKey: hRes.length > 0 ? 'emerald' : 'gray',
      })
    }

    for (const ev of eventos) {
      if (!eventOccursOnDay(ev, targetStr)) continue
      result.push({
        id: `evento-${ev.id}`,
        hora:    ev.todo_el_dia ? null : ev.hora_inicio?.slice(0, 5) ?? null,
        horaFin: ev.todo_el_dia ? null : ev.hora_fin?.slice(0, 5)   ?? null,
        titulo:  ev.titulo,
        detalle: ev.descripcion || null,
        tipo:     'evento',
        colorKey: EVENTO_COLOR[ev.tipo] ?? 'gray',
      })
    }

    result.sort((a, b) => {
      if (!a.hora && !b.hora) return 0
      if (!a.hora) return -1
      if (!b.hora) return 1
      return a.hora.localeCompare(b.hora)
    })

    return result
  }, [clases, eventos, horarios, reservas, targetStr, targetDow])

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={toggle} className="flex items-center gap-1.5 shrink-0">
          <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-white">
            {labelPrefix || labelDia}
          </span>
          {labelPrefix && (
            <span className="text-sm text-gray-500">— {labelDia}</span>
          )}
          <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Day navigation */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setDayOffset(o => o - 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            title="Día anterior"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {dayOffset !== 0 && (
            <button
              onClick={() => setDayOffset(0)}
              className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => setDayOffset(o => o + 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            title="Día siguiente"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Items */}
      {open && (
        <div className="mt-3 space-y-1.5">
          {items.length === 0 ? (
            <p className="text-sm text-gray-600 py-2 text-center">Sin actividades para este día</p>
          ) : (
            items.map(item => {
              const clr = COLORS[item.colorKey] ?? COLORS.gray
              return (
                <div key={item.id} className={`flex items-start gap-3 pl-3 border-l-2 ${clr.border} py-1.5`}>
                  <div className="w-[88px] flex-shrink-0 pt-0.5">
                    {item.hora ? (
                      <span className="text-xs font-mono text-gray-500">
                        {item.hora}{item.horaFin ? `–${item.horaFin}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 italic">todo el día</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 leading-tight truncate">{item.titulo}</p>
                    {item.detalle && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight truncate">{item.detalle}</p>
                    )}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${clr.badge}`}>
                    {item.tipo === 'clase' ? 'Clase' : item.tipo === 'tutoria' ? 'Tutoría' : 'Evento'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
