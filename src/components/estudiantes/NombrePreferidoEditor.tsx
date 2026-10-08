'use client'

import { useState, useTransition } from 'react'
import { setNombrePreferido } from '@/lib/actions/estudiantes'

interface NombrePreferidoEditorProps {
  studentId: string
  cursoId: string
  currentPreferredName: string | null | undefined
  onSaved?: (preferredName: string | null) => void
}

/** Edita cómo se llama al estudiante en clase. El nombre real no cambia. */
export function NombrePreferidoEditor({ studentId, cursoId, currentPreferredName, onSaved }: NombrePreferidoEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(currentPreferredName ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setErrorMessage(null)
    startTransition(async () => {
      const result = await setNombrePreferido(studentId, draftName, cursoId)
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      const trimmedName = draftName.trim()
      onSaved?.(trimmedName === '' ? null : trimmedName)
      setIsEditing(false)
    })
  }

  function handleStartEditing() {
    setDraftName(currentPreferredName ?? '')
    setIsEditing(true)
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={handleStartEditing}
        className="text-xs text-gray-500 hover:text-brand-400 transition-colors"
      >
        {currentPreferredName ? '✎ Cambiar “llamar como”' : '+ Llamar de otra forma'}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draftName}
          maxLength={40}
          autoFocus
          onChange={event => setDraftName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') handleSave()
            if (event.key === 'Escape') setIsEditing(false)
          }}
          placeholder="Ej: KADDE (vacío = nombre normal)"
          className="input text-sm py-1"
        />
        <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary text-xs px-2 py-1">
          {isPending ? '...' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setIsEditing(false)} className="btn-ghost text-xs px-2 py-1">
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-gray-600">Solo se usa al pasar lista y en clase. Los reportes usan el nombre real.</p>
      {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
    </div>
  )
}
