'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { parsearArchivoMoodleAction } from '@/lib/actions/calificaciones-import'
import { type ResultadoParser } from '@/lib/parsers/moodle-calificaciones'

interface Props {
  onParsed: (
    resultado: ResultadoParser,
    nombre: string,
    buffer: ArrayBuffer,
    hash: string
  ) => void
}

export default function Paso1Upload({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const procesarArchivo = useCallback(async (file: File) => {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo excede el límite de 5 MB.')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['ods', 'xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setError('Formato no soportado. Usa .ods, .xlsx, .xls o .csv.')
      return
    }

    setCargando(true)
    try {
      const buffer = await file.arrayBuffer()

      // Hash SHA-256 del contenido
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const formData = new FormData()
      formData.append('archivo', file)
      const { resultado, error: errParse } = await parsearArchivoMoodleAction(formData)

      if (errParse || !resultado) {
        setError(errParse ?? 'Error desconocido al leer el archivo.')
        return
      }

      if (!resultado.es_moodle) {
        // Mostrar advertencias pero permitir continuar
        setError(resultado.advertencias.join(' ') + ' ¿Deseas continuar de todas formas?')
        // Aun así avanzar (puede ser un Moodle con formato ligeramente distinto)
      }

      onParsed(resultado, file.name, buffer, hash)
    } catch (e) {
      setError(`Error al procesar el archivo: ${(e as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [onParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }, [procesarArchivo])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Zona drag-drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-4 p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          }
        `}
      >
        {cargando ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-zinc-500">Leyendo archivo…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <Upload className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">
                Arrastra el archivo aquí o haz clic para seleccionarlo
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Formatos soportados: .ods · .xlsx · .xls · .csv · Máximo 5 MB
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".ods,.xlsx,.xls,.csv"
        onChange={onFileChange}
        className="hidden"
      />

      {error && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>
        </div>
      )}

      {/* Instrucciones */}
      <div className="flex gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <FileSpreadsheet className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
        <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">¿Cómo exportar desde Moodle?</p>
          <p>En tu curso de Moodle ve a <strong>Calificaciones → Exportar → Hoja de cálculo ODS</strong>. Descarga el archivo y súbelo aquí.</p>
        </div>
      </div>
    </div>
  )
}
