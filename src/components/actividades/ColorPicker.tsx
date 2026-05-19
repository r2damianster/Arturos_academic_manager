'use client'

import type { NoteColor } from '@/lib/actions/actividades'

export const COLOR_MAP: Record<string, { bg: string; border: string; dot: string }> = {
  rojo:    { bg: 'bg-red-950/80',    border: 'border-red-800/60',    dot: 'bg-red-500' },
  naranja: { bg: 'bg-orange-950/80', border: 'border-orange-800/60', dot: 'bg-orange-500' },
  amarillo:{ bg: 'bg-yellow-950/80', border: 'border-yellow-800/60', dot: 'bg-yellow-400' },
  verde:   { bg: 'bg-green-950/80',  border: 'border-green-800/60',  dot: 'bg-green-500' },
  teal:    { bg: 'bg-teal-950/80',   border: 'border-teal-800/60',   dot: 'bg-teal-400' },
  azul:    { bg: 'bg-blue-950/80',   border: 'border-blue-800/60',   dot: 'bg-blue-500' },
  morado:  { bg: 'bg-purple-950/80', border: 'border-purple-800/60', dot: 'bg-purple-500' },
}

const COLORS: { value: NoteColor; label: string }[] = [
  { value: null,       label: 'Por defecto' },
  { value: 'rojo',     label: 'Rojo' },
  { value: 'naranja',  label: 'Naranja' },
  { value: 'amarillo', label: 'Amarillo' },
  { value: 'verde',    label: 'Verde' },
  { value: 'teal',     label: 'Teal' },
  { value: 'azul',     label: 'Azul' },
  { value: 'morado',   label: 'Morado' },
]

type Props = {
  value: NoteColor
  onChange: (color: NoteColor) => void
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLORS.map(c => (
        <button
          key={c.value ?? 'default'}
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
            c.value === null
              ? 'bg-gray-700 border-gray-500'
              : `${COLOR_MAP[c.value].dot} border-transparent`
          } ${value === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
        />
      ))}
    </div>
  )
}

export function getCardStyle(color: NoteColor): { bg: string; border: string } {
  if (!color) return { bg: 'bg-gray-900', border: 'border-gray-800' }
  return COLOR_MAP[color] ?? { bg: 'bg-gray-900', border: 'border-gray-800' }
}
