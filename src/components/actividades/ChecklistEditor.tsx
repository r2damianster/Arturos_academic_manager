'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ChecklistItem } from '@/lib/actions/actividades'

type Props = {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

export function ChecklistEditor({ items, onChange }: Props) {
  const [newTexto, setNewTexto] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addItem() {
    const texto = newTexto.trim()
    if (!texto) return
    onChange([...items, { id: crypto.randomUUID(), texto, done: false }])
    setNewTexto('')
    inputRef.current?.focus()
  }

  function toggleItem(id: string) {
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  function updateTexto(id: string, texto: string) {
    onChange(items.map(i => i.id === id ? { ...i, texto } : i))
  }

  function removeItem(id: string) {
    onChange(items.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-1">
      {/* Items existentes */}
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group/item">
          <button
            type="button"
            onClick={() => toggleItem(item.id)}
            className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              item.done
                ? 'bg-emerald-600 border-emerald-600'
                : 'border-gray-600 hover:border-emerald-500'
            }`}
          >
            {item.done && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5L8.5 2" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={item.texto}
            onChange={e => updateTexto(item.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
            className={`flex-1 bg-transparent text-sm border-b border-transparent focus:border-gray-700 outline-none transition-colors py-0.5 ${
              item.done ? 'text-gray-500 line-through' : 'text-gray-200'
            }`}
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="opacity-0 group-hover/item:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Input para nuevo item */}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-gray-700 border-dashed" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Añadir elemento..."
          value={newTexto}
          onChange={e => setNewTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
          className="flex-1 bg-transparent text-sm text-gray-400 placeholder:text-gray-600 border-b border-transparent focus:border-gray-700 outline-none transition-colors py-0.5"
        />
        {newTexto.trim() && (
          <button
            type="button"
            onClick={addItem}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// Inline checklist for card preview (read + quick toggle, no edit)
type InlineProps = {
  items: ChecklistItem[]
  onToggle: (itemId: string) => void
  maxVisible?: number
}

export function InlineChecklist({ items, onToggle, maxVisible = 5 }: InlineProps) {
  const visible = items.slice(0, maxVisible)
  const hidden = items.length - visible.length
  const done = items.filter(i => i.done).length

  return (
    <div className="space-y-1">
      {visible.map(item => (
        <div
          key={item.id}
          className="flex items-center gap-2"
          onClick={e => { e.stopPropagation(); onToggle(item.id) }}
        >
          <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
            item.done ? 'bg-emerald-600 border-emerald-600' : 'border-gray-500 hover:border-emerald-500'
          }`}>
            {item.done && (
              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5L8.5 2" />
              </svg>
            )}
          </div>
          <span className={`text-xs flex-1 ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
            {item.texto}
          </span>
        </div>
      ))}
      {hidden > 0 && (
        <p className="text-[10px] text-gray-600">+{hidden} más</p>
      )}
      {items.length > 0 && (
        <p className="text-[10px] text-gray-600 mt-1">{done}/{items.length} completados</p>
      )}
    </div>
  )
}
