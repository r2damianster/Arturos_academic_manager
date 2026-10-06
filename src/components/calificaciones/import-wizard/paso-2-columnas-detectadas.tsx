'use client'

import { AlertCircle, CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import { type ResultadoParser, type TipoColumna } from '@/lib/parsers/moodle-calificaciones'

interface Props {
  resultado: ResultadoParser
  onContinuar: () => void
  onVolver: () => void
}

const TIPO_LABELS: Record<TipoColumna, { label: string; color: string; importable: boolean }> = {
  tarea:              { label: 'Tarea individual',      color: 'bg-green-900/30 text-green-400',   importable: true  },
  subtotal_categoria: { label: 'Subtotal categoría',    color: 'bg-blue-900/30 text-blue-400',       importable: true  },
  total_parcial:      { label: 'Total parcial',         color: 'bg-gray-800 text-gray-400',          importable: false },
  total_recuperacion: { label: 'Total recuperación',    color: 'bg-gray-800 text-gray-400',          importable: false },
  total_curso:        { label: 'Total del curso',       color: 'bg-gray-800 text-gray-400',          importable: false },
  ponderacion:        { label: 'Ponderación',           color: 'bg-gray-800 text-gray-400',          importable: false },
  asistencia:         { label: 'Asistencia',            color: 'bg-orange-900/20 text-orange-400', importable: false },
  descarga:           { label: 'Fecha descarga',        color: 'bg-gray-800 text-gray-400',                                              importable: false },
  identidad:          { label: 'Identidad',             color: 'bg-purple-900/30 text-purple-400', importable: false },
  otro:               { label: 'Otro',                  color: 'bg-gray-800 text-gray-400',                                              importable: false },
}

export default function Paso2ColumnasDetectadas({ resultado, onContinuar, onVolver }: Props) {
  const importables = resultado.columnas_notas.filter(c => c.importable)
  const noImportables = resultado.columnas_notas.filter(c => !c.importable)

  return (
    <div className="flex flex-col gap-6">
      {/* Estado general */}
      {resultado.es_moodle ? (
        <div className="flex gap-3 p-4 rounded-xl bg-green-900/10 border border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <div className="text-sm text-green-300">
            <strong>Archivo reconocido como export de Moodle.</strong>{' '}
            {resultado.filas_estudiantes.length} estudiantes detectados.{' '}
            {importables.length} columnas de calificaciones importables.
          </div>
        </div>
      ) : (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-900/10 border border-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">
            {resultado.advertencias.join(' ')}
          </p>
        </div>
      )}

      {/* Columnas importables */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Columnas que se podrán importar ({importables.length})
        </h3>
        <div className="flex flex-col gap-2">
          {importables.map(col => {
            const info = TIPO_LABELS[col.tipo]
            return (
              <div key={col.col_index} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate" title={col.nombre_limpio}>
                    {col.nombre_limpio}
                  </p>
                  {col.parcial && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Parcial {col.parcial}{col.categoria ? ` · ${col.categoria}` : ''}
                    </p>
                  )}
                  {col.muestra_valores.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Muestra: {col.muestra_valores.slice(0, 4).join(' · ')}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${info.color}`}>
                  {info.label}
                </span>
              </div>
            )
          })}
          {importables.length === 0 && (
            <p className="text-sm text-gray-400 italic">No se detectaron columnas importables.</p>
          )}
        </div>
      </div>

      {/* Columnas excluidas */}
      {noImportables.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Columnas excluidas automáticamente — calculadas o no relevantes ({noImportables.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {noImportables.map(col => {
              const info = TIPO_LABELS[col.tipo]
              return (
                <div key={col.col_index} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700">
                  <XCircle className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 max-w-[200px] truncate" title={col.nombre_limpio}>
                    {col.nombre_limpio}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Los totales (Total P1, Total del curso, Ponderaciones) se calculan automáticamente a partir de los ítems importados.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-between pt-2">
        <button onClick={onVolver} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
          ← Volver
        </button>
        <button
          onClick={onContinuar}
          disabled={importables.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          Continuar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
