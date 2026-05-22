'use client'

import { useState } from 'react'
import { convertirAEvento, convertirVariasAEvento } from '@/lib/actions/actividades'
import type { ActividadConCurso } from '@/lib/actions/actividades'
import type { EventoInput } from '@/lib/actions/eventos'

// ─── Time helpers (mirror de agenda-client.tsx) ───────────────────────────────

function fmt2(n: number) { return String(n).padStart(2, '0') }
function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function fromMin(t: number) { return `${fmt2(Math.floor(t / 60))}:${fmt2(t % 60)}` }

function roundUpTo15(): string {
  const now = new Date()
  const totalMin = now.getHours() * 60 + now.getMinutes()
  const rounded = Math.min(Math.ceil(totalMin / 15) * 15, 23 * 60 + 45)
  return fromMin(rounded)
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  personal:  { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/40' },
  académico: { bg: 'bg-teal-500/15',   text: 'text-teal-300',   border: 'border-teal-500/40' },
  laboral:   { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/40' },
  social:    { bg: 'bg-pink-500/15',   text: 'text-pink-300',   border: 'border-pink-500/40' },
  tarea:     { bg: 'bg-brand-500/15',  text: 'text-brand-300',  border: 'border-brand-500/40' },
  otro:      { bg: 'bg-gray-500/15',   text: 'text-gray-300',   border: 'border-gray-500/40' },
}
function evClr(tipo: string) { return TIPO_COLOR[tipo] ?? TIPO_COLOR.otro }

// ─── TimePicker (idéntico al de agenda-client.tsx) ────────────────────────────

function TimePicker({ value, onChange, label, minTime }: {
  value: string | null
  onChange: (v: string) => void
  label: string
  minTime?: string | null
}) {
  const totalMin = value ? toMin(value) : null
  const isPM = totalMin !== null ? totalMin >= 720 : null
  const h12 = totalMin !== null ? (Math.floor(totalMin / 60) % 12 || 12) : null
  const minute = totalMin !== null ? totalMin % 60 : null
  const minTotalMin = minTime ? toMin(minTime) : null

  function build(p: 'AM' | 'PM', h: number, m: number): string {
    const h24 = p === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
    return fromMin(h24 * 60 + m)
  }
  function resultMin(p: 'AM' | 'PM', h: number, m: number) {
    const h24 = p === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
    return h24 * 60 + m
  }
  const period = isPM === null ? null : isPM ? 'PM' : 'AM'
  function isHourDisabled(h: number) {
    if (!minTotalMin || !period) return false
    return [0, 15, 30, 45].every(m => resultMin(period, h, m) < minTotalMin)
  }
  function isMinDisabled(m: number) {
    if (!minTotalMin || h12 === null || !period) return false
    return resultMin(period, h12, m) < minTotalMin
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1.5 mb-2">
        {(['AM', 'PM'] as const).map(p => (
          <button type="button" key={p} onClick={() => onChange(build(p, h12 ?? 8, minute ?? 0))}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1 mb-2">
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => {
          const disabled = isHourDisabled(h)
          return (
            <button type="button" key={h} onClick={() => !disabled && onChange(build(period ?? 'AM', h, minute ?? 0))}
              className={`py-1 rounded text-sm font-medium transition-colors ${h12 === h ? 'bg-brand-600 text-white' : disabled ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {h}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {[0, 15, 30, 45].map(m => {
          const disabled = isMinDisabled(m)
          return (
            <button type="button" key={m} onClick={() => !disabled && onChange(build(period ?? 'AM', h12 ?? 8, m))}
              className={`py-1.5 rounded text-sm font-medium transition-colors ${minute === m ? 'bg-brand-600 text-white' : disabled ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {String(m).padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  /** Single actividad OR multiple for bulk conversion */
  actividades: ActividadConCurso[]
  onClose: () => void
  onConvertido: () => void
}

function initForm(actividades: ActividadConCurso[]): EventoInput {
  const hoy = new Date()
  const fmt2l = (n: number) => String(n).padStart(2, '0')
  const single = actividades.length === 1 ? actividades[0] : null
  const fechaDefault = single?.fecha_vencimiento
    ? single.fecha_vencimiento.slice(0, 10)
    : `${hoy.getFullYear()}-${fmt2l(hoy.getMonth() + 1)}-${fmt2l(hoy.getDate())}`
  const ini = roundUpTo15()
  return {
    titulo: single ? single.titulo : '',
    descripcion: single ? (single.descripcion ?? '') : '',
    tipo: 'tarea',
    fecha_inicio: fechaDefault,
    fecha_fin: fechaDefault,
    hora_inicio: ini,
    hora_fin: fromMin(Math.min(toMin(ini) + 60, 23 * 60 + 45)),
    todo_el_dia: false,
    recurrente: false,
    recurrencia: null,
    recurrencia_dias: [],
    recurrencia_hasta: null,
  }
}

const TIPOS = ['personal', 'académico', 'laboral', 'tarea', 'otro'] as const

export function ConvertirEventoModal({ actividades, onClose, onConvertido }: Props) {
  const [form, setForm] = useState<EventoInput>(() => initForm(actividades))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBulk = actividades.length > 1

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const opts = {
      fecha: form.fecha_inicio,
      horaInicio: form.todo_el_dia ? undefined : (form.hora_inicio ?? undefined),
      horaFin: form.todo_el_dia ? undefined : (form.hora_fin ?? undefined),
    }
    const res = isBulk
      ? await convertirVariasAEvento(actividades.map(a => a.id), { titulo: form.titulo, tipo: form.tipo, ...opts })
      : await convertirAEvento(actividades[0].id, opts)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onConvertido()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-white">Programar en calendario</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isBulk
                ? `Agrupar ${actividades.length} tareas en un evento`
                : 'Crear evento a partir de esta tarea'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lista de tareas incluidas (bulk) */}
          {isBulk && (
            <div className="bg-gray-800/50 rounded-xl p-3 space-y-1">
              {actividades.map(a => (
                <p key={a.id} className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="text-gray-600">✓</span> {a.titulo}
                </p>
              ))}
            </div>
          )}

          {/* Título (editable) */}
          <div>
            <label className="label">Título</label>
            <input
              type="text"
              required
              autoFocus
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className="input"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {TIPOS.map(t => {
                const c = evClr(t)
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      form.tipo === t
                        ? `${c.bg} ${c.text} ${c.border}`
                        : 'bg-gray-800 text-gray-500 border-transparent hover:border-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio *</label>
              <input
                type="date"
                required
                value={form.fecha_inicio}
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
                type="date"
                value={form.fecha_fin}
                min={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value || f.fecha_inicio }))}
                className="input"
              />
            </div>
          </div>

          {/* Todo el día */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.todo_el_dia}
              onChange={e => {
                const allDay = e.target.checked
                setForm(f => {
                  if (allDay) return { ...f, todo_el_dia: true, hora_inicio: null, hora_fin: null }
                  const ini = f.hora_inicio ?? roundUpTo15()
                  const fin = f.hora_fin && toMin(f.hora_fin) > toMin(ini)
                    ? f.hora_fin
                    : fromMin(Math.min(toMin(ini) + 60, 23 * 60 + 45))
                  return { ...f, todo_el_dia: false, hora_inicio: ini, hora_fin: fin }
                })
              }}
              className="rounded border-gray-600 bg-gray-800 text-brand-600"
            />
            <span className="text-sm text-gray-300">Todo el día</span>
          </label>

          {/* Horas */}
          {!form.todo_el_dia && (
            <div className="grid grid-cols-2 gap-3">
              <TimePicker
                label="Hora inicio"
                value={form.hora_inicio ?? null}
                onChange={v => setForm(f => {
                  const minFin = toMin(v) + 15
                  const keepFin = f.hora_fin && toMin(f.hora_fin) >= minFin
                  return {
                    ...f,
                    hora_inicio: v,
                    hora_fin: keepFin ? f.hora_fin : fromMin(Math.min(toMin(v) + 60, 23 * 60 + 45)),
                  }
                })}
              />
              <TimePicker
                label="Hora fin"
                value={form.hora_fin ?? null}
                onChange={v => setForm(f => ({ ...f, hora_fin: v }))}
                minTime={
                  form.fecha_inicio === form.fecha_fin && form.hora_inicio
                    ? fromMin(Math.min(toMin(form.hora_inicio) + 15, 23 * 60 + 45))
                    : null
                }
              />
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              value={form.descripcion ?? ''}
              rows={2}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="input resize-none"
              placeholder="Notas adicionales..."
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Guardando...' : '→ Agregar al calendario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
