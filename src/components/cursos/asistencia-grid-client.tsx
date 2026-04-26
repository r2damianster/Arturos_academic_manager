'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { buildMoodleCSV, downloadCSV } from '@/lib/moodle-csv'

type Estudiante = { id: string; nombre: string; email: string }
type Registro = { estado: string }
type MapaAsistencia = Record<string, Record<string, Registro>>
type HorasPorDia = Record<string, number>

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function fmtCorto(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function getHorasFecha(fecha: string, horasPorDia: HorasPorDia): number {
  const dow = new Date(fecha + 'T12:00:00').getDay()
  const diaNorm = normalize(DIAS[dow])
  return Object.entries(horasPorDia).find(([d]) => normalize(d) === diaNorm)?.[1] ?? 1
}

type Props = {
  cursoCodigo: string
  cursoId: string
  estudiantes: Estudiante[]
  fechas: string[]
  mapaAsistencia: MapaAsistencia
  horasPorDia: HorasPorDia
}

export function AsistenciaGridClient({
  cursoCodigo, cursoId, estudiantes, fechas, mapaAsistencia, horasPorDia,
}: Props) {
  const [pageSize, setPageSize] = useState(6)
  const [windowStart, setWindowStart] = useState(() => Math.max(0, fechas.length - 6))
  const [moodleOpen, setMoodleOpen] = useState(false)
  const [moodleFecha, setMoodleFecha] = useState<string>('')

  // Ajustar pageSize según ancho de pantalla
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      const size = w < 640 ? 3 : w < 1024 ? 5 : 6
      setPageSize(size)
      setWindowStart(prev => Math.min(prev, Math.max(0, fechas.length - size)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [fechas.length])

  const visibleFechas = fechas.slice(windowStart, windowStart + pageSize)
  const canPrev = windowStart > 0
  const canNext = windowStart + pageSize < fechas.length
  const totalPages = Math.ceil(fechas.length / pageSize)
  const currentPage = Math.floor(windowStart / pageSize) + 1

  function prev() { setWindowStart(i => Math.max(0, i - pageSize)) }
  function next() { setWindowStart(i => Math.min(fechas.length - pageSize, i + pageSize)) }

  const rangeLabel = visibleFechas.length > 0
    ? `${fmtCorto(visibleFechas[0])} – ${fmtCorto(visibleFechas[visibleFechas.length - 1])}`
    : ''

  return (
    <div className="space-y-4">
      {/* Controles de navegación */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={!canPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ‹
          </button>
          <span className="text-sm text-gray-400 min-w-[140px] text-center">
            {rangeLabel}
          </span>
          <button
            onClick={next}
            disabled={!canNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ›
          </button>
          <span className="text-xs text-gray-600">
            {currentPage}/{totalPages}
          </span>
        </div>

        {/* Botón Exportar Moodle */}
        {fechas.length > 0 && (
          <button
            onClick={() => setMoodleOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
          >
            <span>⬇</span>
            <span>Exportar para Moodle</span>
            <span className="text-gray-600">{moodleOpen ? '▲' : '▼'}</span>
          </button>
        )}
      </div>

      {/* Panel Moodle — selector de fecha primero, luego descarga */}
      {moodleOpen && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-700 bg-gray-800/60 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-600 bg-brand-600/10 text-brand-400 text-xs font-medium flex-shrink-0 self-center">
            Moodle <span className="text-brand-500">CSV</span>
          </div>

          <select
            value={moodleFecha}
            onChange={e => setMoodleFecha(e.target.value)}
            className="input text-sm py-1.5 flex-1 min-w-[160px]"
          >
            <option value="">Seleccionar sesión…</option>
            {[...fechas].reverse().map(f => (
              <option key={f} value={f}>
                {new Date(f + 'T12:00:00').toLocaleDateString('es-ES', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </option>
            ))}
          </select>

          {moodleFecha && (() => {
            const horas = getHorasFecha(moodleFecha, horasPorDia)
            const attendanceMap: Record<string, string> = {}
            for (const est of estudiantes) {
              attendanceMap[est.id] = mapaAsistencia[est.id]?.[moodleFecha]?.estado ?? 'Ausente'
            }
            return (
              <div className="flex gap-1.5 flex-wrap self-center">
                {Array.from({ length: horas }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const csv = buildMoodleCSV(estudiantes, attendanceMap, i)
                      downloadCSV(csv, `asistencia_${cursoCodigo}_${moodleFecha}_hora${i + 1}.csv`)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors"
                  >
                    ⬇ Hora {i + 1}
                    {horas > 1 && (
                      <span className="text-gray-500 ml-0.5">{i === 0 ? '·A' : '·P'}</span>
                    )}
                  </button>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Tabla de asistencia */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-gray-900 min-w-[160px]">
                  Estudiante
                </th>
                {visibleFechas.map(fecha => (
                  <th key={fecha} className="py-3 px-2 text-gray-400 font-medium text-center min-w-[56px]">
                    <div className="text-xs leading-tight">
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-[10px] text-gray-600 capitalize">
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-gray-400 font-medium text-center sticky right-0 bg-gray-900 min-w-[56px]">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {estudiantes.map(est => {
                const regEst = mapaAsistencia[est.id] ?? {}
                const sesionesConReg = fechas.filter(f => regEst[f]).length
                const presentesEst = fechas.filter(f => regEst[f]?.estado === 'Presente').length
                const pctEst = sesionesConReg > 0 ? Math.round((presentesEst / sesionesConReg) * 100) : null

                return (
                  <tr key={est.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="py-3 px-4 sticky left-0 bg-gray-900 group-hover:bg-gray-800/50">
                      <Link
                        href={`/dashboard/estudiantes/${est.id}`}
                        className="font-medium text-gray-200 hover:text-white block truncate max-w-[140px]"
                      >
                        {est.nombre}
                      </Link>
                      <p className="text-xs text-gray-500 truncate max-w-[140px]">{est.email}</p>
                    </td>
                    {visibleFechas.map(fecha => {
                      const reg = regEst[fecha]
                      return (
                        <td key={fecha} className="py-3 px-2 text-center">
                          {!reg ? (
                            <span className="text-gray-700">—</span>
                          ) : reg.estado === 'Presente' ? (
                            <span title="Presente" className="text-emerald-500 text-base">●</span>
                          ) : reg.estado === 'Atraso' ? (
                            <span title="Atraso" className="text-yellow-500 text-base">◑</span>
                          ) : (
                            <span title="Ausente" className="text-red-500 text-base">○</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-3 px-4 text-center sticky right-0 bg-gray-900 group-hover:bg-gray-800/50">
                      {pctEst === null ? (
                        <span className="text-gray-600 text-xs">—</span>
                      ) : (
                        <span className={`font-mono text-sm font-medium ${
                          pctEst >= 80 ? 'text-emerald-400' :
                          pctEst >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {pctEst}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-t border-gray-800">
          <div className="flex gap-4 text-xs text-gray-500">
            <span><span className="text-emerald-500">●</span> Presente</span>
            <span><span className="text-yellow-500">◑</span> Atraso</span>
            <span><span className="text-red-500">○</span> Ausente</span>
            <span><span className="text-gray-700">—</span> Sin registro</span>
          </div>
          <Link
            href={`/dashboard/cursos/${cursoId}/pase-lista`}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            Ir a pase de lista →
          </Link>
        </div>
      </div>
    </div>
  )
}
