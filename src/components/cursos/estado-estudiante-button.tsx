'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setEstadoEstudiante } from '@/lib/actions/estudiantes'

interface Props {
  estudianteId: string
  cursoId: string
  currentEstado: 'activo' | 'retirado' | string
}

export function EstadoEstudianteButton({ estudianteId, cursoId, currentEstado }: Props) {
  const [estado, setEstado] = useState<'activo' | 'retirado'>(currentEstado === 'retirado' ? 'retirado' : 'activo')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const router = useRouter()
  const nextEstado = estado === 'activo' ? 'retirado' : 'activo'
  const label = estado === 'activo' ? 'Retirar' : 'Reintegrar'
  const intentClass = estado === 'activo'
    ? 'bg-red-600 text-white hover:bg-red-500'
    : 'bg-emerald-600 text-white hover:bg-emerald-500'

  const handleClick = () => {
    setError(null)
    setEstado(nextEstado)
    startTransition(async () => {
      const result = await setEstadoEstudiante(estudianteId, nextEstado, cursoId)
      if (result?.error) {
        setEstado(estado)
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-1 text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`text-xs font-semibold px-3 py-1 rounded-full transition ${intentClass} disabled:opacity-50`}
      >
        {label}
      </button>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
