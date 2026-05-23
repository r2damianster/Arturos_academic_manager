'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Trash2, Plus } from 'lucide-react'
import {
  upsertItemEnCurso,
  eliminarItem,
  crearColumnaEnCurso,
  renombrarColumnaEnCurso,
  eliminarColumnaEnCurso,
} from '@/lib/actions/calificaciones-items'

interface CalItem {
  id: string
  estudiante_id: string
  parcial: number
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

export default function EnCursoTab({ cursoId, items, estudiantes, numParciales }: Props) {
  const [parcialActivo, setParcialActivo] = useState(1)
  const [editando, setEditando] = useState<{ itemId: string; nota: string } | null>(null)
  const [renombrando, setRenombrando] = useState<string | null>(null)
  const [renombreValor, setRenombreValor] = useState('')
  const [nuevaActividad, setNuevaActividad] = useState('')
  const [mostrarInput, setMostrarInput] = useState(false)
  const [isPending, startTransition] = useTransition()

  const itemsFiltrados = items.filter(i => i.parcial === parcialActivo && i.fuente === 'en_curso')

  const nombresActividades: string[] = [...new Set(itemsFiltrados.map(i => i.nombre_item))].sort()

  const indice = new Map<string, CalItem>()
  for (const item of itemsFiltrados) {
    indice.set(`${item.estudiante_id}|${item.nombre_item}`, item)
  }

  const handleGuardar = (estudianteId: string, nombreItem: string, notaStr: string) => {
    const nota = notaStr === '' ? null : parseFloat(notaStr)
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) return
    startTransition(async () => {
      await upsertItemEnCurso({ cursoId, estudianteId, parcial: parcialActivo, nombreItem, nota })
      setEditando(null)
    })
  }

  const handleEliminarCelda = (itemId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return
    startTransition(async () => { await eliminarItem(itemId, cursoId) })
  }

  const handleEliminarColumna = (nombreActividad: string) => {
    if (!confirm(`¿Eliminar la actividad "${nombreActividad}" y todas sus notas en el Parcial ${parcialActivo}?`)) return
    startTransition(async () => {
      await eliminarColumnaEnCurso({ cursoId, parcial: parcialActivo, nombreActividad })
    })
  }

  const handleRenombrar = (nombreAnterior: string) => {
    if (!renombreValor.trim() || renombreValor.trim() === nombreAnterior) { setRenombrando(null); return }
    startTransition(async () => {
      await renombrarColumnaEnCurso({ cursoId, parcial: parcialActivo, nombreAnterior, nombreNuevo: renombreValor.trim() })
      setRenombrando(null)
    })
  }

  const handleAgregarActividad = () => {
    if (!nuevaActividad.trim()) return
    startTransition(async () => {
      await crearColumnaEnCurso({
        cursoId,
        parcial: parcialActivo,
        nombreActividad: nuevaActividad.trim(),
        estudianteIds: estudiantes.map(e => e.id),
      })
      setNuevaActividad('')
      setMostrarInput(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de parcial */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {Array.from({ length: numParciales }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setParcialActivo(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                parcialActivo === p
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Parcial {p}
            </button>
          ))}
        </div>

        {/* Botón agregar actividad */}
        {mostrarInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nuevaActividad}
              onChange={e => setNuevaActividad(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAgregarActividad(); if (e.key === 'Escape') setMostrarInput(false) }}
              placeholder="Nombre de la actividad (ej: Exposición 1)"
              className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />
            <button
              onClick={handleAgregarActividad}
              disabled={isPending || !nuevaActividad.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              <Check className="h-4 w-4" />
              Agregar
            </button>
            <button onClick={() => setMostrarInput(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva actividad
          </button>
        )}
      </div>

      {nombresActividades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-zinc-500 text-sm">Sin actividades en el Parcial {parcialActivo}.</p>
          <p className="text-zinc-400 text-xs mt-1">Usa "Nueva actividad" para agregar exposiciones, trabajos en clase u otras actividades en curso.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 sticky left-0 bg-zinc-50 dark:bg-zinc-800">
                  Estudiante
                </th>
                {nombresActividades.map(nombre => (
                  <th key={nombre} className="px-2 py-2.5 border-b border-l border-zinc-200 dark:border-zinc-700 text-center min-w-[130px]">
                    <div className="flex flex-col items-center gap-1">
                      {renombrando === nombre ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renombreValor}
                            onChange={e => setRenombreValor(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenombrar(nombre); if (e.key === 'Escape') setRenombrando(null) }}
                            className="w-28 text-xs rounded border border-violet-400 px-1 py-0.5 focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleRenombrar(nombre)} className="text-green-600 hover:text-green-700"><Check className="h-3 w-3" /></button>
                          <button onClick={() => setRenombrando(null)} className="text-zinc-400 hover:text-zinc-600"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRenombrando(nombre); setRenombreValor(nombre) }}
                          title="Clic para renombrar"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400 max-w-[120px] truncate hover:text-violet-600 transition-colors"
                        >
                          {nombre}
                        </button>
                      )}
                      <button
                        onClick={() => handleEliminarColumna(nombre)}
                        title="Eliminar actividad"
                        className="text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estudiantes.map(est => (
                <tr key={est.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap">
                    {est.nombre}
                  </td>
                  {nombresActividades.map(nombre => {
                    const item = indice.get(`${est.id}|${nombre}`)
                    const editKey = item ? item.id : `${est.id}|${nombre}`
                    const esteEditando = editando?.itemId === editKey

                    return (
                      <td key={nombre} className="border-l border-zinc-100 dark:border-zinc-800 text-center px-2 py-1.5">
                        {esteEditando ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              min={0} max={10} step={0.01}
                              value={editando!.nota}
                              onChange={e => setEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleGuardar(est.id, nombre, editando!.nota)
                                if (e.key === 'Escape') setEditando(null)
                              }}
                              className="w-16 text-center text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-1 py-0.5"
                              autoFocus
                            />
                            <button onClick={() => handleGuardar(est.id, nombre, editando!.nota)} disabled={isPending} className="text-green-600 hover:text-green-700">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditando(null)} className="text-zinc-400 hover:text-zinc-600">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center group">
                            <span
                              className={`font-mono cursor-pointer ${item?.nota == null ? 'text-zinc-300' : 'text-zinc-800 dark:text-zinc-200'}`}
                              onClick={() => setEditando({ itemId: editKey, nota: item?.nota?.toString() ?? '' })}
                              title="Clic para editar"
                            >
                              {item?.nota == null ? '—' : item.nota.toFixed(2)}
                            </span>
                            <button
                              onClick={() => setEditando({ itemId: editKey, nota: item?.nota?.toString() ?? '' })}
                              className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-violet-600 transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {item && (
                              <button
                                onClick={() => handleEliminarCelda(item.id)}
                                title="Eliminar esta nota"
                                className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Actividades en curso — exposiciones, trabajos entregados en clase, evaluaciones parciales no gestionadas en Moodle.
        Clic en el nombre de la columna para renombrarlo. Estas notas <strong>no se usan</strong> en el análisis IA (que solo usa notas Moodle).
      </p>
    </div>
  )
}
