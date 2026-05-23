'use client'

import { useState, useTransition } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { formatNombreCorto } from '@/lib/format'
import { upsertItemEnCurso } from '@/lib/actions/calificaciones-items'

interface CalItem {
  estudiante_id: string
  parcial: number
  nombre_item: string
  nota: number | null
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

function notaColor(nota: number | null) {
  if (nota === null) return 'text-gray-600'
  if (nota >= 7) return 'text-emerald-400'
  if (nota >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function pctColor(pct: number) {
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

export default function EnCursoVistaClase({ cursoId, items, estudiantes, numParciales }: Props) {
  const [parcial, setParcial] = useState(1)
  const [sortPor, setSortPor] = useState<'nombre' | 'pct'>('nombre')
  const [editando, setEditando] = useState<{ estudianteId: string; nombre: string; nota: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtrados = items.filter(i => i.parcial === parcial)
  const actividades = [...new Set(filtrados.map(i => i.nombre_item))].sort()

  const indice = new Map<string, number | null>()
  for (const item of filtrados) {
    indice.set(`${item.estudiante_id}|${item.nombre_item}`, item.nota)
  }

  if (actividades.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <ParcialSelector parcial={parcial} numParciales={numParciales} onChange={setParcial} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-xs text-center px-4">
            Sin actividades "En Curso" para el Parcial {parcial}.
            <br />Crea actividades desde la pestaña Calificaciones → En Curso.
          </p>
        </div>
      </div>
    )
  }

  const conResumen = estudiantes.map(est => {
    const conNota = actividades.filter(a => indice.get(`${est.id}|${a}`) !== null && indice.get(`${est.id}|${a}`) !== undefined).length
    const notas = actividades.map(a => indice.get(`${est.id}|${a}`)).filter((n): n is number => n !== null && n !== undefined)
    const promedio = notas.length > 0 ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null
    const pct = actividades.length > 0 ? Math.round(conNota / actividades.length * 100) : 0
    return { est, conNota, pct, promedio }
  })

  const sorted = [...conResumen].sort((a, b) =>
    sortPor === 'pct' ? a.pct - b.pct : a.est.nombre.localeCompare(b.est.nombre)
  )

  const handleGuardar = (estudianteId: string, nombreItem: string, notaStr: string) => {
    const nota = notaStr === '' ? null : parseFloat(notaStr)
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) return
    startTransition(async () => {
      await upsertItemEnCurso({ cursoId, estudianteId, parcial, nombreItem, nota })
      setEditando(null)
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 pt-2 pb-2 border-b border-gray-800 space-y-2">
        <ParcialSelector parcial={parcial} numParciales={numParciales} onChange={setParcial} />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-600">Ordenar:</span>
          <button
            onClick={() => setSortPor('nombre')}
            className={`text-xs px-2 py-0.5 rounded ${sortPor === 'nombre' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Nombre
          </button>
          <button
            onClick={() => setSortPor('pct')}
            className={`text-xs px-2 py-0.5 rounded ${sortPor === 'pct' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
          >
            % Completado ↑
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left px-3 py-2 font-medium text-gray-500 sticky left-0 bg-gray-900 whitespace-nowrap">
                Estudiante
              </th>
              {actividades.map(a => (
                <th key={a} className="px-2 py-2 text-center font-medium text-gray-500 max-w-[80px]">
                  <span className="truncate block max-w-[72px]" title={a}>{a}</span>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-gray-500 whitespace-nowrap">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ est, conNota, pct }) => (
              <tr key={est.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-1.5 sticky left-0 bg-gray-900 font-medium text-gray-300 whitespace-nowrap">
                  {formatNombreCorto(est.nombre)}
                </td>
                {actividades.map(nombre => {
                  const nota = indice.get(`${est.id}|${nombre}`) ?? null
                  const esteEditando = editando?.estudianteId === est.id && editando?.nombre === nombre

                  return (
                    <td key={nombre} className="px-1 py-1 text-center">
                      {esteEditando ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          <input
                            type="number"
                            min={0} max={10} step={0.01}
                            value={editando!.nota}
                            onChange={e => setEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleGuardar(est.id, nombre, editando!.nota)
                              if (e.key === 'Escape') setEditando(null)
                            }}
                            className="w-12 text-center text-xs rounded border border-gray-600 bg-gray-800 text-gray-100 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            autoFocus
                          />
                          <button onClick={() => handleGuardar(est.id, nombre, editando!.nota)} disabled={isPending} className="text-green-400 hover:text-green-300">
                            <Check className="h-3 w-3" />
                          </button>
                          <button onClick={() => setEditando(null)} className="text-gray-600 hover:text-gray-400">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditando({ estudianteId: est.id, nombre, nota: nota?.toString() ?? '' })}
                          className={`group flex items-center gap-0.5 mx-auto font-mono hover:opacity-80 transition-opacity ${notaColor(nota)}`}
                          title="Clic para editar"
                        >
                          {nota === null ? '—' : nota.toFixed(1)}
                          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                        </button>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                  <span className={`font-medium ${pctColor(pct)}`}>
                    {conNota}/{actividades.length}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParcialSelector({ parcial, numParciales, onChange }: { parcial: number; numParciales: number; onChange: (p: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: numParciales }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            parcial === p ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
          }`}
        >
          P{p}
        </button>
      ))}
    </div>
  )
}
