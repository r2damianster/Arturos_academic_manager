'use client'

import { useState, useTransition } from 'react'
import { actualizarEstadoCitacion } from '@/lib/actions/citaciones'

interface Citacion {
  id: string
  fecha_citacion: string
  razon: string
  detalle_razon: string | null
  estado: string
  cursos: { id: string; asignatura: string; institucion: string | null } | null
  estudiantes: { id: string; nombre: string; email: string } | null
}

interface Props {
  citaciones: Citacion[]
}

const RAZONES: Record<string, string> = {
  inasistencia:       'Inasistencia',
  'bajo_desempeño':   'Bajo desempeño',
  asignacion_trabajo: 'Asignación trabajo',
  otro:               'Otro',
}

const ESTADOS: Record<string, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-900/40 text-amber-300 border-amber-800'     },
  agendada:   { label: 'Agendada',   cls: 'bg-blue-900/40 text-blue-300 border-blue-800'        },
  asistida:   { label: 'Asistida',   cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' },
  no_asistida:{ label: 'No asistió', cls: 'bg-red-900/40 text-red-400 border-red-800'           },
  cumplida:   { label: 'Cumplida',   cls: 'bg-gray-800 text-gray-400 border-gray-700'           },
  mejorado:   { label: 'Mejorado',   cls: 'bg-gray-800 text-gray-400 border-gray-700'           },
}

const NEXT_ESTADOS: Record<string, { value: string; label: string }[]> = {
  pendiente:   [{ value: 'agendada', label: 'Agendar' }, { value: 'no_asistida', label: 'No asistió' }, { value: 'cumplida', label: 'Cerrar' }],
  agendada:    [{ value: 'asistida', label: 'Asistió' }, { value: 'no_asistida', label: 'No asistió' }],
  asistida:    [{ value: 'cumplida', label: 'Cumplida' }, { value: 'mejorado', label: 'Mejorado' }],
  no_asistida: [{ value: 'pendiente', label: 'Reenviar' }, { value: 'cumplida', label: 'Cerrar' }],
}

export function CitacionesTab({ citaciones: init }: Props) {
  const [citaciones, setCitaciones] = useState(init)
  const [, startTransition] = useTransition()
  const [acting, setActing] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Filters
  const [fEstado, setFEstado] = useState('')
  const [fCurso,  setFCurso]  = useState('')
  const [fMes,    setFMes]    = useState('')

  const cursos = Array.from(
    new Map(
      citaciones
        .filter(c => c.cursos)
        .map(c => [c.cursos!.id, c.cursos!.asignatura])
    ).entries()
  )

  const filtered = citaciones.filter(c => {
    if (fEstado && c.estado !== fEstado) return false
    if (fCurso  && c.cursos?.id !== fCurso) return false
    if (fMes    && !c.fecha_citacion.startsWith(fMes)) return false
    return true
  })

  const pendientes = filtered.filter(c => c.estado === 'pendiente' || c.estado === 'agendada').length

  async function cambiarEstado(citacion: Citacion, nuevoEstado: string) {
    if (!citacion.cursos) return
    setActing(citacion.id); setErr(null)
    startTransition(async () => {
      const res = await actualizarEstadoCitacion(citacion.id, nuevoEstado, citacion.cursos!.id)
      if (res?.error) { setErr(res.error); setActing(null); return }
      setCitaciones(prev => prev.map(c =>
        c.id === citacion.id ? { ...c, estado: nuevoEstado } : c
      ))
      setActing(null)
    })
  }

  return (
    <div className="space-y-4">

      {err && (
        <div className="text-xs px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{filtered.length} citaciones</span>
        {pendientes > 0 && (
          <span className="text-amber-400 font-medium">{pendientes} pendientes/agendadas</span>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <select value={fCurso} onChange={e => setFCurso(e.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los cursos</option>
            {cursos.map(([id, asig]) => <option key={id} value={id}>{asig}</option>)}
          </select>
          <input
            type="month" value={fMes} onChange={e => setFMes(e.target.value)}
            className="input text-xs py-1.5" title="Filtrar por mes"
          />
        </div>
        {(fEstado || fCurso || fMes) && (
          <button
            onClick={() => { setFEstado(''); setFCurso(''); setFMes('') }}
            className="text-[10px] text-gray-500 hover:text-gray-300 mt-2"
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">
          No hay citaciones con los filtros aplicados.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const estadoInfo = ESTADOS[c.estado] ?? { label: c.estado, cls: 'bg-gray-800 text-gray-400 border-gray-700' }
            const nextAccions = NEXT_ESTADOS[c.estado] ?? []
            const dateLabel = new Date(c.fecha_citacion + 'T12:00:00').toLocaleDateString('es-ES', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            return (
              <div
                key={c.id}
                className="card flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">
                      {c.estudiantes?.nombre ?? '—'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${estadoInfo.cls}`}>
                      {estadoInfo.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {dateLabel}
                    {c.cursos && <span className="ml-2 text-gray-600">{c.cursos.asignatura}</span>}
                    {c.cursos?.institucion && <span className="ml-2 text-gray-700">{c.cursos.institucion}</span>}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    <span className="text-gray-500">Razón:</span>{' '}
                    {RAZONES[c.razon] ?? c.razon}
                    {c.detalle_razon && <span className="text-gray-600"> — {c.detalle_razon}</span>}
                  </p>
                </div>

                {nextAccions.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0 flex-wrap">
                    {nextAccions.map(a => (
                      <button
                        key={a.value}
                        onClick={() => cambiarEstado(c, a.value)}
                        disabled={acting === c.id}
                        className="text-[10px] border border-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
                      >
                        {acting === c.id ? '...' : a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
