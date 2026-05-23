'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Trash2 } from 'lucide-react'
import { upsertItemManual, eliminarItem } from '@/lib/actions/calificaciones-items'

interface CalItem {
  id: string
  estudiante_id: string
  parcial: number
  categoria: string | null
  nombre_item: string
  tipo: string
  nota: number | null
  fuente: string
  updated_at: string
}

interface Estudiante {
  id: string
  nombre: string
}

interface Props {
  cursoId: string
  items: CalItem[]
  estudiantes: Estudiante[]
  numParciales: number
}

export default function ItemsTab({ cursoId, items, estudiantes, numParciales }: Props) {
  const [parcialActivo, setParcialActivo] = useState(1)
  const [editando, setEditando] = useState<{ itemId: string; nota: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const itemsFiltrados = items.filter(i => i.parcial === parcialActivo)

  // Columnas únicas del parcial activo, ordenadas por tipo y nombre
  const nombresItems: string[] = [...new Set(itemsFiltrados.map(i => i.nombre_item))].sort((a, b) => {
    // Tareas antes que subtotales
    const tipoA = items.find(x => x.nombre_item === a)?.tipo ?? 'otro'
    const tipoB = items.find(x => x.nombre_item === b)?.tipo ?? 'otro'
    if (tipoA !== tipoB) return tipoA === 'tarea' ? -1 : 1
    return a.localeCompare(b)
  })

  // Índice: estudianteId-nombre_item → item
  const indice = new Map<string, CalItem>()
  for (const item of itemsFiltrados) {
    indice.set(`${item.estudiante_id}|${item.nombre_item}`, item)
  }

  const handleGuardar = (item: CalItem, notaStr: string) => {
    const nota = notaStr === '' ? null : parseFloat(notaStr)
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) return
    startTransition(async () => {
      await upsertItemManual({
        cursoId,
        estudianteId: item.estudiante_id,
        parcial: item.parcial,
        nombreItem: item.nombre_item,
        categoria: item.categoria,
        tipo: item.tipo as any,
        nota,
      })
      setEditando(null)
    })
  }

  const handleEliminarColumna = (nombreItem: string) => {
    if (!confirm(`¿Eliminar la columna "${nombreItem}" y todas sus notas en este parcial?`)) return
    const idsAEliminar = itemsFiltrados.filter(i => i.nombre_item === nombreItem).map(i => i.id)
    startTransition(async () => {
      for (const id of idsAEliminar) await eliminarItem(id, cursoId)
    })
  }

  if (itemsFiltrados.length === 0 && numParciales > 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Selector de parcial */}
        <ParcialSelector parcialActivo={parcialActivo} numParciales={numParciales} onChange={setParcialActivo} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-zinc-500 text-sm">No hay calificaciones importadas para el Parcial {parcialActivo}.</p>
          <p className="text-zinc-400 text-xs mt-1">Usa el botón "Importar de Moodle" para cargar calificaciones desde un archivo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de parcial */}
      <ParcialSelector parcialActivo={parcialActivo} numParciales={numParciales} onChange={setParcialActivo} />

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800">
              <th className="text-left px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 sticky left-0 bg-zinc-50 dark:bg-zinc-800">
                Estudiante
              </th>
              {nombresItems.map(ni => {
                const tipo = itemsFiltrados.find(i => i.nombre_item === ni)?.tipo
                return (
                  <th key={ni} className="px-2 py-2.5 border-b border-l border-zinc-200 dark:border-zinc-700 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 max-w-[120px] truncate" title={ni}>{ni}</span>
                      {tipo === 'subtotal_categoria' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Subtotal</span>
                      )}
                      <button
                        onClick={() => handleEliminarColumna(ni)}
                        title="Eliminar columna"
                        className="text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {estudiantes.map(est => (
              <tr key={est.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                <td className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap">
                  {est.nombre}
                </td>
                {nombresItems.map(ni => {
                  const item = indice.get(`${est.id}|${ni}`)
                  const esteEditando = editando?.itemId === (item?.id ?? `${est.id}|${ni}`)

                  return (
                    <td key={ni} className="border-l border-zinc-100 dark:border-zinc-800 text-center px-2 py-1.5">
                      {esteEditando ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            min={0} max={10} step={0.01}
                            value={editando!.nota}
                            onChange={e => setEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                            className="w-16 text-center text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-1 py-0.5"
                            autoFocus
                          />
                          <button
                            onClick={() => item && handleGuardar(item, editando!.nota)}
                            disabled={isPending}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditando(null)} className="text-zinc-400 hover:text-zinc-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : item ? (
                        <div className="flex items-center gap-1 justify-center group">
                          <span className={`font-mono ${item.nota === null ? 'text-zinc-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {item.nota === null ? '—' : item.nota.toFixed(2)}
                          </span>
                          <button
                            onClick={() => setEditando({ itemId: item.id, nota: item.nota?.toString() ?? '' })}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {item.fuente === 'manual' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Editado manualmente" />
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" /> Editado manualmente</span>
        {' · '}Hover sobre la nota para editar inline. Los subtotales (en azul) son calculados por Moodle e importados; los totales finales se calculan automáticamente en la pestaña Resumen.
      </p>
    </div>
  )
}

function ParcialSelector({ parcialActivo, numParciales, onChange }: { parcialActivo: number; numParciales: number; onChange: (p: number) => void }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: numParciales }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            parcialActivo === p
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          Parcial {p}
        </button>
      ))}
    </div>
  )
}
