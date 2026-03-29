'use client'

import { useState, useTransition } from 'react'
import { cambiarRolProfesor } from '@/lib/actions/admin'

interface Profesor {
  id: string
  nombre: string
  email: string
  rol: string
  institucion: string | null
  created_at: string
}

export function ProfesoresManager({ profesores, currentUserId }: { profesores: Profesor[], currentUserId: string }) {
  const [lista, setLista] = useState(profesores)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggleRol(prof: Profesor) {
    if (prof.id === currentUserId) return // no puede cambiarse a sí mismo
    const nuevoRol = prof.rol === 'admin' ? 'profesor' : 'admin'
    setError(null)
    startTransition(async () => {
      const res = await cambiarRolProfesor(prof.id, nuevoRol)
      if (res.error) { setError(res.error); return }
      setLista(prev => prev.map(p => p.id === prof.id ? { ...p, rol: nuevoRol } : p))
    })
  }

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Profesores registrados</h2>
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
      )}
      <div className="divide-y divide-gray-800">
        {lista.map(prof => (
          <div key={prof.id} className="flex items-center justify-between py-3 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                  {prof.nombre.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {prof.nombre}
                    {prof.id === currentUserId && <span className="ml-2 text-xs text-gray-500">(tú)</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{prof.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                prof.rol === 'admin'
                  ? 'text-purple-400 bg-purple-900/30 border-purple-800'
                  : 'text-blue-400 bg-blue-900/30 border-blue-800'
              }`}>
                {prof.rol}
              </span>
              {prof.id !== currentUserId && (
                <button
                  onClick={() => toggleRol(prof)}
                  disabled={isPending}
                  className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40"
                >
                  {prof.rol === 'admin' ? '→ profesor' : '→ admin'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
