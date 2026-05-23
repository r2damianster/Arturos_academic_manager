'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, FileSpreadsheet } from 'lucide-react'
import { revertirImport } from '@/lib/actions/calificaciones-import'

interface ImportRecord {
  id: string
  archivo_nombre: string
  created_at: string
  parciales_afectados: number[]
  columnas_importadas: { nombre: string; parcial: number; categoria: string | null; tipo: string }[]
  num_estudiantes_match: number
  num_estudiantes_sin_match: number
  num_celdas_creadas: number
  num_celdas_actualizadas: number
  num_celdas_sin_cambio: number
  num_celdas_preservadas: number
  revertido_at: string | null
}

interface Props {
  cursoId: string
  imports: ImportRecord[]
}

export default function HistorialImports({ cursoId, imports }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [revertidos, setRevertidos] = useState<Set<string>>(new Set())

  if (imports.length === 0) return null

  const handleRevertir = (importId: string) => {
    if (!confirm('¿Revertir este import? Se eliminarán los ítems que este import creó. Los valores actualizados en imports posteriores no se restaurarán.')) return
    startTransition(async () => {
      const { error } = await revertirImport(importId, cursoId)
      if (error) { alert(error); return }
      setRevertidos(prev => new Set([...prev, importId]))
    })
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
          Historial de imports ({imports.length})
        </span>
        {abierto ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {abierto && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {imports.map(imp => {
            const yaRevertido = revertidos.has(imp.id) || !!imp.revertido_at
            const isExp = expandido === imp.id

            return (
              <div key={imp.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-xs" title={imp.archivo_nombre}>
                        {imp.archivo_nombre}
                      </span>
                      {yaRevertido && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Revertido</span>
                      )}
                      <span className="text-xs text-zinc-400">
                        {new Date(imp.created_at).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 flex-wrap text-xs text-zinc-500">
                      <span>P{imp.parciales_afectados?.join(', P')}</span>
                      <span className="text-green-600">+{imp.num_celdas_creadas} nuevas</span>
                      <span className="text-amber-600">~{imp.num_celdas_actualizadas} actualizadas</span>
                      <span>{imp.num_estudiantes_match} estudiantes</span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setExpandido(isExp ? null : imp.id)}
                      className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {isExp ? 'Ocultar' : 'Detalle'}
                    </button>
                    {!yaRevertido && (
                      <button
                        onClick={() => handleRevertir(imp.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Revertir
                      </button>
                    )}
                  </div>
                </div>

                {isExp && (
                  <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-600 dark:text-zinc-400">
                    <p className="font-medium mb-2">Columnas importadas ({imp.columnas_importadas?.length ?? 0}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(imp.columnas_importadas ?? []).map((col, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                          P{col.parcial} · {col.nombre}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Celdas nuevas', val: imp.num_celdas_creadas, color: 'text-green-600' },
                        { label: 'Actualizadas', val: imp.num_celdas_actualizadas, color: 'text-amber-600' },
                        { label: 'Sin cambio', val: imp.num_celdas_sin_cambio, color: 'text-zinc-500' },
                        { label: 'Preservadas (Moodle vacío)', val: imp.num_celdas_preservadas, color: 'text-blue-600' },
                        { label: 'Estudiantes encontrados', val: imp.num_estudiantes_match, color: 'text-zinc-700' },
                        { label: 'Estudiantes sin match', val: imp.num_estudiantes_sin_match, color: 'text-red-500' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex justify-between">
                          <span>{label}:</span>
                          <span className={`font-medium ${color}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
