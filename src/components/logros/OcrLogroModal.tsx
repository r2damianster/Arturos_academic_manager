'use client'

import { useState, useRef, useCallback } from 'react'
import { addLogro } from '@/lib/actions/logros'

interface Props {
  cursoId: string
  nextOrden: number
  onInserted: (logros: { id: string; descripcion: string; orden: number }[]) => void
  onClose: () => void
}

export function OcrLogroModal({ cursoId, nextOrden, onInserted, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [logros, setLogros] = useState<string[] | null>(null)
  const [inserting, setInserting] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) { setError('Imagen demasiado grande (máx 5 MB)'); return }
    setFile(f)
    setError('')
    setLogros(null)
    setPreview(URL.createObjectURL(f))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile()
        if (blob) { handleFile(blob); break }
      }
    }
  }, [])

  async function handleClipboardButton() {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          handleFile(new File([blob], 'clipboard.png', { type: imageType }))
          return
        }
      }
      setError('No hay imagen en el portapapeles')
    } catch {
      setError('No se pudo acceder al portapapeles. Usa Ctrl+V o arrastra la imagen.')
    }
  }

  async function handleAnalyze() {
    if (!file) return
    setAnalyzing(true)
    setError('')
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch('/api/logros/ocr', { method: 'POST', body: fd })
    const data = await res.json()
    setAnalyzing(false)
    if (!res.ok || data.error) { setError(data.error ?? 'Error al analizar'); return }
    if (data.logros.length === 0) {
      setError('No se detectaron logros de aprendizaje en la imagen. Intenta con otra captura.')
      return
    }
    setLogros(data.logros)
  }

  async function handleInsert() {
    if (!logros) return
    setInserting(true)
    const inserted: { id: string; descripcion: string; orden: number }[] = []
    let offset = 0
    for (const desc of logros) {
      if (!desc.trim()) continue
      const res = await addLogro(cursoId, desc.trim())
      if (res.id) {
        inserted.push({ id: res.id, descripcion: desc.trim(), orden: nextOrden + offset })
        offset++
      }
    }
    setInserting(false)
    onInserted(inserted)
    onClose()
  }

  const validLogros = logros?.filter(l => l.trim()) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }} onPaste={handlePaste}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-white text-sm">Importar logros desde imagen</h2>
            <p className="text-xs text-gray-500 mt-0.5">La IA extrae y corrige el texto; tú editas antes de insertar</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none ml-4">×</button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">

          {/* Step 1: Dropzone (no file selected) */}
          {!file && (
            <div className="space-y-2">
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors select-none ${dragOver ? 'border-brand-500 bg-brand-900/20' : 'border-gray-700 hover:border-gray-500'}`}
              >
                <p className="text-3xl mb-2">📷</p>
                <p className="text-sm text-gray-400">Arrastra una imagen aquí o haz clic para seleccionar</p>
                <p className="text-xs text-gray-500 mt-1">También puedes <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-300 font-mono text-xs">Ctrl+V</kbd> para pegar directamente</p>
                <p className="text-xs text-gray-600 mt-1">PNG · JPG · WEBP · máx 5 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
              <button
                type="button"
                onClick={handleClipboardButton}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 text-sm transition-colors"
              >
                <span>📋</span> Pegar imagen del portapapeles
              </button>
            </div>
          )}

          {/* Step 2: File selected — preview + analyze */}
          {file && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-950">
                {preview && (
                  <img src={preview} alt="Vista previa" className="w-full max-h-52 object-contain" />
                )}
                <button
                  onClick={() => { setFile(null); setPreview(null); setLogros(null); setError('') }}
                  className="absolute top-2 right-2 bg-gray-900/80 border border-gray-700 text-gray-400 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                  title="Cambiar imagen"
                >
                  ×
                </button>
              </div>

              {!logros && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  {analyzing ? '✦ Analizando imagen…' : '✦ Analizar con IA'}
                </button>
              )}
            </div>
          )}

          {/* Step 3: Editable list of extracted logros */}
          {logros && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">
                  {logros.length} logro{logros.length !== 1 ? 's' : ''} detectado{logros.length !== 1 ? 's' : ''} — edita si es necesario
                </p>
                <button
                  onClick={() => setLogros(prev => [...(prev ?? []), ''])}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  + Añadir
                </button>
              </div>

              <div className="space-y-2">
                {logros.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="flex-shrink-0 w-5 h-5 mt-2 rounded-full bg-brand-600/20 border border-brand-600/40 text-brand-400 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <textarea
                      className="input flex-1 text-sm resize-none"
                      rows={2}
                      value={l}
                      maxLength={500}
                      onChange={e => setLogros(prev => prev!.map((x, j) => j === i ? e.target.value : x))}
                    />
                    <button
                      onClick={() => setLogros(prev => prev!.filter((_, j) => j !== i))}
                      className="mt-2 text-gray-600 hover:text-red-400 flex-shrink-0 text-base leading-none"
                      title="Eliminar este logro"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setLogros(null)}
                className="text-xs text-gray-600 hover:text-gray-400 underline"
              >
                Volver a analizar
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          {validLogros.length > 0 && (
            <button
              onClick={handleInsert}
              disabled={inserting}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {inserting ? 'Insertando…' : `Insertar ${validLogros.length} logro${validLogros.length !== 1 ? 's' : ''} →`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
