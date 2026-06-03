'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { reconocerInasistencia } from '@/lib/actions/tutorias'

const RAZONES = [
  'Tuve un imprevisto',
  'Se me olvidó',
  'Problema de salud',
  'Problema técnico o de conexión',
  'Otro',
]

type Props = {
  reservaId: number
  fechaStr: string
  horaStr: string | null
  profesorNombre: string | null
  cursoNombre: string | null
}

export function InasistenciaForm({ reservaId, fechaStr, horaStr, profesorNombre, cursoNombre }: Props) {
  const [razon, setRazon] = useState('')
  const [detalle, setDetalle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!razon) {
      setError('Selecciona una razón para continuar.')
      return
    }
    const justificacion = razon === 'Otro' && detalle.trim()
      ? `Otro: ${detalle.trim()}`
      : razon
    startTransition(async () => {
      const res = await reconocerInasistencia(reservaId, justificacion)
      if (res.error) {
        setError(res.error)
      } else {
        router.push('/student')
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-2 py-8">
      <div className="w-full max-w-md space-y-6">

        {/* Icon + header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-900/30 border border-amber-700/50 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tutoría sin asistencia registrada</h1>
            <p className="text-sm text-gray-400 mt-1">
              Tenías una sesión de tutoría que no fue marcada como asistida.
            </p>
          </div>
        </div>

        {/* Reservation details */}
        <div className="card space-y-2.5 text-sm">
          <div className="flex gap-3">
            <span className="text-gray-500 w-24 shrink-0">Fecha</span>
            <span className="text-white capitalize">{fechaStr}</span>
          </div>
          {horaStr && (
            <div className="flex gap-3">
              <span className="text-gray-500 w-24 shrink-0">Hora</span>
              <span className="text-white">{horaStr}</span>
            </div>
          )}
          {profesorNombre && (
            <div className="flex gap-3">
              <span className="text-gray-500 w-24 shrink-0">Profesor</span>
              <span className="text-white">{profesorNombre}</span>
            </div>
          )}
          {cursoNombre && (
            <div className="flex gap-3">
              <span className="text-gray-500 w-24 shrink-0">Asignatura</span>
              <span className="text-white">{cursoNombre}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">¿Qué pasó con esta tutoría?</p>
            <div className="space-y-2">
              {RAZONES.map(r => (
                <label
                  key={r}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    razon === r
                      ? 'border-brand-600 bg-brand-900/20 text-white'
                      : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="razon"
                    value={r}
                    checked={razon === r}
                    onChange={() => { setRazon(r); setError(null) }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                    razon === r ? 'border-brand-400 bg-brand-400' : 'border-gray-600'
                  }`} />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {razon === 'Otro' && (
            <textarea
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
              placeholder="Cuéntanos brevemente…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-600 focus:outline-none resize-none"
            />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full btn-primary py-3 text-sm font-medium disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Registrar y continuar'}
          </button>
        </form>

        {/* Link to reschedule */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500 mb-3">¿Quieres coordinar otra sesión con tu profesor?</p>
          <Link
            href="/student/tutorias"
            className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ver agenda de tutorías
          </Link>
        </div>

      </div>
    </div>
  )
}
