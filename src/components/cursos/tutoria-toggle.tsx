'use client'

import { useState, useTransition } from 'react'
import { setTutoria } from '@/lib/actions/estudiantes'

interface Props {
  estudianteId: string
  tutoria: boolean
}

export function TutoriaToggle({ estudianteId, tutoria }: Props) {
  const [active, setActive] = useState(tutoria)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !active
    setActive(next)
    startTransition(async () => {
      const result = await setTutoria(estudianteId, next)
      if (result?.error) setActive(!next)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={active ? 'Quitar tutoría' : 'Asignar tutoría'}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none
                  disabled:opacity-50 ${active ? 'bg-brand-600' : 'bg-gray-700'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow
                    transition duration-200 ease-in-out ${active ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}
