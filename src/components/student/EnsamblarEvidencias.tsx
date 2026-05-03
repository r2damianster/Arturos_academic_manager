'use client'

import { useState, useRef, useCallback } from 'react'

interface Archivo {
  id: string
  file: File
}

interface Categoria {
  id: string
  nombre: string
  tipo: 'grupal' | 'individual'
  archivos: Archivo[]
}

interface Stats {
  asistencia: number | null
  indiceFormativo: number | null
  observacionProceso: string | null
  compromisos: number
  citadoTutoria: boolean
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}

interface Props {
  estudiante: string
  curso: string
  profesor: string
  stats?: Stats
}

const CATS_DEFAULT: Omit<Categoria, 'id' | 'archivos'>[] = [
  { nombre: 'Exposiciones en clase', tipo: 'grupal' },
  { nombre: 'Hojas grupales',        tipo: 'grupal' },
  { nombre: 'Brisk',                 tipo: 'individual' },
  { nombre: 'Perusall',              tipo: 'individual' },
  { nombre: 'Ensayos',               tipo: 'individual' },
  { nombre: 'Ejercicios en clases',  tipo: 'individual' },
  { nombre: 'Apuntes importantes',   tipo: 'individual' },
]

let uid = 0
function newId() { return `id_${++uid}` }

function makeCats(): Categoria[] {
  return CATS_DEFAULT.map(c => ({ ...c, id: newId(), archivos: [] }))
}

const TIPOS_ACEPTADOS = 'application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/tiff'

async function comprimirImagen(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1400
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX }
        else { w = Math.round((w * MAX) / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg', 0.82
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}

export function EnsamblarEvidencias({ estudiante, curso, profesor, stats }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>(makeCats)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaTipo, setNuevaTipo] = useState<'grupal' | 'individual'>('individual')
  const [addingCat, setAddingCat] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalArchivos = categorias.reduce((s, c) => s + c.archivos.length, 0)

  function addArchivos(catId: string, files: FileList | null) {
    if (!files) return
    setCategorias(prev => prev.map(c => {
      if (c.id !== catId) return c
      const nuevos: Archivo[] = Array.from(files).map(f => ({ id: newId(), file: f }))
      return { ...c, archivos: [...c.archivos, ...nuevos] }
    }))
  }

  function removeArchivo(catId: string, archivoId: string) {
    setCategorias(prev => prev.map(c =>
      c.id !== catId ? c : { ...c, archivos: c.archivos.filter(a => a.id !== archivoId) }
    ))
  }

  function moveArchivo(catId: string, idx: number, dir: -1 | 1) {
    setCategorias(prev => prev.map(c => {
      if (c.id !== catId) return c
      const arr = [...c.archivos]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return c;
      [arr[idx], arr[target]] = [arr[target], arr[idx]]
      return { ...c, archivos: arr }
    }))
  }

  function removeCategoria(catId: string) {
    setCategorias(prev => prev.filter(c => c.id !== catId))
  }

  function addCategoria() {
    if (!nuevaNombre.trim()) return
    setCategorias(prev => [...prev, { id: newId(), nombre: nuevaNombre.trim(), tipo: nuevaTipo, archivos: [] }])
    setNuevaNombre('')
    setAddingCat(false)
  }

  const onDrop = useCallback((catId: string, e: React.DragEvent) => {
    e.preventDefault()
    addArchivos(catId, e.dataTransfer.files)
  }, [])

  async function generar() {
    if (totalArchivos === 0) { setError('Agrega al menos un archivo'); return }
    setGenerando(true)
    setError(null)

    const fd = new FormData()
    const secciones: { tipo: string; nombre: string; archivos: string[] }[] = []

    for (const c of categorias) {
      if (c.archivos.length === 0) continue
      const keys: string[] = []
      for (const a of c.archivos) {
        const file = a.file.type.startsWith('image/') ? await comprimirImagen(a.file) : a.file
        fd.append(a.id, file)
        keys.push(a.id)
      }
      secciones.push({ tipo: c.tipo, nombre: c.nombre, archivos: keys })
    }

    const hoy = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
    fd.append('manifest', JSON.stringify({ estudiante, curso, profesor, fecha: hoy, secciones, stats }))

    try {
      const res = await fetch('/api/student/ensamblar-evidencias', { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `Error ${res.status}`)
        return
      }
      const blob = await res.blob()
      descargarBlob(blob, `evidencias_${hoy.replaceAll('/', '-')}.pdf`)
    } catch (e) {
      setError('Error de conexión al generar el PDF')
    } finally {
      setGenerando(false)
    }
  }

  const grupales    = categorias.filter(c => c.tipo === 'grupal')
  const individuales = categorias.filter(c => c.tipo === 'individual')

  function renderCategoria(cat: Categoria) {
    return (
      <div key={cat.id} className="border border-gray-700/60 rounded-xl overflow-hidden">
        {/* Header categoría */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/60">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">📁</span>
            <span className="text-sm font-medium text-gray-200">{cat.nombre}</span>
            <span className="text-[10px] text-gray-600 ml-1">{cat.archivos.length} archivo{cat.archivos.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRefs.current[cat.id]?.click()}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-600 text-gray-400 hover:border-brand-500 hover:text-brand-400 transition-colors"
            >
              + Archivos
            </button>
            <button
              onClick={() => removeCategoria(cat.id)}
              className="text-gray-600 hover:text-red-400 transition-colors text-sm"
              title="Eliminar categoría"
            >✕</button>
          </div>
          <input
            ref={el => { inputRefs.current[cat.id] = el }}
            type="file"
            multiple
            accept={TIPOS_ACEPTADOS}
            className="hidden"
            onChange={e => addArchivos(cat.id, e.target.files)}
          />
        </div>

        {/* Drop zone + lista */}
        <div
          className="p-3 min-h-[60px] bg-gray-900/40"
          onDragOver={e => e.preventDefault()}
          onDrop={e => onDrop(cat.id, e)}
        >
          {cat.archivos.length === 0 ? (
            <p className="text-center text-gray-600 text-xs py-3">
              Arrastra archivos aquí o usa "+ Archivos"
            </p>
          ) : (
            <ul className="space-y-1.5">
              {cat.archivos.map((a, idx) => (
                <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800/50 group">
                  <span className="text-gray-500 text-[11px] flex-shrink-0">
                    {a.file.type === 'application/pdf' ? '📄' : '🖼️'}
                  </span>
                  <span className="flex-1 text-xs text-gray-300 truncate" title={a.file.name}>
                    {a.file.name}
                  </span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {(a.file.size / 1024).toFixed(0)} KB
                  </span>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => moveArchivo(cat.id, idx, -1)} disabled={idx === 0}
                      className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">↑</button>
                    <button onClick={() => moveArchivo(cat.id, idx, 1)} disabled={idx === cat.archivos.length - 1}
                      className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs">↓</button>
                    <button onClick={() => removeArchivo(cat.id, a.id)}
                      className="w-5 h-5 flex items-center justify-center text-red-700 hover:text-red-400 text-xs">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Acción principal */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            {totalArchivos === 0
              ? 'Agrega archivos en las categorías'
              : `${totalArchivos} archivo${totalArchivos !== 1 ? 's' : ''} listo${totalArchivos !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button
          onClick={generar}
          disabled={generando || totalArchivos === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generando ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generando…
            </>
          ) : (
            <>📄 Generar PDF</>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-400 text-xs">✕</button>
        </div>
      )}

      {/* Zona: Grupales */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-sky-500" />
          <h3 className="text-sm font-semibold text-gray-300">Actividades Grupales</h3>
        </div>
        <div className="space-y-3 pl-4">
          {grupales.length === 0
            ? <p className="text-xs text-gray-600">Sin categorías grupales</p>
            : grupales.map(renderCategoria)
          }
        </div>
      </div>

      {/* Zona: Individuales */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-300">Actividades Individuales</h3>
        </div>
        <div className="space-y-3 pl-4">
          {individuales.length === 0
            ? <p className="text-xs text-gray-600">Sin categorías individuales</p>
            : individuales.map(renderCategoria)
          }
        </div>
      </div>

      {/* Añadir categoría */}
      {!addingCat ? (
        <button
          onClick={() => setAddingCat(true)}
          className="w-full py-2.5 border border-dashed border-gray-700 rounded-xl text-xs text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
        >
          + Nueva categoría
        </button>
      ) : (
        <div className="flex gap-2 items-center p-3 border border-gray-700 rounded-xl bg-gray-900/50">
          <input
            autoFocus
            value={nuevaNombre}
            onChange={e => setNuevaNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategoria(); if (e.key === 'Escape') setAddingCat(false) }}
            placeholder="Nombre (ej: Informes, Videos…)"
            className="input flex-1 text-sm"
          />
          <select value={nuevaTipo} onChange={e => setNuevaTipo(e.target.value as 'grupal' | 'individual')} className="input text-sm w-36">
            <option value="grupal">Grupal</option>
            <option value="individual">Individual</option>
          </select>
          <button onClick={addCategoria} className="btn-primary text-sm px-3 py-1.5">Añadir</button>
          <button onClick={() => setAddingCat(false)} className="text-gray-500 hover:text-gray-300 text-sm px-2">✕</button>
        </div>
      )}
    </div>
  )
}
