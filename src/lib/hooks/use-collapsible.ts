import { useState, useEffect } from 'react'

/**
 * Collapsible panel state backed by localStorage.
 * All dashboard panels use this to persist open/closed state.
 */
export function useCollapsible(storageKey: string, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) setOpen(saved === 'true')
  }, [storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem(storageKey, String(next))
  }

  return { open, toggle }
}
