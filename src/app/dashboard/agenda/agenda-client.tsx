'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { crearEvento, eliminarEvento } from '@/lib/actions/eventos'
import type { Evento, EventoInput } from '@/lib/actions/eventos'

// ─── Colors ──────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, { bg: string; text: string; border: string; dot: string; block: string }> = {
  personal:  { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/40', dot: 'bg-purple-500', block: 'bg-purple-600/25 border-purple-500/50 text-purple-200' },
  académico: { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/40',   dot: 'bg-blue-500',   block: 'bg-blue-600/25 border-blue-500/50 text-blue-200' },
  laboral:   { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/40',dot: 'bg-emerald-500',block: 'bg-emerald-600/25 border-emerald-500/50 text-emerald-200' },
  social:    { bg: 'bg-pink-500/10',   text: 'text-pink-300',   border: 'border-pink-500/40',   dot: 'bg-pink-500',   block: 'bg-pink-600/25 border-pink-500/50 text-pink-200' },
  otro:      { bg: 'bg-gray-500/10',   text: 'text-gray-300',   border: 'border-gray-500/40',   dot: 'bg-gray-500',   block: 'bg-gray-600/25 border-gray-500/50 text-gray-200' },
}
function clr(tipo: string) { return TIPO_COLOR[tipo] ?? TIPO_COLOR.otro }

// ─── Date / time helpers ─────────────────────────────────────────────────────

const DIAS_HDR  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DIAS_LONG = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }
function toMin(t: string)   { const [h,m] = t.split(':').map(Number); return h*60+m }
function fromMin(t: number) { return `${fmt2(Math.floor(t/60))}:${fmt2(t%60)}` }

/** 7 days starting from Monday of the week at offset */
function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function fmtRange(dates: Date[]) {
  const a = dates[0], b = dates[6]
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${MESES_SHORT[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MESES_SHORT[a.getMonth()]} – ${b.getDate()} ${MESES_SHORT[b.getMonth()]} ${b.getFullYear()}`
}

// ─── Event resolution helpers ─────────────────────────────────────────────────

function eventOccursOnDay(ev: Evento, dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const [sy, sm, sd] = ev.fecha_inicio.split('-').map(Number)
  const [ey, em, ed] = ev.fecha_fin.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)

  if (!ev.recurrente) return date >= start && date <= end

  const hastaStr = ev.recurrencia_hasta ?? ev.fecha_fin
  const [hy, hm, hd] = hastaStr.split('-').map(Number)
  const hasta = new Date(hy, hm - 1, hd)
  if (date < start || date > hasta) return false
  if (ev.recurrencia === 'diaria')   return true
  if (ev.recurrencia === 'semanal')  return (ev.recurrencia_dias ?? []).includes(dow)
  if (ev.recurrencia === 'mensual')  return date.getDate() === start.getDate()
  return false
}

// ─── Dynamic slots (same logic as tutorías) ───────────────────────────────────

const DEFAULT_START_H = 8
const DEFAULT_END_H   = 18

function getDynamicSlots(eventos: Evento[], weekDates: Date[]): string[] {
  const weekStrs = weekDates.map(dateToStr)
  const relevant = eventos.filter(ev => weekStrs.some(ds => eventOccursOnDay(ev, ds)))
  const timed    = relevant.filter(ev => !ev.todo_el_dia && ev.hora_inicio)

  if (timed.length === 0) {
    return buildSlots(DEFAULT_START_H * 60, DEFAULT_END_H * 60)
  }

  const starts = timed.map(ev => toMin(ev.hora_inicio!))
  const ends   = timed.map(ev => ev.hora_fin ? toMin(ev.hora_fin) : toMin(ev.hora_inicio!) + 60)

  const tMin = Math.max(0,    Math.floor((Math.min(...starts) - 60) / 30) * 30)
  const tMax = Math.min(1440, Math.ceil( (Math.max(...ends)   + 60) / 30) * 30)

  return buildSlots(tMin, tMax)
}

function buildSlots(startMin: number, endMin: number): string[] {
  const slots: string[] = []
  for (let m = startMin; m < endMin; m += 30) {
    slots.push(fromMin(m))
  }
  return slots
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function emptyForm(day: string, hora?: string): EventoInput {
  return {
    titulo: '',
    descripcion: '',
    tipo: 'personal',
    fecha_inicio: day,
    fecha_fin: day,
    hora_inicio: hora ?? null,
    hora_fin: hora ? fromMin(toMin(hora) + 60) : null,
    todo_el_dia: !hora,
    recurrente: false,
    recurrencia: null,
    recurrencia_dias: [],
    recurrencia_hasta: null,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const SLOT_H = 48 // px per 30-min slot

export function AgendaClient({ eventos: init }: { eventos: Evento[] }) {
  const router = useRouter()
  const today = dateToStr(new Date())

  const [eventos,    setEventos]    = useState<Evento[]>(init)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState<EventoInput>(emptyForm(today))
  const [saving,     setSaving]     = useState(false)
  const [selected,   setSelected]   = useState<Evento | null>(null)
  const [, startTransition]         = useTransition()

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const timeSlots = useMemo(() => getDynamicSlots(eventos, weekDates), [eventos, weekDates])
  const slotStart = timeSlots.length ? toMin(timeSlots[0]) : DEFAULT_START_H * 60

  // Precompute which events appear on each day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Evento[]>()
    for (const d of weekDates) {
      const ds = dateToStr(d)
      map.set(ds, eventos.filter(ev => eventOccursOnDay(ev, ds)))
    }
    return map
  }, [eventos, weekDates])

  // ── Actions ────────────────────────────────────────────────────────────────

  function openNewForm(dateStr: string, hora?: string) {
    setSelected(null)
    setForm(emptyForm(dateStr, hora))
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
    setSelected(null)
    startTransition(async () => {
      await eliminarEvento(id)
      setEventos(prev => prev.filter(ev => ev.id !== id))
    })
  }

  // ── Event block positioning ────────────────────────────────────────────────

  function getBlockStyle(ev: Evento) {
    if (!ev.hora_inicio) return null
    const startMin = toMin(ev.hora_inicio)
    const endMin   = ev.hora_fin ? toMin(ev.hora_fin) : startMin + 60
    const top      = ((startMin - slotStart) / 30) * SLOT_H
    const height   = Math.max(((endMin - startMin) / 30) * SLOT_H, SLOT_H * 0.5)
    return { top, height }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Weekly calendar ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Nav header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(0)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
              Hoy
            </button>
            <button onClick={() => setWeekOffset(w => w - 1)} className="btn-ghost p-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)} className="btn-ghost p-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-sm text-gray-300 font-medium">{fmtRange(weekDates)}</span>
          </div>
          <button onClick={() => openNewForm(today)} className="btn-primary text-sm px-4 py-1.5">
            + Nuevo evento
          </button>
        </div>

        {/* All-day row */}
        {weekDates.some(d => (eventsByDay.get(dateToStr(d)) ?? []).some(ev => ev.todo_el_dia)) && (
          <div className="flex border-b border-gray-800 mb-0">
            <div className="w-14 flex-shrink-0 text-[10px] text-gray-600 flex items-center justify-end pr-2 py-1">
              todo día
            </div>
            {weekDates.map(date => {
              const ds = dateToStr(date)
              const allDay = (eventsByDay.get(ds) ?? []).filter(ev => ev.todo_el_dia)
              return (
                <div key={ds} className="flex-1 border-l border-gray-800 min-h-[28px] px-0.5 py-0.5 space-y-0.5">
                  {allDay.map(ev => {
                    const c = clr(ev.tipo)
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelected(ev)}
                        className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate border ${c.block}`}
                      >
                        {ev.titulo}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Day headers */}
        <div className="flex border-b border-gray-800">
          <div className="w-14 flex-shrink-0" />
          {weekDates.map(date => {
            const ds      = dateToStr(date)
            const isToday = ds === today
            const dow     = date.getDay()
            return (
              <div key={ds} className={`flex-1 border-l border-gray-800 text-center py-2 ${isToday ? 'bg-brand-600/10' : ''}`}>
                <p className="text-xs text-gray-500">{DIAS_HDR[dow]}</p>
                <p className={`text-sm font-semibold ${isToday ? 'text-brand-400' : 'text-gray-200'}`}>
                  {date.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <div className="flex relative">
            {/* Time labels */}
            <div className="w-14 flex-shrink-0 relative">
              {timeSlots.filter((_, i) => i % 2 === 0).map(slot => (
                <div
                  key={slot}
                  className="text-[10px] text-gray-600 text-right pr-2 flex items-start justify-end"
                  style={{ height: SLOT_H * 2 }}
                >
                  <span className="mt-0.5">{slot}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map(date => {
              const ds      = dateToStr(date)
              const isToday = ds === today
              const dayEvs  = (eventsByDay.get(ds) ?? []).filter(ev => !ev.todo_el_dia && ev.hora_inicio)

              return (
                <div
                  key={ds}
                  className={`flex-1 border-l border-gray-800 relative`}
                  style={{ height: timeSlots.length * SLOT_H }}
                >
                  {/* Slot rows (clickable) */}
                  {timeSlots.map((slot, si) => (
                    <div
                      key={slot}
                      onClick={() => openNewForm(ds, slot)}
                      className={`absolute w-full border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors ${
                        si % 2 === 0 ? '' : 'border-dashed border-gray-800/30'
                      } ${isToday ? 'bg-brand-600/5' : ''}`}
                      style={{ top: si * SLOT_H, height: SLOT_H }}
                    />
                  ))}

                  {/* Event blocks */}
                  {dayEvs.map(ev => {
                    const pos = getBlockStyle(ev)
                    if (!pos) return null
                    const c = clr(ev.tipo)
                    return (
                      <div
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); setSelected(ev) }}
                        className={`absolute left-0.5 right-0.5 rounded border px-1.5 py-1 cursor-pointer overflow-hidden z-10 ${c.block}`}
                        style={{ top: pos.top + 1, height: pos.height - 2 }}
                      >
                        <p className="text-[11px] font-semibold leading-tight truncate">{ev.titulo}</p>
                        {pos.height >= SLOT_H && ev.hora_inicio && (
                          <p className="text-[10px] opacity-70 leading-none mt-0.5">
                            {ev.hora_inicio.slice(0,5)}{ev.hora_fin ? `–${ev.hora_fin.slice(0,5)}` : ''}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 pt-3 mt-1 border-t border-gray-800 flex-wrap px-1">
          {Object.entries(TIPO_COLOR).map(([tipo, c]) => (
            <div key={tipo} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className="text-xs text-gray-500 capitalize">{tipo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Event detail popover ──────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${clr(selected.tipo).dot}`} />
                <h3 className="font-semibold text-white">{selected.titulo}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300 text-lg leading-none flex-shrink-0">✕</button>
            </div>
            <div className="space-y-1 text-sm text-gray-400 mb-4">
              <p className="capitalize">{selected.tipo}{selected.recurrente ? ' · recurrente' : ''}</p>
              {selected.todo_el_dia
                ? <p>Todo el día</p>
                : selected.hora_inicio && (
                  <p>{selected.hora_inicio.slice(0,5)}{selected.hora_fin ? ` – ${selected.hora_fin.slice(0,5)}` : ''}</p>
                )
              }
              <p>{selected.fecha_inicio}{selected.fecha_fin !== selected.fecha_inicio ? ` → ${selected.fecha_fin}` : ''}</p>
              {selected.descripcion && <p className="text-gray-500 mt-1">{selected.descripcion}</p>}
            </div>
            <button
              onClick={() => handleDelete(selected.id)}
              className="w-full py-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors text-sm font-medium"
            >
              Eliminar evento
            </button>
          </div>
        </div>
      )}

      {/* ── New event modal ───────────────────────────────────────────── */}
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
              <div>
                <label className="label">Título *</label>
                <input
                  type="text" required value={form.titulo} autoFocus
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="input" placeholder="Reunión, congreso, cumpleaños..."
                />
              </div>

              <div>
                <label className="label">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(['personal','académico','laboral','social','otro'] as const).map(t => {
                    const c = clr(t)
                    return (
                      <button
                        type="button" key={t}
                        onClick={() => setForm(f => ({ ...f, tipo: t }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                          form.tipo === t ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-800 text-gray-500 border-transparent hover:border-gray-700'
                        }`}
                      >{t}</button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio *</label>
                  <input type="date" required value={form.fecha_inicio}
                    onChange={e => setForm(f => ({
                      ...f, fecha_inicio: e.target.value,
                      fecha_fin: f.fecha_fin < e.target.value ? e.target.value : f.fecha_fin,
                    }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input type="date" value={form.fecha_fin} min={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value || f.fecha_inicio }))}
                    className="input"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.todo_el_dia}
                  onChange={e => setForm(f => ({ ...f, todo_el_dia: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600"
                />
                <span className="text-sm text-gray-300">Todo el día</span>
              </label>

              {!form.todo_el_dia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hora inicio</label>
                    <input type="time" value={form.hora_inicio ?? ''}
                      onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Hora fin</label>
                    <input type="time" value={form.hora_fin ?? ''}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.recurrente}
                  onChange={e => setForm(f => ({
                    ...f, recurrente: e.target.checked,
                    recurrencia: e.target.checked ? 'semanal' : null,
                    recurrencia_dias: [], recurrencia_hasta: null,
                  }))}
                  className="rounded border-gray-600 bg-gray-800 text-brand-600"
                />
                <span className="text-sm text-gray-300">Evento recurrente</span>
              </label>

              {form.recurrente && (
                <div className="space-y-3 pl-4 border-l-2 border-gray-800">
                  <div className="flex gap-2">
                    {(['diaria','semanal','mensual'] as const).map(r => (
                      <button type="button" key={r}
                        onClick={() => setForm(f => ({ ...f, recurrencia: r }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          form.recurrencia === r ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >{r}</button>
                    ))}
                  </div>
                  {form.recurrencia === 'semanal' && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Días</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {['D','L','M','X','J','V','S'].map((d, i) => {
                          const sel = (form.recurrencia_dias ?? []).includes(i)
                          return (
                            <button type="button" key={i}
                              onClick={() => setForm(f => {
                                const days = f.recurrencia_dias ?? []
                                return { ...f, recurrencia_dias: sel ? days.filter(x => x !== i) : [...days, i] }
                              })}
                              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                                sel ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                              }`}
                            >{d}</button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="label">Repetir hasta</label>
                    <input type="date" value={form.recurrencia_hasta ?? ''} min={form.fecha_inicio}
                      onChange={e => setForm(f => ({ ...f, recurrencia_hasta: e.target.value || null }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea value={form.descripcion ?? ''} rows={2}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="input resize-none" placeholder="Notas..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancelar</button>
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
