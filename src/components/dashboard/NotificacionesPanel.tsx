'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { Notificacion } from '@/lib/actions/notificaciones'

const NIVEL_CONFIG = {
  critica: {
    bg: 'bg-red-900/20 border-red-700/50',
    icon: '🔴',
    textColor: 'text-red-300',
    descColor: 'text-red-400/70',
  },
  advertencia: {
    bg: 'bg-amber-900/20 border-amber-700/50',
    icon: '🟡',
    textColor: 'text-amber-300',
    descColor: 'text-amber-400/70',
  },
  info: {
    bg: 'bg-blue-900/20 border-blue-700/50',
    icon: '🔵',
    textColor: 'text-blue-300',
    descColor: 'text-blue-400/70',
  },
}

export function NotificacionesPanel({ notificaciones }: { notificaciones: Notificacion[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('notif_dismissed')
      if (stored) setDismissed(new Set(JSON.parse(stored)))
    } catch { /* ok */ }
    setLoaded(true)
  }, [])

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      try { sessionStorage.setItem('notif_dismissed', JSON.stringify([...next])) } catch { /* ok */ }
      return next
    })
  }

  if (!loaded) return null

  const visibles = notificaciones.filter(n => !dismissed.has(n.id))
  if (visibles.length === 0) return null

  return (
    <div className="space-y-2">
      {visibles.map(notif => {
        const cfg = NIVEL_CONFIG[notif.nivel]
        const inner = (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg}`}>
            <span className="text-sm mt-0.5 flex-shrink-0">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${cfg.textColor}`}>{notif.titulo}</p>
              <p className={`text-xs mt-0.5 ${cfg.descColor}`}>{notif.descripcion}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(notif.id) }}
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 text-sm mt-0.5"
              aria-label="Descartar"
            >
              ✕
            </button>
          </div>
        )

        return notif.link ? (
          <Link key={notif.id} href={notif.link} className="block hover:opacity-90 transition-opacity">
            {inner}
          </Link>
        ) : (
          <div key={notif.id}>{inner}</div>
        )
      })}
    </div>
  )
}
