'use client'

import { useState } from 'react'

type AsistenciaItem = {
  id: string
  fecha: string
  estado: string | null
  atraso: boolean | null
  observacion_part?: string | null
  horas?: number | null
}

type ParticipacionItem = {
  fecha: string
  nivel?: number | null
  observacion?: string | null
}

interface Props {
  asistencia: AsistenciaItem[]
  participacion?: ParticipacionItem[]
  presentes: number
  atrasos: number
  ausentes: number
  totalSesiones: number
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function AsistenciaGrid({ asistencia, participacion = [], presentes, atrasos, ausentes, totalSesiones }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const partMap = new Map<string, ParticipacionItem>()
  for (const p of participacion) partMap.set(p.fecha, p)

  if (totalSesiones === 0) {
    return (
      <div className="card">
        <h2 className="font-semibold text-white mb-3">Historial de asistencia</h2>
        <p className="text-gray-500 text-sm">Sin registros de asistencia.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-visible">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white">Historial de asistencia</h2>
        <span className="text-xs text-gray-500">
          {presentes}P · {atrasos}At · {ausentes}Au de {totalSesiones}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" style={{ overflow: 'visible' }}>
        {asistencia.map((reg, idx) => {
          const part = partMap.get(reg.fecha)
          const isActive = activeId === reg.id
          const hasExtra = !!(reg.observacion_part || (part && (part.nivel != null || part.observacion)))
          // Flip tooltip to right side for the last few items to avoid right-edge overflow
          const flipLeft = idx % 10 > 6

          return (
            <div
              key={reg.id}
              className="relative"
              onMouseEnter={() => setActiveId(reg.id)}
              onMouseLeave={() => setActiveId(null)}
            >
              {/* Dot */}
              <div
                className={`w-7 h-7 rounded flex items-center justify-center text-xs cursor-default select-none relative
                  ${reg.estado === 'Presente'
                    ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800'
                    : reg.estado === 'Atraso'
                    ? 'bg-yellow-900/60 text-yellow-400 border border-yellow-800'
                    : 'bg-red-900/60 text-red-400 border border-red-800'}`}
              >
                {reg.estado === 'Presente' ? '●' : reg.estado === 'Atraso' ? '◑' : '○'}
                {/* Small indicator dot when there's extra info */}
                {hasExtra && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500 border border-gray-900" />
                )}
              </div>

              {/* Tooltip */}
              {isActive && (
                <div
                  className={`absolute bottom-full mb-2 z-[200]
                    bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 pointer-events-none
                    min-w-[170px] max-w-[230px]
                    ${flipLeft ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                >
                  {/* Arrow */}
                  <div className={`absolute -bottom-[7px] w-3 h-3
                    bg-gray-900 border-b border-r border-gray-700 rotate-45
                    ${flipLeft ? 'right-3' : 'left-1/2 -translate-x-1/2'}`}
                  />

                  {/* Fecha */}
                  <p className="text-xs font-semibold text-white capitalize leading-tight">
                    {formatFecha(reg.fecha)}
                  </p>

                  {/* Estado */}
                  <p className={`text-xs mt-1 font-medium ${
                    reg.estado === 'Presente' ? 'text-emerald-400'
                    : reg.estado === 'Atraso' ? 'text-yellow-400'
                    : 'text-red-400'
                  }`}>
                    {reg.estado ?? '—'}
                    {reg.atraso && reg.estado !== 'Atraso' && (
                      <span className="text-yellow-500 ml-1">· Atraso</span>
                    )}
                  </p>

                  {/* Horas */}
                  {reg.horas != null && reg.horas > 0 && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{reg.horas}h registradas</p>
                  )}

                  {/* Observación de asistencia */}
                  {reg.observacion_part && (
                    <p className="text-[11px] text-gray-400 mt-2 italic border-t border-gray-800 pt-2 leading-relaxed">
                      &ldquo;{reg.observacion_part}&rdquo;
                    </p>
                  )}

                  {/* Participación de esa sesión */}
                  {part && (
                    <div className="mt-2 pt-2 border-t border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Participación</span>
                        {part.nivel != null ? (
                          <>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(n => (
                                <div
                                  key={n}
                                  className={`w-3 h-3 rounded-sm ${n <= (part.nivel ?? 0) ? 'bg-brand-500' : 'bg-gray-700'}`}
                                />
                              ))}
                            </div>
                            <span className="text-[11px] text-brand-400 font-semibold">{part.nivel}/5</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                      {part.observacion && (
                        <p className="text-[11px] text-gray-400 mt-1 italic leading-relaxed">
                          &ldquo;{part.observacion}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="text-emerald-400">●</span> Presente
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="text-yellow-400">◑</span> Atraso
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="text-red-400">○</span> Ausente
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="inline-block w-2 h-2 rounded-full bg-brand-500" /> Con notas
        </span>
      </div>
    </div>
  )
}
