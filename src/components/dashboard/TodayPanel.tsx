'use client'

import { useState, useEffect } from 'react'

export interface TodayItem {
  id: string
  hora: string | null
  horaFin: string | null
  titulo: string
  detalle: string | null
  tipo: 'clase' | 'tutoria' | 'evento'
  colorKey: 'blue' | 'teal' | 'emerald' | 'gray' | 'purple' | 'amber' | 'pink'
}

const COLORS: Record<string, { border: string; dot: string; badge: string; text: string }> = {
  blue:    { border: 'border-l-blue-500',    dot: 'bg-blue-500',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',    text: 'text-blue-300' },
  teal:    { border: 'border-l-teal-500',    dot: 'bg-teal-500',    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',    text: 'text-teal-300' },
  emerald: { border: 'border-l-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', text: 'text-emerald-300' },
  gray:    { border: 'border-l-gray-600',    dot: 'bg-gray-500',    badge: 'bg-gray-700 text-gray-400 border-gray-600',           text: 'text-gray-400' },
  purple:  { border: 'border-l-purple-500',  dot: 'bg-purple-500',  badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', text: 'text-purple-300' },
  amber:   { border: 'border-l-amber-500',   dot: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',   text: 'text-amber-300' },
  pink:    { border: 'border-l-pink-500',    dot: 'bg-pink-500',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',     text: 'text-pink-300' },
}

interface Props {
  items: TodayItem[]
  labelDia: string
}

export function TodayPanel({ items, labelDia }: Props) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('today-panel-open')
    if (saved !== null) setOpen(saved === 'true')
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('today-panel-open', String(next))
  }

  const c = COLORS

  return (
    <div className="card">
      {/* Header */}
      <button onClick={toggle} className="w-full flex items-center justify-between gap-2 group">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-white">Hoy</span>
          <span className="text-sm text-gray-500">— {labelDia}</span>
          {items.length === 0 && (
            <span className="text-xs text-gray-600 ml-1">sin actividades</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Items */}
      {open && (
        <div className="mt-3 space-y-1.5">
          {items.length === 0 ? (
            <p className="text-sm text-gray-600 py-2 text-center">No hay actividades programadas para hoy</p>
          ) : (
            items.map(item => {
              const clr = c[item.colorKey] ?? c.gray
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 pl-3 border-l-2 ${clr.border} py-1.5`}
                >
                  {/* Time */}
                  <div className="w-[88px] flex-shrink-0 pt-0.5">
                    {item.hora ? (
                      <span className="text-xs font-mono text-gray-500">
                        {item.hora}{item.horaFin ? `–${item.horaFin}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 italic">todo el día</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 leading-tight truncate">
                      {item.titulo}
                    </p>
                    {item.detalle && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight truncate">
                        {item.detalle}
                      </p>
                    )}
                  </div>

                  {/* Type badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${clr.badge}`}>
                    {item.tipo === 'clase' ? 'Clase' : item.tipo === 'tutoria' ? 'Tutoría' : 'Evento'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
