'use client'

import { useState, useEffect } from 'react'
import { AgendaClient } from '@/app/dashboard/agenda/agenda-client'

type Props = React.ComponentProps<typeof AgendaClient>

export function AgendaSection(props: Props) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('agenda-section-open')
    if (saved !== null) setOpen(saved === 'true')
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('agenda-section-open', String(next))
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-1 mb-2 group"
      >
        <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h4" />
        </svg>
        <span className="text-sm font-semibold text-white">Agenda semanal</span>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ml-auto ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && <AgendaClient {...props} />}
    </div>
  )
}
