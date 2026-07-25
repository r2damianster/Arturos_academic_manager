'use client'

import { useState } from 'react'

export function KeepalivePanel() {
  const [estado, setEstado] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function handlePing() {
    setEstado('loading')
    setMensaje(null)

    try {
      const response = await fetch('/api/keepalive', { cache: 'no-store' })
      const data = await response.json()

      if (response.ok && data.ok) {
        setEstado('success')
        setMensaje('Keepalive exitoso: la base de datos respondió correctamente.')
      } else {
        setEstado('error')
        setMensaje(data.error ?? 'No se pudo contactar a Supabase.')
      }
    } catch (error) {
      setEstado('error')
      setMensaje(error instanceof Error ? error.message : 'Error de red al ejecutar keepalive.')
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Keepalive de Supabase</h2>
        <p className="text-sm text-gray-400">
          Ejecuta una consulta ligera para mantener la conexión activa y evitar que la base de datos se duerma por inactividad.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handlePing}
          className="btn-primary w-full sm:w-auto"
          disabled={estado === 'loading'}
        >
          {estado === 'loading' ? 'Verificando...' : 'Ejecutar keepalive'}
        </button>
        <div className="text-sm">
          {estado === 'success' && (
            <p className="text-emerald-400">{mensaje}</p>
          )}
          {estado === 'error' && (
            <p className="text-rose-400">{mensaje}</p>
          )}
          {estado === 'idle' && (
            <p className="text-gray-400">Pulsa el botón para probar la conexión a la base de datos.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-400">
        Consejo: si necesitas mantener el proyecto despertado de forma periódica, usa un cron externo que visite{' '}
        <code className="rounded bg-gray-950 px-1 py-0.5">/api/keepalive</code> cada 5-10 minutos.
      </div>
    </div>
  )
}
