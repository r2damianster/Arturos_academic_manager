'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { crearEvento, eliminarEvento } from '@/lib/actions/eventos'
import type { Evento, EventoInput } from '@/lib/actions/eventos'

// ─── Color mapping ───────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, string> = {
  personal: 'purple',
  académico: 'blue',
  laboral: 'emerald',
  social: 'pink',
  otro: 'gray',
}

const COLOR: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  purple:  { dot: 'bg-purple-500',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/30' },
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  pink:    { dot: 'bg-pink-500',    bg: 'bg-pink-500/10',    text: 'text-pink-400',    border: 'border-pink-500/30' },
  yellow:  { dot: 'bg-yellow-500',  bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  border: 'border-yellow-500/30' },
  gray:    { dot: 'bg-gray-500',    bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/30' },
}

function clr(tipo: string) { return COLOR[TIPO_COLOR[tipo] ?? 'blue'] ?? COLOR.blue }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_HDR = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }

function getEventosForDay(eventos: Evento[], dateStr: string): Evento[] {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()

  return eventos.filter(ev => {
    const [sy, sm, sd] = ev.fecha_inicio.split('-').map(Number)
    const [ey, em, ed] = ev.fecha_fin.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd)
    const end   = new Date(ey, em - 1, ed)

    if (!ev.recurrente) return date >= start && date <= end

    const hastaStr = ev.recurrencia_hasta ?? ev.fecha_fin
    const [hy, hm, hd] = hastaStr.split('-').map(Number)
    const hasta = new Date(hy, hm - 1, hd)
    if (date < start || date > hasta) return false

    if (ev.recurrencia === 'diaria') return true
    if (ev.recurrencia === 'semanal') return (ev.recurrencia_dias ?? []).includes(dow)
    if (ev.recurrencia === 'mensual') return date.getDate() === start.getDate()
    return false
  })
}

function fmtHora(h: string) { return h.slice(0, 5) }

function fmtDia(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ─── Initial form state ───────────────────────────────────────────────────────

function emptyForm(day: string): EventoInput {
  return {
    titulo: '',
    descripcion: '',
    tipo: 'personal',
    fecha_inicio: day,
    fecha_fin: day,
    hora_inicio: null,
    hora_fin: null,
    todo_el_dia: false,
    recurrente: false,
    recurrencia: null,
    recurrencia_dias: [],
    recurrencia_hasta: null,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AgendaClient({ eventos: init }: { eventos: Evento[] }) {
  const router = useRouter()
  const today = dateToStr(new Date())

  const [eventos, setEventos] = useState<Evento[]>(init)
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState(today)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventoInput>(emptyForm(today))
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  // ── Calendar grid ──────────────────────────────────────────────────────────

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${fmt2(month+1)}-${fmt2(d)}`)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // ── Selected day events ────────────────────────────────────────────────────

  const selectedEventos = useMemo(
    () => getEventosForDay(eventos, selectedDay),
    [eventos, selectedDay],
  )

  // ── Upcoming 7 days ────────────────────────────────────────────────────────

  const upcoming = useMemo(() => {
    const result: { day: string; evs: Evento[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const ds = dateToStr(d)
      const evs = getEventosForDay(eventos, ds)
      if (evs.length) result.push({ day: ds, evs })
    }
    return result
  }, [eventos])

  // ── Actions ────────────────────────────────────────────────────────────────

  function openForm() {
    setForm(emptyForm(selectedDay))
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await crearEvento(form)
    setSaving(false)
    if (!result.error) {
      setShowForm(false)
      router.refresh()
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await eliminarEvento(id)
      setEventos(prev => prev.filter(ev => ev.id !== id))
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ── Monthly calendar ─────────────────────────────────────── */}
        <div className="card">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="btn-ghost p-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-semibold text-white">{MESES[month]} {year}</h2>
            <button onClick={nextMonth} className="btn-ghost p-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_HDR.map(d => (
              <div key={d} className="text-center text-xs text-gray-600 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((dayStr, i) => {
              if (!dayStr) return <div key={i} />
              const evs = getEventosForDay(eventos, dayStr)
              const isToday    = dayStr === today
              const isSelected = dayStr === selectedDay
              const dayNum = parseInt(dayStr.split('-')[2])

              return (
                <button
                  key={dayStr}
                  onClick={() => setSelectedDay(dayStr)}
                  className={[
                    'flex flex-col items-center pt-1.5 pb-1 px-0.5 rounded-lg text-sm transition-colors min-h-[48px]',
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : isToday
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                      : 'hover:bg-gray-800 text-gray-400',
                  ].join(' ')}
                >
                  <span className="font-medium text-xs leading-none">{dayNum}</span>
                  {evs.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {evs.slice(0, 3).map((ev, ei) => (
                        <span
                          key={ei}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : clr(ev.tipo).dot}`}
                        />
                      ))}
                      {evs.length > 3 && (
                        <span className={`text-[9px] leading-none ${isSelected ? 'text-white/60' : 'text-gray-600'}`}>
                          +{evs.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-3 border-t border-gray-800 flex-wrap">
            {Object.entries(TIPO_COLOR).map(([tipo, color]) => (
              <div key={tipo} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${COLOR[color]?.dot}`} />
                <span className="text-xs text-gray-500 capitalize">{tipo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Selected day */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm capitalize">{fmtDia(selectedDay)}</h3>
              <button onClick={openForm} className="btn-primary text-xs px-3 py-1.5">+ Nuevo</button>
            </div>

            {selectedEventos.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">Sin eventos</p>
            ) : (
              <div className="space-y-2">
                {selectedEventos.map(ev => {
                  const c = clr(ev.tipo)
                  return (
                    <div key={ev.id} className={`rounded-lg p-3 border ${c.bg} ${c.border} group`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${c.text}`}>{ev.titulo}</p>
                          <p className="text-xs text-gray-500 capitalize mt-0.5">
                            {ev.tipo}{ev.recurrente ? ' · recurrente' : ''}
                          </p>
                          {!ev.todo_el_dia && ev.hora_inicio && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtHora(ev.hora_inicio)}{ev.hora_fin ? ` – ${fmtHora(ev.hora_fin)}` : ''}
                            </p>
                          )}
                          {ev.todo_el_dia && (
                            <p className="text-xs text-gray-500 mt-0.5">Todo el día</p>
                          )}
                          {ev.descripcion && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.descripcion}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs flex-shrink-0 p-0.5"
                        >✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Próximos 7 días */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">Próximos 7 días</h3>
            {upcoming.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-2">Sin eventos próximos</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(({ day, evs }) => (
                  <div key={day}>
                    <p className="text-xs text-gray-500 mb-1 capitalize">
                      {new Date(day + 'T00:00:00').toLocaleDateString('es-MX', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </p>
                    {evs.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 py-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${clr(ev.tipo).dot}`} />
                        <span className="text-xs text-gray-300 truncate">{ev.titulo}</span>
                        {ev.hora_inicio && (
                          <span className="text-xs text-gray-600 flex-shrink-0">{fmtHora(ev.hora_inicio)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── New event modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">Nuevo evento</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div>
                <label className="label">Título *</label>
                <input
                  type="text" required value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="input" placeholder="Reunión con coordinador..."
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="label">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(['personal', 'académico', 'laboral', 'social', 'otro'] as const).map(t => {
                    const c = clr(t)
                    const active = form.tipo === t
                    return (
                      <button
                        type="button" key={t}
                        onClick={() => setForm(f => ({ ...f, tipo: t }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                          active ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-800 text-gray-500 border-transparent hover:border-gray-700'
                        }`}
                      >{t}</button>
                    )
                  })}
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio *</label>
                  <input
                    type="date" required value={form.fecha_inicio}
                    onChange={e => setForm(f => ({
                      ...f,
                      fecha_inicio: e.target.value,
                      fecha_fin: f.fecha_fin < e.target.value ? e.target.value : f.fecha_fin,
                    }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input
                    type="date" value={form.fecha_fin} min={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value || f.fecha_inicio }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Todo el día */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.todo_el_dia}
                  onChange={e => setForm(f => ({ ...f, todo_el_dia: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600"
                />
                <span className="text-sm text-gray-300">Todo el día</span>
              </label>

              {/* Horas */}
              {!form.todo_el_dia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hora inicio</label>
                    <input
                      type="time" value={form.hora_inicio ?? ''}
                      onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Hora fin</label>
                    <input
                      type="time" value={form.hora_fin ?? ''}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              {/* Recurrente */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.recurrente}
                  onChange={e => setForm(f => ({
                    ...f,
                    recurrente: e.target.checked,
                    recurrencia: e.target.checked ? 'semanal' : null,
                    recurrencia_dias: [],
                    recurrencia_hasta: null,
                  }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600"
                />
                <span className="text-sm text-gray-300">Evento recurrente</span>
              </label>

              {form.recurrente && (
                <div className="space-y-3 pl-4 border-l-2 border-gray-800">
                  {/* Frecuencia */}
                  <div className="flex gap-2">
                    {(['diaria', 'semanal', 'mensual'] as const).map(r => (
                      <button
                        type="button" key={r}
                        onClick={() => setForm(f => ({ ...f, recurrencia: r }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          form.recurrencia === r ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >{r}</button>
                    ))}
                  </div>

                  {/* Días de semana */}
                  {form.recurrencia === 'semanal' && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Días de la semana</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {DIAS_HDR.map((d, i) => {
                          const sel = (form.recurrencia_dias ?? []).includes(i)
                          return (
                            <button
                              type="button" key={i}
                              onClick={() => setForm(f => {
                                const days = f.recurrencia_dias ?? []
                                return { ...f, recurrencia_dias: sel ? days.filter(x => x !== i) : [...days, i] }
                              })}
                              className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                                sel ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                              }`}
                            >{d}</button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Repetir hasta */}
                  <div>
                    <label className="label">Repetir hasta</label>
                    <input
                      type="date" value={form.recurrencia_hasta ?? ''} min={form.fecha_inicio}
                      onChange={e => setForm(f => ({ ...f, recurrencia_hasta: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              {/* Descripción */}
              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea
                  value={form.descripcion ?? ''} rows={2}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="input resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Guardando...' : 'Crear evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
