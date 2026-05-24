'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AbrirRegistroPanel } from './AbrirRegistroPanel'

interface Props {
  cursoId: string
}

export function AbrirRegistroButton({ cursoId }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-sm flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Abrir registro
      </button>

      {open && (
        <AbrirRegistroPanel
          cursoId={cursoId}
          onClose={() => setOpen(false)}
          onCreado={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
