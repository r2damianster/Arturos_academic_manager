'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { crearActividad, eliminarActividad, getUltimasNotas } from '@/lib/actions/actividades'
import { MiniNotaCard } from './MiniNotaCard'
import { EditarActividadPanel } from './EditarActividadPanel'
import type { ActividadConCurso } from '@/lib/actions/actividades'
import type { Database } from '@/types/database.types'
import { StickyNote, X, ArrowUpRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type Tipo = Database['public']['Tables']['actividades_inbox']['Row']['tipo']

const TIPO_OPTS: { value: Tipo; emoji: string; label: string }[] = [
  { value: 'nota',         emoji: '📝', label: 'Nota' },
  { value: 'tarea',        emoji: '✅', label: 'Tarea' },
  { value: 'recordatorio', emoji: '🔔', label: 'Recuerdo' },
]

const EXCLUDED_PATHS = ['/dashboard/modo-clase', '/dashboard/actividades']

export function FloatingNotesPanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [notas, setNotas] = useState<ActividadConCurso[]>([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState<ActividadConCurso | null>(null)
  const [tipo, setTipo] = useState<Tipo>('nota')
  const [titulo, setTitulo] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  // Ocultar en ciertas páginas
  const hidden = EXCLUDED_PATHS.some(p => pathname.startsWith(p))

  // Restaurar estado open desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notas-panel-open')
    if (saved === 'true') {
      setOpen(true)
    }
  }, [])

  // Cargar notas al abrir
  useEffect(() => {
    if (!open || notas.length > 0) return
    setLoading(true)
    getUltimasNotas(10).then(data => {
      setNotas(data)
      setLoading(false)
    })
  }, [open])

  // Focus input al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    localStorage.setItem('notas-panel-open', String(next))
  }

  async function recargar() {
    const data = await getUltimasNotas(10)
    setNotas(data)
  }

  async function handleSave() {
    if (!titulo.trim()) return
    setSaving(true)
    const result = await crearActividad({
      titulo: titulo.trim(),
      tipo,
      origen: 'panel-flotante',
    })
    setSaving(false)
    if (result.error) return
    setTitulo('')
    // Optimistic prepend
    await recargar()
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { setOpen(false); localStorage.setItem('notas-panel-open', 'false') }
  }

  if (hidden) return null

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {/* Panel */}
        {open && (
          <div className="w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
            style={{ maxHeight: 'min(65vh, 520px)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <span className="text-sm font-semibold text-white">Notas rápidas</span>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/actividades"
                  className="text-xs text-gray-500 hover:text-brand-400 flex items-center gap-0.5 transition-colors"
                  onClick={() => { setOpen(false); localStorage.setItem('notas-panel-open', 'false') }}
                >
                  Ver todas <ArrowUpRight className="w-3 h-3" />
                </Link>
                <button onClick={toggleOpen} className="text-gray-600 hover:text-gray-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Input de captura rápida */}
            <div className="px-3 py-3 border-b border-gray-800/60 flex-shrink-0 space-y-2">
              {/* Tipo chips */}
              <div className="flex gap-1">
                {TIPO_OPTS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={clsx(
                      'flex-1 py-1 rounded-lg text-xs font-medium border transition-all',
                      tipo === t.value
                        ? 'border-brand-500/60 bg-brand-600/15 text-brand-300'
                        : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400',
                    )}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Captura una idea..."
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="input flex-1 text-sm py-1.5"
                  maxLength={500}
                  disabled={saving}
                />
                {saving && <Loader2 className="w-4 h-4 text-gray-500 animate-spin flex-shrink-0" />}
              </div>
              <p className="text-[10px] text-gray-700">Enter para guardar · Esc para cerrar</p>
            </div>

            {/* Lista de notas */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
              ) : notas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <StickyNote className="w-8 h-8 text-gray-800 mb-2" strokeWidth={1} />
                  <p className="text-xs text-gray-600">Sin notas aún</p>
                  <p className="text-[10px] text-gray-700 mt-0.5">Captura tu primera idea arriba</p>
                </div>
              ) : (
                notas.map(n => (
                  <MiniNotaCard
                    key={n.id}
                    actividad={n}
                    onClick={() => setEditando(n)}
                    onCambiado={() => startTransition(() => recargar())}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={toggleOpen}
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all',
            'hover:scale-105 active:scale-95',
            open
              ? 'bg-gray-700 text-gray-300'
              : 'bg-brand-600 text-white shadow-brand-600/30',
          )}
          title="Notas rápidas (N)"
          style={{ boxShadow: open ? undefined : '0 0 20px rgba(2,132,199,0.35)' }}
        >
          {open ? <X className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
        </button>
      </div>

      {/* Modal de edición completa */}
      {editando && (
        <EditarActividadPanel
          actividad={editando}
          cursos={[]}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); recargar() }}
        />
      )}
    </>
  )
}
