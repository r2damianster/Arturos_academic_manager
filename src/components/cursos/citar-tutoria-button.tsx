'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setTutoria } from '@/lib/actions/estudiantes'

interface Props {
  estudianteId: string
  cursoId: string
  currentTutoria: boolean | null
}

export function CitarTutoriaButton({ estudianteId, cursoId, currentTutoria }: Props) {
  const [citado, setCitado] = useState(!!currentTutoria)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    setError(null)
    const next = !citado
    setCitado(next)
    startTransition(async () => {
      const result = await setTutoria(estudianteId, next)
      if (result?.error) {
        setCitado(citado)
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
        className={`text-xs font-semibold px-3 py-1 rounded-full transition disabled:opacity-50 ${
          citado
            ? 'bg-teal-700 text-white hover:bg-teal-600'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {citado ? 'Citado ✓' : 'Citar'}
      </button>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
