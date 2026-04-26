'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { detenerClase, finalizarClase } from '@/lib/actions/bitacora'

type Props = {
  bitacoraId: string
  cursoNombre: string
  cursoCodigo: string
  tema: string
  horaInicioReal: string
}

function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ClaseEnProgresoBar({ bitacoraId, cursoNombre, cursoCodigo, tema, horaInicioReal }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [elapsed, setElapsed] = useState(0)
  const [confirmar, setConfirmar] = useState<'detener' | 'finalizar' | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const start = new Date(horaInicioReal).getTime()
    setElapsed(Math.floor((Date.now() - start) / 1000))
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [horaInicioReal])

  async function handleDetener() {
    setCargando(true)
    await detenerClase(bitacoraId)
    router.refresh()
  }

  async function handleFinalizar() {
    setCargando(true)
    startTransition(() => {})
    await finalizarClase(bitacoraId)
    router.push('/dashboard/agenda')
  }

  const esAlerta = elapsed > 10800

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm border-b ${
      esAlerta
        ? 'bg-amber-950/60 border-amber-700/50'
        : 'bg-red-950/60 border-red-800/50'
    }`}>
      {/* Info */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className={`font-semibold truncate ${esAlerta ? 'text-amber-300' : 'text-red-300'}`}>
          Clase en progreso
        </span>
        <span className="text-gray-400 truncate hidden sm:inline">
          {cursoNombre}
          {cursoCodigo && <span className="text-gray-600 ml-1">· {cursoCodigo}</span>}
          {tema && <span className="text-gray-500 ml-1 hidden md:inline">· {tema}</span>}
        </span>
        <span className={`font-mono font-bold flex-shrink-0 ${esAlerta ? 'text-amber-400' : 'text-white'}`}>
          {formatElapsed(elapsed)}
          {esAlerta && <span className="text-amber-500 ml-1 text-xs">⚠</span>}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {confirmar === 'detener' ? (
          <>
            <span className="text-xs text-gray-400 hidden sm:inline">¿Detener sin guardar?</span>
            <button
              onClick={handleDetener}
              disabled={cargando}
              className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              {cargando ? '…' : 'Sí, detener'}
            </button>
            <button onClick={() => setConfirmar(null)} className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1">
              No
            </button>
          </>
        ) : confirmar === 'finalizar' ? (
          <>
            <span className="text-xs text-gray-400 hidden sm:inline">¿Finalizar y guardar?</span>
            <button
              onClick={handleFinalizar}
              disabled={cargando}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              {cargando ? '…' : 'Sí, finalizar'}
            </button>
            <button onClick={() => setConfirmar(null)} className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1">
              No
            </button>
          </>
        ) : (
          <>
            <Link
              href={`/dashboard/modo-clase/${bitacoraId}`}
              className="text-xs text-white bg-brand-600 hover:bg-brand-500 px-3 py-1 rounded-lg transition-colors font-medium"
            >
              Ir a clase
            </Link>
            <button
              onClick={() => setConfirmar('detener')}
              className="text-xs text-orange-400 border border-orange-800 hover:bg-orange-900/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              Detener
            </button>
            <button
              onClick={() => setConfirmar('finalizar')}
              className="text-xs text-red-400 border border-red-800 hover:bg-red-900/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              Finalizar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
