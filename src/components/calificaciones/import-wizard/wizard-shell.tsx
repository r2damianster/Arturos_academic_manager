'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { type ResultadoParser } from '@/lib/parsers/moodle-calificaciones'
import {
  type ColumnaSeleccionada,
  type MatchEstudiante,
  type PreviewImport,
} from '@/lib/actions/calificaciones-import'
import Paso1Upload from './paso-1-upload'
import Paso2ColumnasDetectadas from './paso-2-columnas-detectadas'
import Paso3SeleccionParcial from './paso-3-seleccion-parcial'
import Paso4MatchEstudiantes from './paso-4-match-estudiantes'
import Paso5Preview from './paso-5-preview'

interface Props {
  cursoId: string
  numParciales: number
  onClose: () => void
  onImportado: (importId: string) => void
}

type Paso = 1 | 2 | 3 | 4 | 5

const TITULOS: Record<Paso, string> = {
  1: 'Subir archivo de Moodle',
  2: 'Columnas detectadas',
  3: 'Seleccionar calificaciones',
  4: 'Verificar estudiantes',
  5: 'Vista previa antes / después',
}

export default function WizardImportCalificaciones({ cursoId, numParciales, onClose, onImportado }: Props) {
  const [paso, setPaso] = useState<Paso>(1)

  // Estado compartido entre pasos
  const [archivoNombre, setArchivoNombre] = useState('')
  const [hashArchivo, setHashArchivo]     = useState<string | undefined>()
  const [resultadoParser, setResultadoParser] = useState<ResultadoParser | null>(null)
  const [archivoBuffer, setArchivoBuffer] = useState<ArrayBuffer | null>(null)
  const [columnasSeleccionadas, setColumnasSeleccionadas] = useState<ColumnaSeleccionada[]>([])
  const [ajustarNumParciales, setAjustarNumParciales] = useState<number | null>(null)
  const [matches, setMatches] = useState<MatchEstudiante[]>([])
  const [preview, setPreview] = useState<PreviewImport | null>(null)

  const avanzar = () => setPaso(p => Math.min(p + 1, 5) as Paso)
  const retroceder = () => setPaso(p => Math.max(p - 1, 1) as Paso)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Paso {paso} de 5
            </p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {TITULOS[paso]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {([1, 2, 3, 4, 5] as Paso[]).map(n => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= paso ? 'bg-blue-500' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Contenido del paso */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {paso === 1 && (
            <Paso1Upload
              onParsed={(resultado, nombre, buffer, hash) => {
                setResultadoParser(resultado)
                setArchivoNombre(nombre)
                setArchivoBuffer(buffer)
                setHashArchivo(hash)
                avanzar()
              }}
            />
          )}
          {paso === 2 && resultadoParser && (
            <Paso2ColumnasDetectadas
              resultado={resultadoParser}
              onContinuar={avanzar}
              onVolver={retroceder}
            />
          )}
          {paso === 3 && resultadoParser && (
            <Paso3SeleccionParcial
              columnas={resultadoParser.columnas_notas}
              numParciales={numParciales}
              onContinuar={(seleccionadas, ajuste) => {
                setColumnasSeleccionadas(seleccionadas)
                setAjustarNumParciales(ajuste)
                avanzar()
              }}
              onVolver={retroceder}
            />
          )}
          {paso === 4 && resultadoParser && (
            <Paso4MatchEstudiantes
              cursoId={cursoId}
              filas={resultadoParser.filas_estudiantes}
              onContinuar={(matchesFinal) => {
                setMatches(matchesFinal)
                avanzar()
              }}
              onVolver={retroceder}
            />
          )}
          {paso === 5 && resultadoParser && (
            <Paso5Preview
              cursoId={cursoId}
              archivoNombre={archivoNombre}
              hashArchivo={hashArchivo}
              fechaDescargaMoodle={resultadoParser.fecha_descarga_moodle}
              columnas={columnasSeleccionadas}
              matches={matches}
              valores={resultadoParser.filas_estudiantes.reduce((acc, f) => {
                acc[f.email] = f.valores
                return acc
              }, {} as Record<string, Record<number, number | null>>)}
              ajustarNumParciales={ajustarNumParciales}
              preview={preview}
              onPreviewCargado={setPreview}
              onImportado={onImportado}
              onVolver={retroceder}
            />
          )}
        </div>
      </div>
    </div>
  )
}
