'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { silenciarAlerta, restaurarAlerta } from '@/lib/actions/cursos'

interface Props {
  cursoId: string
  respondieron: number
  total: number
  silenciado: boolean
}

export function EncuestaBanner({ cursoId, respondieron, total, silenciado }: Props) {
  const [pending, startTransition] = useTransition()

  if (silenciado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/40 text-xs text-gray-500">
        <span>📋 Alerta de encuesta silenciada</span>
        <span className="text-gray-700">·</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => restaurarAlerta(cursoId, 'encuesta_parcial').then(() => {}))}
          className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Mostrar de nuevo →
        </button>
      </div>
    )
  }

  return (
    <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
      <span className="text-amber-400 text-lg mt-0.5">📋</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 font-medium text-sm">Encuesta de progreso activa esta semana</p>
        <p className="text-amber-400/70 text-xs mt-0.5">
          {respondieron} de {total} estudiantes han respondido
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          href={`/dashboard/cursos/${cursoId}/encuesta-parcial`}
          className="text-amber-400 text-xs font-medium hover:text-amber-300 whitespace-nowrap"
        >
          Ver resultados →
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => silenciarAlerta(cursoId, 'encuesta_parcial').then(() => {}))}
          className="text-amber-600 hover:text-amber-400 transition-colors text-base leading-none disabled:opacity-50"
          title="Silenciar esta alerta"
        >
          ×
        </button>
      </div>
    </div>
  )
}
