'use client'

import { useState } from 'react'

export interface ParticipacionRecord {
  id: string
  estudiante_id: string
  fecha: string
  semana: string | null
  nivel: number | null
  observacion: string | null
}

interface Estudiante {
  id: string
  nombre: string
}

interface Props {
  estudiantes: Estudiante[]
  registros: ParticipacionRecord[]
}

const NIVEL_STYLE: Record<number, string> = {
  1: 'bg-red-900/60 text-red-300 border border-red-800/60',
  2: 'bg-orange-900/60 text-orange-300 border border-orange-800/60',
  3: 'bg-yellow-900/60 text-yellow-300 border border-yellow-800/60',
  4: 'bg-teal-900/60 text-teal-300 border border-teal-800/60',
  5: 'bg-emerald-900/60 text-emerald-300 border border-emerald-800/60',
}

const NIVEL_DOT: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-teal-500',
  5: 'bg-emerald-500',
}

function formatFecha(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function promedio(nums: (number | null)[]) {
  const vals = nums.filter((n): n is number => n !== null)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

const WINDOW = 7 // fechas visibles a la vez

export function ParticipacionGrid({ estudiantes, registros }: Props) {
  const [windowStart, setWindowStart] = useState(0)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  // Fechas únicas ordenadas
  const fechas = Array.from(new Set(registros.map(r => r.fecha))).sort()
  const totalVentanas = Math.max(1, Math.ceil(fechas.length / WINDOW))
  // Arrancar mostrando las más recientes
  const [page, setPage] = useState(() => Math.max(0, Math.ceil(fechas.length / WINDOW) - 1))
  const fechasVisibles = fechas.slice(page * WINDOW, page * WINDOW + WINDOW)

  // Mapa: [estudiante_id][fecha] → registros
  const mapa: Record<string, Record<string, ParticipacionRecord[]>> = {}
  for (const r of registros) {
    if (!mapa[r.estudiante_id]) mapa[r.estudiante_id] = {}
    if (!mapa[r.estudiante_id][r.fecha]) mapa[r.estudiante_id][r.fecha] = []
    mapa[r.estudiante_id][r.fecha].push(r)
  }

  // Observaciones con contenido (todas las fechas)
  const obsConTexto = registros
    .filter(r => r.observacion?.trim())
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  if (registros.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 text-sm">No hay registros de participación en este curso.</p>
        <p className="text-gray-600 text-xs mt-1">Los registros se crean desde Modo Clase.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-xs text-gray-500">
            {fechas.length} {fechas.length === 1 ? 'sesión registrada' : 'sesiones registradas'}
            {' · '}
            {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
          </div>
          {totalVentanas > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{page + 1}/{totalVentanas}</span>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 text-xs"
              >‹</button>
              <button
                onClick={() => setPage(p => Math.min(totalVentanas - 1, p + 1))}
                disabled={page === totalVentanas - 1}
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 text-xs"
              >›</button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium min-w-[160px] sticky left-0 bg-gray-900/95 z-10">
                  Estudiante
                </th>
                {fechasVisibles.map(f => (
                  <th key={f} className="text-center px-2 py-2.5 text-gray-500 font-medium min-w-[52px]">
                    {formatFecha(f)}
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 text-gray-500 font-medium min-w-[64px]">Prom.</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map(est => {
                const allNiveles = registros.filter(r => r.estudiante_id === est.id).map(r => r.nivel)
                const prom = promedio(allNiveles)
                const isExpanded = expandedStudent === est.id
                const hasObs = registros.some(r => r.estudiante_id === est.id && r.observacion?.trim())

                return (
                  <>
                    <tr
                      key={est.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors cursor-pointer"
                      onClick={() => setExpandedStudent(isExpanded ? null : est.id)}
                    >
                      <td className="px-4 py-2.5 sticky left-0 bg-gray-900/95 z-10">
                        <div className="flex items-center gap-1.5">
                          {hasObs && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" title="Tiene observaciones" />}
                          <span className="text-gray-300 font-medium truncate max-w-[140px]">
                            {est.nombre.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <span className="text-gray-600 ml-auto">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </td>
                      {fechasVisibles.map(f => {
                        const recs = mapa[est.id]?.[f] ?? []
                        if (recs.length === 0) {
                          return <td key={f} className="px-2 py-2.5 text-center">
                            <span className="text-gray-700">—</span>
                          </td>
                        }
                        return (
                          <td key={f} className="px-2 py-2.5 text-center">
                            <div className="flex flex-col gap-0.5 items-center">
                              {recs.map(r => (
                                <span
                                  key={r.id}
                                  className={`inline-flex items-center justify-center w-7 h-6 rounded text-[11px] font-bold ${r.nivel ? NIVEL_STYLE[r.nivel] : 'bg-gray-800 text-gray-500'}`}
                                  title={r.observacion ?? undefined}
                                >
                                  {r.nivel ?? '?'}
                                  {r.observacion?.trim() && <span className="ml-0.5 text-[8px] opacity-70">💬</span>}
                                </span>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 text-center">
                        {prom !== null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-bold ${NIVEL_STYLE[Math.round(prom)]}`}
                              style={{ padding: '1px 5px', borderRadius: 4 }}>
                              {prom}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${est.id}-detail`} className="border-b border-gray-800 bg-gray-900/40">
                        <td colSpan={fechasVisibles.length + 2} className="px-4 py-3">
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">
                              Historial completo — {est.nombre}
                            </p>
                            {registros
                              .filter(r => r.estudiante_id === est.id)
                              .sort((a, b) => b.fecha.localeCompare(a.fecha))
                              .map(r => (
                                <div key={r.id} className="flex items-start gap-3 text-xs">
                                  <span className="text-gray-500 flex-shrink-0 w-14">{formatFecha(r.fecha)}</span>
                                  {r.nivel && (
                                    <span className={`px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${NIVEL_STYLE[r.nivel]}`}>
                                      {r.nivel}
                                    </span>
                                  )}
                                  {r.semana && <span className="text-gray-600 flex-shrink-0">{r.semana}</span>}
                                  {r.observacion?.trim()
                                    ? <span className="text-gray-300">{r.observacion}</span>
                                    : <span className="text-gray-700 italic">Sin observación</span>
                                  }
                                </div>
                              ))
                            }
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de observaciones */}
      {obsConTexto.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400">
            Observaciones registradas ({obsConTexto.length})
          </h3>
          <div className="space-y-2">
            {obsConTexto.map(r => {
              const est = estudiantes.find(e => e.id === r.estudiante_id)
              return (
                <div key={r.id} className="card py-2.5 px-4 flex items-start gap-3">
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${r.nivel ? NIVEL_DOT[r.nivel] : 'bg-gray-700'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-300">
                        {est?.nombre.split(' ').slice(0, 2).join(' ') ?? '—'}
                      </span>
                      <span className="text-[10px] text-gray-600">{formatFecha(r.fecha)}</span>
                      {r.nivel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${NIVEL_STYLE[r.nivel]}`}>
                          Nv.{r.nivel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{r.observacion}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
