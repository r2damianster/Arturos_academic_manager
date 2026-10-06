'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Trash2, MessageSquare, ClipboardCopy } from 'lucide-react'
import { upsertItemManual, eliminarItem } from '@/lib/actions/calificaciones-items'
import { ComentarioCelda, CopiarComentariosModal } from './comentario-celda'

const NOTA_MAXIMA = 10

interface CalItem {
  id: string
  estudiante_id: string
  parcial: number
  categoria: string | null
  nombre_item: string
  tipo: string
  nota: number | null
  comentario: string | null
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
  const [comentarioAbierto, setComentarioAbierto] = useState<{ estudianteId: string; nombreItem: string } | null>(null)
  const [columnaParaCopiar, setColumnaParaCopiar] = useState<string | null>(null)
  const [soloSinComentario, setSoloSinComentario] = useState(false)
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

  // Nota por debajo del máximo y sin comentario → pendiente de explicar "qué falta"
  const necesitaComentario = (item: CalItem | undefined) =>
    !!item && item.nota !== null && item.nota < NOTA_MAXIMA && !item.comentario?.trim()

  const estudiantesVisibles = soloSinComentario
    ? estudiantes.filter(est => nombresItems.some(ni => necesitaComentario(indice.get(`${est.id}|${ni}`))))
    : estudiantes

  const filasComentariosDeColumna = (nombreItem: string) =>
    estudiantes.flatMap(est => {
      const comentario = indice.get(`${est.id}|${nombreItem}`)?.comentario?.trim()
      return comentario ? [{ estudianteNombre: est.nombre, comentario }] : []
    })

  const handleEliminarColumna = (nombreItem: string) => {
    const cantidadComentarios = filasComentariosDeColumna(nombreItem).length
    const avisoComentarios = cantidadComentarios > 0 ? ` Se perderán también ${cantidadComentarios} comentario(s).` : ''
    if (!confirm(`¿Eliminar la columna "${nombreItem}" y todas sus notas en este parcial?${avisoComentarios}`)) return
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
          <p className="text-gray-400 text-sm">No hay calificaciones importadas para el Parcial {parcialActivo}.</p>
          <p className="text-gray-400 text-xs mt-1">Usa el botón "Importar de Moodle" para cargar calificaciones desde un archivo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de parcial */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ParcialSelector parcialActivo={parcialActivo} numParciales={numParciales} onChange={setParcialActivo} />
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
          <input
            type="checkbox"
            checked={soloSinComentario}
            onChange={e => setSoloSinComentario(e.target.checked)}
          />
          Solo con nota &lt; {NOTA_MAXIMA} sin comentario
        </label>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border border-gray-700">
        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="text-left px-4 py-2.5 font-medium text-gray-400 border-b border-gray-700 sticky left-0 bg-gray-800">
                Estudiante
              </th>
              {nombresItems.map(ni => {
                const tipo = itemsFiltrados.find(i => i.nombre_item === ni)?.tipo
                return (
                  <th key={ni} className="px-2 py-2.5 border-b border-l border-gray-700 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-400 max-w-[120px] truncate" title={ni}>{ni}</span>
                      {tipo === 'subtotal_categoria' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400">Subtotal</span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setColumnaParaCopiar(ni)}
                          title="Copiar comentarios de la columna"
                          className="text-gray-300 hover:text-blue-400 transition-colors"
                        >
                          <ClipboardCopy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleEliminarColumna(ni)}
                          title="Eliminar columna"
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {estudiantesVisibles.map(est => (
              <tr key={est.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-2 font-medium text-gray-300 sticky left-0 bg-gray-900 border-r border-gray-800 whitespace-nowrap">
                  {est.nombre}
                </td>
                {nombresItems.map(ni => {
                  const item = indice.get(`${est.id}|${ni}`)
                  const esteEditando = editando?.itemId === (item?.id ?? `${est.id}|${ni}`)
                  const tieneComentario = !!item?.comentario?.trim()
                  const comentarioEstaAbierto =
                    comentarioAbierto?.estudianteId === est.id && comentarioAbierto?.nombreItem === ni

                  const botonComentario = (
                    <button
                      onClick={() => setComentarioAbierto({ estudianteId: est.id, nombreItem: ni })}
                      title={tieneComentario ? item!.comentario! : 'Agregar comentario (qué falta)'}
                      className={`transition-opacity ${
                        tieneComentario
                          ? 'text-blue-400'
                          : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-400'
                      }`}
                    >
                      <MessageSquare className={`h-3 w-3 ${tieneComentario ? 'fill-current' : ''}`} />
                    </button>
                  )

                  return (
                    <td key={ni} className="relative border-l border-gray-800 text-center px-2 py-1.5">
                      {comentarioEstaAbierto && (
                        <ComentarioCelda
                          cursoId={cursoId}
                          estudianteId={est.id}
                          estudianteNombre={est.nombre}
                          parcial={parcialActivo}
                          nombreItem={ni}
                          comentarioInicial={item?.comentario ?? null}
                          onClose={() => setComentarioAbierto(null)}
                        />
                      )}
                      {esteEditando ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            min={0} max={10} step={0.01}
                            value={editando!.nota}
                            onChange={e => setEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                            className="w-16 text-center text-xs rounded border border-gray-600 bg-gray-800 px-1 py-0.5"
                            autoFocus
                          />
                          <button
                            onClick={() => item && handleGuardar(item, editando!.nota)}
                            disabled={isPending}
                            className="text-green-400 hover:text-green-400"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <span className="group">{botonComentario}</span>
                          <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-400">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : item ? (
                        <div className="flex items-center gap-1 justify-center group">
                          <span className={`font-mono ${item.nota === null ? 'text-gray-300' : 'text-gray-200'}`}>
                            {item.nota === null ? '—' : item.nota.toFixed(2)}
                          </span>
                          <button
                            onClick={() => setEditando({ itemId: item.id, nota: item.nota?.toString() ?? '' })}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-400 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {botonComentario}
                          {necesitaComentario(item) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Nota menor al máximo sin comentario" />
                          )}
                          <button
                            onClick={() => {
                              const avisoComentario = tieneComentario ? ' Se perderá también su comentario.' : ''
                              if (!confirm(`¿Eliminar la nota de "${item.nombre_item}" para este estudiante?${avisoComentario}`)) return
                              startTransition(async () => { await eliminarItem(item.id, cursoId) })
                            }}
                            title="Eliminar esta nota"
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {item.fuente === 'manual' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Editado manualmente" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-center group">
                          <span className="text-gray-300 text-xs">—</span>
                          {botonComentario}
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

      <p className="text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" /> Editado manualmente</span>
        {' · '}<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Nota &lt; {NOTA_MAXIMA} sin comentario</span>
        {' · '}Hover sobre la nota para editar inline; 💬 para registrar qué falta. Los subtotales (en azul) son calculados por Moodle e importados; los totales finales se calculan automáticamente en la pestaña Resumen.
      </p>

      {columnaParaCopiar && (
        <CopiarComentariosModal
          nombreItem={columnaParaCopiar}
          parcial={parcialActivo}
          filas={filasComentariosDeColumna(columnaParaCopiar)}
          onClose={() => setColumnaParaCopiar(null)}
        />
      )}
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
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Parcial {p}
        </button>
      ))}
    </div>
  )
}
