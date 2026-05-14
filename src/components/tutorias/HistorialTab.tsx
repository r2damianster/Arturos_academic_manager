'use client'

import { useState, useTransition } from 'react'
import { registrarTutoriaManual, type ReservaHistorial } from '@/lib/actions/tutorias'

interface Curso {
  id: string
  asignatura: string
  institucion: string | null
  codigo: string | null
}

interface Estudiante {
  id: string
  nombre: string
  email: string
  carrera?: string | null
}

interface Props {
  historial: ReservaHistorial[]
  cursos: Curso[]
  estudiantes: Estudiante[]
}

const RAZONES: Record<string, string> = {
  inasistencia:       'Inasistencia',
  'bajo_desempeño':   'Bajo desempeño',
  asignacion_trabajo: 'Asignación trabajo',
  otro:               'Otro',
}

function estadoLabel(r: ReservaHistorial): { label: string; cls: string } {
  if (r.estado === 'completada') {
    return r.hora_inicio_manual !== null && r.estado === 'completada'
      ? { label: 'Asistió', cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' }
      : { label: 'Asistió', cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' }
  }
  if (r.estado === 'cancelado') return { label: 'Cancelado', cls: 'bg-gray-800 text-gray-400 border-gray-700' }
  if (r.estado === 'pendiente' || r.estado === 'confirmada') return { label: 'Pendiente', cls: 'bg-blue-900/40 text-blue-300 border-blue-800' }
  return { label: r.estado, cls: 'bg-gray-800 text-gray-400 border-gray-700' }
}

function horaLabel(r: ReservaHistorial): string {
  const inicio = r.hora_inicio_manual ?? r.horario_hora_inicio
  const fin    = r.hora_fin_manual    ?? r.horario_hora_fin
  if (!inicio) return '—'
  return fin ? `${inicio.slice(0, 5)}–${fin.slice(0, 5)}` : inicio.slice(0, 5)
}

function origenLabel(origen: string): string {
  if (origen === 'manual')  return 'Manual'
  if (origen === 'directa') return 'Directa'
  return 'Agendada'
}

function buildCSV(rows: ReservaHistorial[]): string {
  const headers = [
    'Fecha', 'Estudiante', 'Carrera', 'Email',
    'Curso', 'Institución', 'Hora',
    'Tipo', 'Estado', 'Razón citación', 'Notas',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    const estado = r.estado === 'completada' ? 'Asistió'
                 : r.estado === 'cancelado'  ? 'No asistió / Cancelado'
                 : 'Pendiente'
    lines.push([
      r.fecha,
      `"${r.estudiante_nombre}"`,
      `"${r.estudiante_carrera}"`,
      r.email,
      `"${r.asignatura ?? ''}"`,
      `"${r.institucion ?? ''}"`,
      horaLabel(r),
      origenLabel(r.origen),
      estado,
      `"${RAZONES[r.citacion_razon ?? ''] ?? r.citacion_razon ?? ''}"`,
      `"${r.notas ?? ''}"`,
    ].join(','))
  }
  return lines.join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function HistorialTab({ historial, cursos, estudiantes }: Props) {
  const [, startTransition] = useTransition()

  // Filters
  const [fNombre,   setFNombre]   = useState('')
  const [fCurso,    setFCurso]    = useState('')
  const [fInst,     setFInst]     = useState('')
  const [fEstado,   setFEstado]   = useState('')
  const [fOrigen,   setFOrigen]   = useState('')
  const [fDesde,    setFDesde]    = useState('')
  const [fHasta,    setFHasta]    = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [modalErr,  setModalErr]  = useState<string | null>(null)
  const [modalOk,   setModalOk]   = useState(false)

  // Modal form state
  const [mNombre,   setMNombre]   = useState('')
  const [mEmail,    setMEmail]    = useState('')
  const [mCarrera,  setMCarrera]  = useState('')
  const [mCurso,    setMCurso]    = useState(cursos[0]?.id ?? '')
  const [mFecha,    setMFecha]    = useState(new Date().toISOString().split('T')[0])
  const [mHoraI,    setMHoraI]    = useState('08:00')
  const [mHoraF,    setMHoraF]    = useState('09:00')
  const [mEstado,   setMEstado]   = useState<'asistio' | 'no_asistio' | 'cancelado'>('asistio')
  const [mNotas,    setMNotas]    = useState('')
  const [mEstudiante, setMEstudiante] = useState('')   // id from dropdown; '' = manual name

  // Fill form from student selection
  function onSelectEstudiante(id: string) {
    setMEstudiante(id)
    if (id) {
      const est = estudiantes.find(e => e.id === id)
      if (est) {
        setMNombre(est.nombre)
        setMEmail(est.email)
        setMCarrera(est.carrera ?? '')
      }
    } else {
      setMNombre(''); setMEmail(''); setMCarrera('')
    }
  }

  // Derive unique institutions for filter
  const instituciones = Array.from(
    new Set(historial.map(r => r.institucion).filter(Boolean))
  ) as string[]

  // Apply filters
  const filtered = historial.filter(r => {
    if (fNombre && !r.estudiante_nombre.toLowerCase().includes(fNombre.toLowerCase())) return false
    if (fCurso  && r.curso_id !== fCurso) return false
    if (fInst   && r.institucion !== fInst) return false
    if (fEstado === 'asistio'    && !(r.estado === 'completada')) return false
    if (fEstado === 'no_asistio' && !(r.estado === 'cancelado'))  return false
    if (fEstado === 'pendiente'  && !(r.estado === 'pendiente' || r.estado === 'confirmada')) return false
    if (fOrigen && r.origen !== fOrigen) return false
    if (fDesde  && r.fecha < fDesde) return false
    if (fHasta  && r.fecha > fHasta) return false
    return true
  })

  const hasFilters = fNombre || fCurso || fInst || fEstado || fOrigen || fDesde || fHasta

  function clearFilters() {
    setFNombre(''); setFCurso(''); setFInst(''); setFEstado('')
    setFOrigen(''); setFDesde(''); setFHasta('')
  }

  function exportar() {
    const mes = fDesde ? fDesde.slice(0, 7) : new Date().toISOString().slice(0, 7)
    downloadCSV(buildCSV(filtered), `tutorias_${mes}.csv`)
  }

  async function handleGuardar() {
    if (!mNombre.trim() || !mCurso || !mFecha || !mHoraI) {
      setModalErr('Completa nombre, curso, fecha y hora de inicio.')
      return
    }
    setSaving(true); setModalErr(null)
    startTransition(async () => {
      const res = await registrarTutoriaManual({
        estudianteNombre:  mNombre.trim(),
        estudianteEmail:   mEmail.trim() || undefined,
        estudianteCarrera: mCarrera.trim() || undefined,
        cursoId:           mCurso,
        fecha:             mFecha,
        horaInicio:        mHoraI,
        horaFin:           mHoraF || undefined,
        estado:            mEstado,
        notas:             mNotas.trim() || undefined,
      })
      setSaving(false)
      if (res?.error) { setModalErr(res.error); return }
      setModalOk(true)
      setTimeout(() => { setShowModal(false); setModalOk(false) }, 1200)
      // Reset form
      setMEstudiante(''); setMNombre(''); setMEmail(''); setMCarrera('')
      setMFecha(new Date().toISOString().split('T')[0])
      setMHoraI('08:00'); setMHoraF('09:00'); setMEstado('asistio'); setMNotas('')
    })
  }

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          {hasFilters ? ' (filtrado)' : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-xs bg-gray-700 border border-gray-600 text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors"
          >
            + Registrar tutoría
          </button>
          <button
            onClick={exportar}
            disabled={filtered.length === 0}
            className="text-xs bg-brand-700 border border-brand-600 text-brand-100 px-3 py-1.5 rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <input
            type="text" placeholder="Estudiante..." value={fNombre}
            onChange={e => setFNombre(e.target.value)}
            className="input text-xs py-1.5"
          />
          <select value={fCurso} onChange={e => setFCurso(e.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los cursos</option>
            {cursos.map(c => (
              <option key={c.id} value={c.id}>{c.asignatura}</option>
            ))}
          </select>
          {instituciones.length > 0 && (
            <select value={fInst} onChange={e => setFInst(e.target.value)} className="input text-xs py-1.5">
              <option value="">Todas las instituciones</option>
              {instituciones.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los estados</option>
            <option value="asistio">Asistió</option>
            <option value="no_asistio">No asistió / Cancelado</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={fOrigen} onChange={e => setFOrigen(e.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los tipos</option>
            <option value="agendada">Agendada por estudiante</option>
            <option value="directa">Asignada por profesor</option>
            <option value="manual">Registro manual</option>
          </select>
          <input
            type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
            className="input text-xs py-1.5" title="Desde"
          />
          <input
            type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
            className="input text-xs py-1.5" title="Hasta"
          />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="text-[10px] text-gray-500 hover:text-gray-300">
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">
          {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay tutorías registradas aún.'}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Estudiante</th>
                <th className="px-3 py-2 font-medium hidden sm:table-cell">Curso</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Institución</th>
                <th className="px-3 py-2 font-medium hidden sm:table-cell">Hora</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium hidden lg:table-cell">Tipo</th>
                <th className="px-3 py-2 font-medium hidden lg:table-cell">Citación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(r => {
                const { label, cls } = estadoLabel(r)
                const dateLabel = r.fecha
                  ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—'
                return (
                  <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateLabel}</td>
                    <td className="px-3 py-2">
                      <p className="text-gray-200 font-medium">{r.estudiante_nombre}</p>
                      <p className="text-gray-500 text-[10px]">{r.estudiante_carrera}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">
                      {r.asignatura ?? <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden md:table-cell text-[10px]">
                      {r.institucion ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell whitespace-nowrap">
                      {horaLabel(r)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden lg:table-cell text-[10px]">
                      {origenLabel(r.origen)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden lg:table-cell text-[10px]">
                      {r.citacion_razon ? RAZONES[r.citacion_razon] ?? r.citacion_razon : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — Registrar tutoría manual */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Registrar tutoría realizada</h2>
              <button onClick={() => { setShowModal(false); setModalErr(null) }} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>

            {modalOk && (
              <div className="text-xs px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-300">
                ✓ Tutoría registrada
              </div>
            )}
            {modalErr && (
              <div className="text-xs px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300">
                {modalErr}
              </div>
            )}

            <div className="space-y-3">
              {/* Student picker or manual */}
              <div>
                <label className="label text-xs">Estudiante del sistema <span className="text-gray-600">(opcional)</span></label>
                <select
                  value={mEstudiante}
                  onChange={e => onSelectEstudiante(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">— Ingresar manualmente —</option>
                  {estudiantes.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="label text-xs">Nombre completo *</label>
                  <input
                    type="text" className="input text-xs" value={mNombre}
                    onChange={e => setMNombre(e.target.value)}
                    placeholder="Apellidos Nombre"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-xs">Email</label>
                    <input type="email" className="input text-xs" value={mEmail} onChange={e => setMEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Carrera</label>
                    <input type="text" className="input text-xs" value={mCarrera} onChange={e => setMCarrera(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <label className="label text-xs">Curso *</label>
                <select value={mCurso} onChange={e => setMCurso(e.target.value)} className="input text-xs">
                  {cursos.map(c => (
                    <option key={c.id} value={c.id}>{c.asignatura}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Fecha *</label>
                  <input
                    type="date" className="input text-xs" value={mFecha}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setMFecha(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label text-xs">Hora inicio *</label>
                  <input type="time" className="input text-xs" value={mHoraI} onChange={e => setMHoraI(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Hora fin</label>
                  <input type="time" className="input text-xs" value={mHoraF} onChange={e => setMHoraF(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label text-xs">Resultado *</label>
                <select
                  value={mEstado}
                  onChange={e => setMEstado(e.target.value as 'asistio' | 'no_asistio' | 'cancelado')}
                  className="input text-xs"
                >
                  <option value="asistio">Asistió</option>
                  <option value="no_asistio">No asistió</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="label text-xs">Notas</label>
                <textarea
                  className="input text-xs min-h-[60px] resize-none" value={mNotas}
                  onChange={e => setMNotas(e.target.value)}
                  placeholder="Tema tratado, compromisos, observaciones..."
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => { setShowModal(false); setModalErr(null) }}
                className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="text-xs btn-primary disabled:opacity-40"
              >
                {saving ? 'Guardando...' : 'Guardar tutoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
