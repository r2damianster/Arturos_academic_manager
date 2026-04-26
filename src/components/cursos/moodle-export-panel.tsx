'use client'

import { useState } from 'react'
import { buildMoodleCSV, downloadCSV } from '@/lib/moodle-csv'

type Estudiante = { id: string; nombre: string; email: string }
type MapaAsistencia = Record<string, Record<string, { estado: string }>>
type HorasPorDia = Record<string, number>  // dia_semana normalizado → horas

type Props = {
  cursoCodigo: string
  estudiantes: Estudiante[]
  fechas: string[]
  mapaAsistencia: MapaAsistencia
  horasPorDia: HorasPorDia
}

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function fmtFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function MoodleExportPanel({ cursoCodigo, estudiantes, fechas, mapaAsistencia, horasPorDia }: Props) {
  const [abierto, setAbierto] = useState(false)

  function getHorasFecha(fecha: string): number {
    const dow = new Date(fecha + 'T12:00:00').getDay()
    const diaNorm = normalize(DIAS[dow])
    return Object.entries(horasPorDia).find(([d]) => normalize(d) === diaNorm)?.[1] ?? 1
  }

  function getAttendanceMap(fecha: string): Record<string, string> {
    const map: Record<string, string> = {}
    for (const est of estudiantes) {
      map[est.id] = mapaAsistencia[est.id]?.[fecha]?.estado ?? 'Ausente'
    }
    return map
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
      >
        <span>⬇</span>
        <span>Exportar para Moodle</span>
        <span className="ml-auto text-gray-500">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Exportar asistencia
            </p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand-600 bg-brand-600/10 text-brand-400 text-xs font-medium">
              Moodle <span className="text-brand-500">CSV</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Un archivo por sesión y por hora. Columnas: email · estado (P = Presente, A = Ausente).
            Atrasos cuentan como Ausente en la primera hora y Presente en las siguientes.
          </p>

          <div className="divide-y divide-gray-800">
            {fechas.map(fecha => {
              const horas = getHorasFecha(fecha)
              const attendance = getAttendanceMap(fecha)
              return (
                <div key={fecha} className="py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-300 min-w-[120px]">{fmtFecha(fecha)}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {Array.from({ length: horas }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const csv = buildMoodleCSV(estudiantes, attendance, i)
                          downloadCSV(csv, `asistencia_${cursoCodigo}_${fecha}_hora${i + 1}.csv`)
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
                      >
                        ⬇ Hora {i + 1}
                      </button>
                    ))}
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
