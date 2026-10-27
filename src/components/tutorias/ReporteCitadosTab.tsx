'use client'

import { useState, useTransition } from 'react'
import { citarEstudiante } from '@/lib/actions/citaciones'

interface CitacionReporte {
  id: string
  fecha_citacion: string
  razon: string
  detalle_razon: string | null
  estado: string
  updated_at?: string | null
  cursos: { id: string; asignatura: string; institucion: string | null } | null
  estudiantes: { id: string; nombre: string; email: string } | null
  reservas?: { fecha: string } | null
}

const RESULTADO: Record<string, { label: string; cls: string }> = {
  asistida:    { label: 'Asistió',    cls: 'text-emerald-400' },
  cumplida:    { label: 'Asistió',    cls: 'text-emerald-400' },
  mejorado:    { label: 'Asistió',    cls: 'text-emerald-400' },
  no_asistida: { label: 'No asistió', cls: 'text-red-400' },
  pendiente:   { label: 'Pendiente',  cls: 'text-amber-400' },
  agendada:    { label: 'Agendada',   cls: 'text-blue-400' },
}

const ESTADOS_ASISTIO = new Set(['asistida', 'cumplida', 'mejorado'])

function downloadCsv(rows: CitacionReporte[]) {
  const header = ['Curso', 'Estudiante', 'Motivo', 'Fecha citación', 'Resultado', 'Fecha tutoría']
  const lines = rows.map(row => [
    row.cursos?.asignatura ?? '',
    row.estudiantes?.nombre ?? '',
    row.razon,
    row.fecha_citacion,
    RESULTADO[row.estado]?.label ?? row.estado,
    row.reservas?.fecha ?? '',
  ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'reporte-citados.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ReporteCitadosTab({ citaciones }: { citaciones: CitacionReporte[] }) {
  const [courseFilter, setCourseFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const [recitedIds, setRecitedIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const courses = Array.from(
    new Map(citaciones.filter(c => c.cursos).map(c => [c.cursos!.id, c.cursos!.asignatura])).entries()
  )

  const filtered = citaciones.filter(citation => {
    if (courseFilter && citation.cursos?.id !== courseFilter) return false
    if (monthFilter && !citation.fecha_citacion.startsWith(monthFilter)) return false
    if (resultFilter === 'asistio' && !ESTADOS_ASISTIO.has(citation.estado)) return false
    if (resultFilter === 'no_asistio' && citation.estado !== 'no_asistida') return false
    if (resultFilter === 'pendiente' && citation.estado !== 'pendiente' && citation.estado !== 'agendada') return false
    return true
  })

  const attendedCount = filtered.filter(citation => ESTADOS_ASISTIO.has(citation.estado)).length
  const missedCount = filtered.filter(citation => citation.estado === 'no_asistida').length
  const waitingCount = filtered.length - attendedCount - missedCount
  const resolvedCount = attendedCount + missedCount
  const responseRate = resolvedCount > 0 ? Math.round((attendedCount / resolvedCount) * 100) : null

  function handleRecite(citation: CitacionReporte) {
    if (!citation.cursos || !citation.estudiantes) return
    setErrorMessage(null)
    startTransition(async () => {
      const response = await citarEstudiante({
        cursoId: citation.cursos!.id,
        estudianteId: citation.estudiantes!.id,
        razon: citation.razon,
        detalleRazon: citation.detalle_razon ?? undefined,
      })
      if (response?.error) { setErrorMessage(response.error); return }
      setRecitedIds(previous => new Set(previous).add(citation.id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Citados" value={filtered.length} />
        <Stat label="Asistieron" value={attendedCount} tone="text-emerald-400" />
        <Stat label="No asistieron" value={missedCount} tone="text-red-400" />
        <Stat label="Tasa de respuesta" value={responseRate === null ? '—' : `${responseRate}%`} sub={waitingCount > 0 ? `${waitingCount} sin resolver` : undefined} />
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={courseFilter} onChange={event => setCourseFilter(event.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los cursos</option>
            {courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <input type="month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} className="input text-xs py-1.5" title="Mes de citación" />
          <select value={resultFilter} onChange={event => setResultFilter(event.target.value)} className="input text-xs py-1.5">
            <option value="">Todos los resultados</option>
            <option value="asistio">Asistió</option>
            <option value="no_asistio">No asistió</option>
            <option value="pendiente">Pendiente / agendada</option>
          </select>
          <button onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0} className="text-xs border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-40">
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}

      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">No hay citados con los filtros aplicados.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-left">
                <th className="py-2 px-3 font-medium">Estudiante</th>
                <th className="py-2 px-3 font-medium hidden sm:table-cell">Curso</th>
                <th className="py-2 px-3 font-medium">Citado</th>
                <th className="py-2 px-3 font-medium">Resultado</th>
                <th className="py-2 px-3 font-medium hidden md:table-cell">Tutoría</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(citation => {
                const result = RESULTADO[citation.estado] ?? { label: citation.estado, cls: 'text-gray-400' }
                const wasRecited = recitedIds.has(citation.id)
                return (
                  <tr key={citation.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-200">{citation.estudiantes?.nombre ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-400 hidden sm:table-cell">{citation.cursos?.asignatura ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-400">{citation.fecha_citacion}</td>
                    <td className={`py-2 px-3 font-medium ${result.cls}`}>{result.label}</td>
                    <td className="py-2 px-3 text-gray-500 hidden md:table-cell">{citation.reservas?.fecha ?? '—'}</td>
                    <td className="py-2 px-3 text-right">
                      {citation.estado === 'no_asistida' && (
                        wasRecited
                          ? <span className="text-[10px] text-gray-500">Re-citado</span>
                          : <button onClick={() => handleRecite(citation)} disabled={isPending} className="text-[10px] text-amber-400 border border-amber-700/40 px-1.5 rounded hover:bg-amber-900/20 disabled:opacity-50">↻ Re-citar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'text-white', sub }: { label: string; value: number | string; tone?: string; sub?: string }) {
  return (
    <div className="card py-3">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
    </div>
  )
}
