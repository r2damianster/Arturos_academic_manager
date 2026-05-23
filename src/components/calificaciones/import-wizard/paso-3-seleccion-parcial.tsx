'use client'

import { useState, useMemo } from 'react'
import { AlertCircle, ChevronRight, Info } from 'lucide-react'
import { type ColumnaNota } from '@/lib/parsers/moodle-calificaciones'
import { type ColumnaSeleccionada } from '@/lib/actions/calificaciones-import'

interface Props {
  columnas: ColumnaNota[]
  numParciales: number
  onContinuar: (seleccionadas: ColumnaSeleccionada[], ajustarNumParciales: number | null) => void
  onVolver: () => void
}

export default function Paso3SeleccionParcial({ columnas, numParciales, onContinuar, onVolver }: Props) {
  const importables = columnas.filter(c => c.importable)

  // Estado: selección por col_index
  const [seleccionadas, setSeleccionadas] = useState<Record<number, boolean>>(
    Object.fromEntries(importables.map(c => [c.col_index, true]))
  )
  // Parcial override por col_index (si el header ya tiene parcial, lo usamos; si no, dejamos 1)
  const [parcialesOverride, setParcialesOverride] = useState<Record<number, number>>(
    Object.fromEntries(importables.map(c => [c.col_index, c.parcial ?? 1]))
  )

  const maxParcialArchivo = useMemo(() =>
    Math.max(...importables.map(c => c.parcial ?? 1), 1),
    [importables]
  )

  const debeAjustar = maxParcialArchivo > numParciales
  const [ajustarAceptado, setAjustarAceptado] = useState(false)

  const totalSeleccionadas = Object.values(seleccionadas).filter(Boolean).length

  const toggleColumna = (colIndex: number) => {
    setSeleccionadas(prev => ({ ...prev, [colIndex]: !prev[colIndex] }))
  }

  const handleContinuar = () => {
    const result: ColumnaSeleccionada[] = importables
      .filter(c => seleccionadas[c.col_index])
      .map(c => ({
        col_index: c.col_index,
        header_raw: c.header_raw,
        nombre_limpio: c.nombre_limpio,
        tipo: c.tipo,
        parcial: parcialesOverride[c.col_index] ?? c.parcial ?? 1,
        categoria: c.categoria,
      }))
    onContinuar(result, debeAjustar && ajustarAceptado ? maxParcialArchivo : null)
  }

  // Agrupar por parcial para mejor UX
  const porParcial = useMemo(() => {
    const grupos = new Map<number, ColumnaNota[]>()
    for (const col of importables) {
      const p = col.parcial ?? 1
      if (!grupos.has(p)) grupos.set(p, [])
      grupos.get(p)!.push(col)
    }
    return [...grupos.entries()].sort(([a], [b]) => a - b)
  }, [importables])

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso ajuste de parciales */}
      {debeAjustar && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">El archivo contiene hasta {maxParcialArchivo} parciales, pero el curso tiene configurados {numParciales}.</p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ajustarAceptado}
                onChange={e => setAjustarAceptado(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>Actualizar la configuración del curso a {maxParcialArchivo} parciales</span>
            </label>
          </div>
        </div>
      )}

      {/* Info de no importables */}
      <div className="flex gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Solo se muestran columnas importables (tareas y subtotales). Los totales y ponderaciones calculadas se excluyen automáticamente.
        </p>
      </div>

      {/* Columnas por parcial */}
      {porParcial.map(([parcial, cols]) => (
        <div key={parcial}>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Parcial {parcial}
          </h3>
          <div className="flex flex-col gap-2">
            {cols.map(col => (
              <div key={col.col_index} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={seleccionadas[col.col_index] ?? false}
                  onChange={() => toggleColumna(col.col_index)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${seleccionadas[col.col_index] ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 line-through'}`}
                     title={col.nombre_limpio}>
                    {col.nombre_limpio}
                  </p>
                  {col.categoria && (
                    <p className="text-xs text-zinc-500 mt-0.5">Categoría: {col.categoria}</p>
                  )}
                  {col.muestra_valores.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-0.5">Ej: {col.muestra_valores.slice(0, 3).join(' · ')}</p>
                  )}
                </div>
                {/* Override de parcial si no se detectó */}
                {col.parcial === null && seleccionadas[col.col_index] && (
                  <div className="shrink-0 flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">Parcial:</label>
                    <select
                      value={parcialesOverride[col.col_index] ?? 1}
                      onChange={e => setParcialesOverride(prev => ({ ...prev, [col.col_index]: parseInt(e.target.value) }))}
                      className="text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-1 py-0.5"
                    >
                      {Array.from({ length: Math.max(numParciales, maxParcialArchivo) }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>P{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Botones */}
      <div className="flex justify-between items-center pt-2">
        <button onClick={onVolver} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          ← Volver
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{totalSeleccionadas} columnas seleccionadas</span>
          <button
            onClick={handleContinuar}
            disabled={totalSeleccionadas === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Continuar
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
