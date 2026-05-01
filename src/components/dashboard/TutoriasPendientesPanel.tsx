'use client'

import { useState, useTransition } from 'react'
import { marcarAsistenciaReserva } from '@/lib/actions/tutorias'

interface Reserva {
  id: number
  fecha: string
  estudiante_nombre: string
  estado: string
  asistio: boolean | null
  hora_inicio: string
  hora_fin: string
}

interface Props {
  reservas: Reserva[]
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtFecha(s: string) {
  const d = new Date(s + 'T12:00:00')
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

export function TutoriasPendientesPanel({ reservas }: Props) {
  const [asistioMap, setAsistioMap] = useState<Record<number, boolean | null>>({})
  const [, startTransition] = useTransition()

  function handleAsistencia(id: number, asistio: boolean) {
    setAsistioMap(prev => ({ ...prev, [id]: asistio }))
    startTransition(async () => {
      const res = await marcarAsistenciaReserva(id, asistio)
      if (res?.error) setAsistioMap(prev => ({ ...prev, [id]: undefined as unknown as boolean | null }))
    })
  }

  const pendientes = reservas.filter(r => {
    const current = r.id in asistioMap ? asistioMap[r.id] : r.asistio
    return current === null || current === undefined
  })

  if (pendientes.length === 0) return null

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-base">⏳</span>
        <h3 className="text-sm font-semibold text-white">
          Tutorías pasadas sin confirmar
          <span className="ml-2 text-xs font-normal text-amber-400">({pendientes.length})</span>
        </h3>
      </div>

      <div className="space-y-2">
        {pendientes.map(r => {
          const current = r.id in asistioMap ? asistioMap[r.id] : r.asistio
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 font-medium truncate">{r.estudiante_nombre}</p>
                <p className="text-xs text-gray-500">
                  {fmtFecha(r.fecha)} · {r.hora_inicio.slice(0,5)}–{r.hora_fin.slice(0,5)}
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleAsistencia(r.id, true)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    current === true
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-emerald-900/50 hover:text-emerald-400 border border-gray-700'
                  }`}
                >
                  ✓ Asistió
                </button>
                <button
                  type="button"
                  onClick={() => handleAsistencia(r.id, false)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    current === false
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-red-900/50 hover:text-red-400 border border-gray-700'
                  }`}
                >
                  ✗ No asistió
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
