'use client'

import { useEffect, useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import {
  calcularPreviewImport,
  confirmarImportCalificaciones,
  type ColumnaSeleccionada,
  type MatchEstudiante,
  type PreviewImport,
  type CeldaPreview,
} from '@/lib/actions/calificaciones-import'

interface Props {
  cursoId: string
  archivoNombre: string
  hashArchivo?: string
  fechaDescargaMoodle: Date | null
  columnas: ColumnaSeleccionada[]
  matches: MatchEstudiante[]
  valores: Record<string, Record<number, number | null>>
  ajustarNumParciales: number | null
  preview: PreviewImport | null
  onPreviewCargado: (p: PreviewImport) => void
  onImportado: (importId: string) => void
  onVolver: () => void
}

type EstadoImport = 'idle' | 'cargando_preview' | 'listo' | 'importando' | 'error'

const ESTADO_COLORS: Record<CeldaPreview['estado'], string> = {
  nueva:       'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  actualizada: 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  sin_cambio:  'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
  preservada:  'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
}

export default function Paso5Preview({
  cursoId, archivoNombre, hashArchivo, fechaDescargaMoodle,
  columnas, matches, valores, ajustarNumParciales,
  preview, onPreviewCargado, onImportado, onVolver
}: Props) {
  const [estado, setEstado] = useState<EstadoImport>(preview ? 'listo' : 'cargando_preview')
  const [error, setError] = useState<string | null>(null)
  const [soloConCambios, setSoloConCambios] = useState(false)

  useEffect(() => {
    if (preview) { setEstado('listo'); return }
    calcularPreviewImport(cursoId, columnas, matches, valores).then(({ preview: p, error: e }) => {
      if (e || !p) { setError(e ?? 'Error al calcular preview'); setEstado('error'); return }
      onPreviewCargado(p)
      setEstado('listo')
    })
  }, [])

  const handleConfirmar = async () => {
    setEstado('importando')
    setError(null)
    const { importId, error: e } = await confirmarImportCalificaciones({
      cursoId,
      archivoNombre,
      hashArchivo,
      fechaDescargaMoodle,
      columnas,
      matches,
      valores,
      ajustarNumParciales,
    })
    if (e || !importId) { setError(e ?? 'Error desconocido'); setEstado('error'); return }
    onImportado(importId)
  }

  if (estado === 'cargando_preview') {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-500">Calculando comparación antes/después…</p>
      </div>
    )
  }

  if (estado === 'importando') {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-500">Guardando calificaciones…</p>
      </div>
    )
  }

  if (!preview) return null

  // Agrupar celdas por estudiante
  const porEstudiante = new Map<string, CeldaPreview[]>()
  for (const c of preview.celdas) {
    if (!porEstudiante.has(c.estudiante_id)) porEstudiante.set(c.estudiante_id, [])
    porEstudiante.get(c.estudiante_id)!.push(c)
  }

  const nombresItems = [...new Set(preview.celdas.map(c => `P${c.parcial}·${c.nombre_item}`))]

  const celdaFiltrada = (celdas: CeldaPreview[]) =>
    soloConCambios ? celdas.filter(c => c.estado !== 'sin_cambio') : celdas

  return (
    <div className="flex flex-col gap-5">
      {/* Resumen estadístico */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Nuevas', val: preview.num_celdas_creadas, color: 'text-green-600' },
          { label: 'Actualizadas', val: preview.num_celdas_actualizadas, color: 'text-amber-600' },
          { label: 'Sin cambio', val: preview.num_celdas_sin_cambio, color: 'text-zinc-500' },
          { label: 'Preservadas', val: preview.num_celdas_preservadas, color: 'text-blue-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col items-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <span className={`text-2xl font-bold ${color}`}>{val}</span>
            <span className="text-xs text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>{preview.num_estudiantes_match}</strong> estudiantes con match ·{' '}
        <strong className="text-red-600">{preview.num_estudiantes_sin_match}</strong> sin match (se omitirán)
      </p>

      {/* Toggle */}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={soloConCambios} onChange={e => setSoloConCambios(e.target.checked)} className="h-4 w-4 rounded" />
        Mostrar solo celdas con cambios
      </label>

      {/* Tabla comparativa */}
      <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700 max-h-[38vh]">
        <table className="text-xs w-full border-collapse">
          <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                Estudiante
              </th>
              {nombresItems.map(ni => (
                <th key={ni} className="text-center px-2 py-2 font-medium text-zinc-600 dark:text-zinc-400 border-b border-l border-zinc-200 dark:border-zinc-700 max-w-[120px]">
                  <div className="truncate max-w-[100px]" title={ni}>{ni}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...porEstudiante.entries()].map(([estId, celdas]) => {
              const filtradas = celdaFiltrada(celdas)
              if (soloConCambios && filtradas.length === 0) return null
              const nombre = celdas[0]?.nombre_estudiante ?? estId

              return (
                <tr key={estId} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {nombre}
                  </td>
                  {nombresItems.map(ni => {
                    const celda = celdas.find(c => `P${c.parcial}·${c.nombre_item}` === ni)
                    if (!celda) return <td key={ni} className="border-l border-zinc-100 dark:border-zinc-800 text-center px-2 py-2 text-zinc-300">—</td>

                    return (
                      <td key={ni} className={`border-l border-zinc-100 dark:border-zinc-800 text-center px-2 py-2`}>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[celda.estado]}`}>
                          {celda.estado === 'nueva' && (celda.nota_despues ?? '—')}
                          {celda.estado === 'actualizada' && (
                            <>{celda.nota_antes}<ArrowRight className="h-3 w-3" />{celda.nota_despues}</>
                          )}
                          {celda.estado === 'sin_cambio' && (celda.nota_antes ?? '—')}
                          {celda.estado === 'preservada' && <span title="Moodle sin nota, valor existente preservado">✋{celda.nota_antes}</span>}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { color: 'bg-green-100 text-green-800', label: 'Nueva' },
          { color: 'bg-amber-100 text-amber-800', label: 'Actualizada' },
          { color: 'bg-zinc-100 text-zinc-500', label: 'Sin cambio' },
          { color: 'bg-blue-100 text-blue-800', label: '✋ Preservada (Moodle vacío sobre valor existente)' },
        ].map(({ color, label }) => (
          <span key={label} className={`px-2 py-0.5 rounded-full ${color}`}>{label}</span>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-between items-center pt-2">
        <button onClick={onVolver} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          ← Volver
        </button>
        <button
          onClick={handleConfirmar}
          disabled={preview.num_celdas_creadas + preview.num_celdas_actualizadas === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          <Check className="h-4 w-4" />
          Confirmar import
        </button>
      </div>
    </div>
  )
}
