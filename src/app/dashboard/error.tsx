'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-semibold text-white">Ocurrió un error al cargar el panel</h2>
      <p className="text-gray-400 text-sm max-w-md">
        {error.message || 'Error inesperado. Por favor intenta de nuevo.'}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-600 font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="btn-primary mt-2"
      >
        Reintentar
      </button>
    </div>
  )
}
