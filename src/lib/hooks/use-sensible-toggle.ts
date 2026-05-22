'use client'

import { useState, useEffect } from 'react'

const KEY = 'ficha-sensible-on'

export function useSensibleToggle(): [boolean, () => void] {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(localStorage.getItem(KEY) === '1')
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setOn(e.newValue === '1')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  function toggle() {
    setOn(prev => {
      const next = !prev
      localStorage.setItem(KEY, next ? '1' : '0')
      return next
    })
  }

  return [on, toggle]
}
