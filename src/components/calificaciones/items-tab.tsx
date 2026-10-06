'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Pencil, Check, X, Trash2, MessageSquare, ClipboardCopy, Plus, ChevronRight, ChevronDown, RefreshCw, Settings2,
} from 'lucide-react'
import { upsertItemManual, eliminarItem } from '@/lib/actions/calificaciones-items'
import {
  crearColumnaManual, eliminarRubrica, recalcularRubrica, type RubricaGuardada,
} from '@/lib/actions/rubricas'
import {
  borradorComentarioDesdeResultado, calcularRubrica, redondear, type ResultadoRubrica,
} from '@/lib/rubrica-calculo'
import { armarDatosPorEstudiante } from '@/lib/rubrica-datos'
import { ComentarioCelda, CopiarComentariosModal } from './comentario-celda'
import { RubricaEditor, type ItemDisponible } from './rubrica-editor'
import type { ParticipacionRecord } from './participacion-grid'

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
  /** Columnas visibles: Moodle, manuales y de rúbrica. */
  items: CalItem[]
  /** Notas que pueden alimentar una rúbrica (Moodle, manuales y en curso; nunca otras rúbricas). */
  itemsFuente: CalItem[]
  estudiantes: Estudiante[]
  numParciales: number
  rubricas: RubricaGuardada[]
  participacion: ParticipacionRecord[]
  mapaAsistencia: Record<string, Record<string, { estado: string }>>
  fechasClase: string[]
}

export default function ItemsTab({
  cursoId, items, itemsFuente, estudiantes, numParciales, rubricas, participacion, mapaAsistencia, fechasClase,
}: Props) {
  const [parcialActivo, setParcialActivo] = useState(1)
  const [editando, setEditando] = useState<{ itemId: string; nota: string } | null>(null)
  const [comentarioAbierto, setComentarioAbierto] = useState<{ estudianteId: string; nombreItem: string } | null>(null)
  const [columnaParaCopiar, setColumnaParaCopiar] = useState<string | null>(null)
  const [soloSinComentario, setSoloSinComentario] = useState(false)
  const [menuNotaAbierto, setMenuNotaAbierto] = useState(false)
  const [creandoManual, setCreandoManual] = useState(false)
  const [nombreManual, setNombreManual] = useState('')
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null)
  const [editorRubrica, setEditorRubrica] = useState<{ rubrica?: RubricaGuardada } | null>(null)
  const [estudiantesExpandidos, setEstudiantesExpandidos] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const itemsFiltrados = items.filter(i => i.parcial === parcialActivo)

  // Una rúbrica guardada siempre muestra su columna, aunque aún no tenga notas calculadas
  const nombresColumnasRubrica = rubricas
    .filter(rubrica => rubrica.parcial === parcialActivo)
    .map(rubrica => rubrica.nombre_columna)

  // Columnas únicas del parcial activo, ordenadas por tipo y nombre
  const nombresItems: string[] = [...new Set([...itemsFiltrados.map(i => i.nombre_item), ...nombresColumnasRubrica])].sort((a, b) => {
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

  // ── Rúbricas ──────────────────────────────────────────────────────────────
  const rubricasDelParcial = rubricas.filter(rubrica => rubrica.parcial === parcialActivo)
  const rubricaPorColumna = new Map(rubricasDelParcial.map(rubrica => [rubrica.nombre_columna, rubrica]))

  const datosPorEstudiante = useMemo(
    () =>
      armarDatosPorEstudiante({
        estudianteIds: estudiantes.map(estudiante => estudiante.id),
        itemsFuente,
        participacion,
        mapaAsistencia,
      }),
    [estudiantes, itemsFuente, participacion, mapaAsistencia]
  )

  const itemsDisponibles: ItemDisponible[] = useMemo(() => {
    const unicos = new Map<string, ItemDisponible>()
    for (const item of itemsFuente) {
      unicos.set(`${item.parcial}|${item.nombre_item}`, { nombre: item.nombre_item, parcial: item.parcial, fuente: item.fuente })
    }
    return [...unicos.values()].sort((a, b) => a.parcial - b.parcial || a.nombre.localeCompare(b.nombre))
  }, [itemsFuente])

  // Resultado en vivo (con el desglose) de cada rúbrica del parcial para cada estudiante
  const resultadosEnVivo = useMemo(() => {
    const resultados = new Map<string, ResultadoRubrica>()
    for (const rubrica of rubricasDelParcial) {
      for (const estudiante of estudiantes) {
        resultados.set(
          `${estudiante.id}|${rubrica.nombre_columna}`,
          calcularRubrica(
            rubrica.definicion,
            datosPorEstudiante.get(estudiante.id) ?? { items: [], participacion: [], asistencia: [] },
            { fechasClase },
            rubrica.escala_salida ?? undefined
          )
        )
      }
    }
    return resultados
  }, [rubricasDelParcial, estudiantes, datosPorEstudiante, fechasClase])

  const maximoDeColumna = (nombreColumna: string): number => {
    const rubrica = rubricaPorColumna.get(nombreColumna)
    if (!rubrica) return NOTA_MAXIMA
    return rubrica.escala_salida ?? redondear(rubrica.definicion.criterios.reduce((suma, criterio) => suma + criterio.puntosMax, 0))
  }

  const estaDesactualizada = (estudianteId: string, nombreColumna: string, item: CalItem | undefined): boolean => {
    const enVivo = resultadosEnVivo.get(`${estudianteId}|${nombreColumna}`)
    if (!enVivo) return false
    return !item || item.nota === null || Math.abs(Number(item.nota) - enVivo.notaSalida) > 0.005
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
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

  const handleCrearManual = () => {
    setErrorMensaje(null)
    startTransition(async () => {
      const resultado = await crearColumnaManual({ cursoId, parcial: parcialActivo, nombreColumna: nombreManual })
      if (resultado.error) {
        setErrorMensaje(resultado.error)
        return
      }
      setNombreManual('')
      setCreandoManual(false)
    })
  }

  const handleRecalcular = (rubrica: RubricaGuardada) => {
    setErrorMensaje(null)
    startTransition(async () => {
      const resultado = await recalcularRubrica(rubrica.id)
      if (resultado.error) setErrorMensaje(resultado.error)
    })
  }

  // Nota por debajo del máximo de su columna y sin comentario → pendiente de explicar "qué falta"
  const necesitaComentario = (item: CalItem | undefined) =>
    !!item && item.nota !== null && Number(item.nota) < maximoDeColumna(item.nombre_item) && !item.comentario?.trim()

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
    const avisoComentarios = cantidadComentarios > 0 ? ` Se conservarán las ${cantidadComentarios} celda(s) con comentario, sin nota.` : ''
    const rubrica = rubricaPorColumna.get(nombreItem)

    if (rubrica) {
      if (!confirm(`¿Eliminar la rúbrica "${nombreItem}" y sus notas calculadas?${avisoComentarios}`)) return
      startTransition(async () => {
        const resultado = await eliminarRubrica(rubrica.id)
        if (resultado.error) setErrorMensaje(resultado.error)
      })
      return
    }

    const avisoPerdida = cantidadComentarios > 0 ? ` Se perderán también ${cantidadComentarios} comentario(s).` : ''
    if (!confirm(`¿Eliminar la columna "${nombreItem}" y todas sus notas en este parcial?${avisoPerdida}`)) return
    const idsAEliminar = itemsFiltrados.filter(i => i.nombre_item === nombreItem).map(i => i.id)
    startTransition(async () => {
      for (const id of idsAEliminar) await eliminarItem(id, cursoId)
    })
  }

  const alternarExpandido = (estudianteId: string) =>
    setEstudiantesExpandidos(previos => {
      const siguientes = new Set(previos)
      if (siguientes.has(estudianteId)) siguientes.delete(estudianteId)
      else siguientes.add(estudianteId)
      return siguientes
    })

  // ── Barra superior ────────────────────────────────────────────────────────
  const barraSuperior = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <ParcialSelector parcialActivo={parcialActivo} numParciales={numParciales} onChange={setParcialActivo} />

        <div className="relative">
          <button
            onClick={() => setMenuNotaAbierto(abierto => !abierto)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700"
          >
            <Plus className="h-4 w-4" /> Nota
          </button>
          {menuNotaAbierto && (
            <div className="absolute z-30 mt-1 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-xl p-1">
              <button
                onClick={() => { setMenuNotaAbierto(false); setCreandoManual(true); setErrorMensaje(null) }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800"
              >
                Columna manual
                <span className="block text-[11px] text-gray-500">Vacía; tú escribes cada nota.</span>
              </button>
              <button
                onClick={() => { setMenuNotaAbierto(false); setEditorRubrica({}) }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800"
              >
                Calculada por rúbrica
                <span className="block text-[11px] text-gray-500">Combina actividades, participación y asistencia.</span>
              </button>
              <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-800">
                Para traer notas de Moodle usa "Importar de Moodle".
              </p>
            </div>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={soloSinComentario}
          onChange={e => setSoloSinComentario(e.target.checked)}
        />
        Solo con nota bajo el máximo sin comentario
      </label>
    </div>
  )

  const bloqueCrearManual = creandoManual && (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/50">
      <input
        autoFocus
        value={nombreManual}
        onChange={e => setNombreManual(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCrearManual(); if (e.key === 'Escape') setCreandoManual(false) }}
        placeholder={`Nombre de la columna (Parcial ${parcialActivo}), ej: ACD1`}
        className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100"
      />
      <button
        onClick={handleCrearManual}
        disabled={isPending || nombreManual.trim() === ''}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
      >
        Crear
      </button>
      <button onClick={() => setCreandoManual(false)} className="text-gray-400 hover:text-gray-200"><X className="h-4 w-4" /></button>
    </div>
  )

  const mensajeError = errorMensaje && (
    <p className="text-sm text-red-400">{errorMensaje}</p>
  )

  const editorRubricaModal = editorRubrica && (
    <RubricaEditor
      cursoId={cursoId}
      numParciales={numParciales}
      parcialInicial={parcialActivo}
      estudiantes={estudiantes}
      itemsDisponibles={itemsDisponibles}
      datosPorEstudiante={datosPorEstudiante}
      fechasClase={fechasClase}
      rubricaExistente={editorRubrica.rubrica}
      onClose={() => setEditorRubrica(null)}
    />
  )

  if (nombresItems.length === 0 && numParciales > 0) {
    return (
      <div className="flex flex-col gap-4">
        {barraSuperior}
        {bloqueCrearManual}
        {mensajeError}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400 text-sm">No hay calificaciones para el Parcial {parcialActivo}.</p>
          <p className="text-gray-400 text-xs mt-1">Usa "Importar de Moodle", o "+ Nota" para crear una columna manual o por rúbrica.</p>
        </div>
        {editorRubricaModal}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {barraSuperior}
      {bloqueCrearManual}
      {mensajeError}

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
                const rubrica = rubricaPorColumna.get(ni)
                return (
                  <th key={ni} className="px-2 py-2.5 border-b border-l border-gray-700 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-400 max-w-[120px] truncate" title={ni}>{ni}</span>
                      {tipo === 'subtotal_categoria' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400">Subtotal</span>
                      )}
                      {rubrica && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-900/40 text-teal-300">
                          Rúbrica · /{maximoDeColumna(ni)}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        {rubrica && (
                          <>
                            <button
                              onClick={() => handleRecalcular(rubrica)}
                              disabled={isPending}
                              title="Recalcular notas de esta rúbrica"
                              className="text-gray-300 hover:text-teal-300 transition-colors disabled:opacity-40"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditorRubrica({ rubrica })}
                              title="Editar rúbrica"
                              className="text-gray-300 hover:text-teal-300 transition-colors"
                            >
                              <Settings2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setColumnaParaCopiar(ni)}
                          title="Copiar comentarios de la columna"
                          className="text-gray-300 hover:text-blue-400 transition-colors"
                        >
                          <ClipboardCopy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleEliminarColumna(ni)}
                          title={rubrica ? 'Eliminar rúbrica' : 'Eliminar columna'}
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
            {estudiantesVisibles.map(est => {
              const estaExpandido = estudiantesExpandidos.has(est.id)
              return (
                <FilaEstudiante key={est.id}>
                  <tr className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="px-4 py-2 font-medium text-gray-300 sticky left-0 bg-gray-900 border-r border-gray-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {rubricasDelParcial.length > 0 && (
                          <button
                            onClick={() => alternarExpandido(est.id)}
                            title="Ver desglose por criterio"
                            className="text-gray-500 hover:text-gray-200"
                          >
                            {estaExpandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                        {est.nombre}
                      </div>
                    </td>
                    {nombresItems.map(ni => {
                      const item = indice.get(`${est.id}|${ni}`)
                      const esRubrica = rubricaPorColumna.has(ni)
                      const esteEditando = editando?.itemId === (item?.id ?? `${est.id}|${ni}`)
                      const tieneComentario = !!item?.comentario?.trim()
                      const comentarioEstaAbierto =
                        comentarioAbierto?.estudianteId === est.id && comentarioAbierto?.nombreItem === ni
                      const borradorSugerido = esRubrica && resultadosEnVivo.get(`${est.id}|${ni}`)
                        ? borradorComentarioDesdeResultado(resultadosEnVivo.get(`${est.id}|${ni}`)!)
                        : undefined

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
                              borradorSugerido={borradorSugerido}
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
                                {item.nota === null ? '—' : Number(item.nota).toFixed(2)}
                              </span>
                              {!esRubrica && (
                                <button
                                  onClick={() => setEditando({ itemId: item.id, nota: item.nota?.toString() ?? '' })}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-400 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                              {botonComentario}
                              {necesitaComentario(item) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Nota menor al máximo sin comentario" />
                              )}
                              {esRubrica && estaDesactualizada(est.id, ni, item) && (
                                <span title="Desactualizada: los datos cambiaron, pulsa ↻ en la columna" className="text-amber-400 text-xs">⟳</span>
                              )}
                              {!esRubrica && (
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
                              )}
                              {item.fuente === 'manual' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Editado manualmente" />
                              )}
                              {esRubrica && (
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" title="Calculada por rúbrica" />
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

                  {estaExpandido && (
                    <tr className="bg-gray-950/40 border-b border-gray-800">
                      <td colSpan={nombresItems.length + 1} className="px-6 py-3">
                        <DesgloseRubricas
                          rubricas={rubricasDelParcial}
                          resultados={resultadosEnVivo}
                          estudianteId={est.id}
                        />
                      </td>
                    </tr>
                  )}
                </FilaEstudiante>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" /> Editado manualmente</span>
        {' · '}<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" /> Calculada por rúbrica</span>
        {' · '}<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Nota bajo el máximo sin comentario</span>
        {' · '}Hover sobre la nota para editar inline; 💬 para registrar qué falta; ▸ para ver el desglose de una rúbrica. Los subtotales (en azul) son calculados por Moodle e importados; los totales finales se calculan automáticamente en la pestaña Resumen.
      </p>

      {columnaParaCopiar && (
        <CopiarComentariosModal
          nombreItem={columnaParaCopiar}
          parcial={parcialActivo}
          filas={filasComentariosDeColumna(columnaParaCopiar)}
          onClose={() => setColumnaParaCopiar(null)}
        />
      )}
      {editorRubricaModal}
    </div>
  )
}

/** Agrupa la fila del estudiante y su fila de desglose bajo una misma clave. */
function FilaEstudiante({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function formatear(valor: number): string {
  return String(redondear(valor))
}

function DesgloseRubricas({
  rubricas, resultados, estudianteId,
}: {
  rubricas: RubricaGuardada[]
  resultados: Map<string, ResultadoRubrica>
  estudianteId: string
}) {
  return (
    <div className="space-y-4">
      {rubricas.map(rubrica => {
        const resultado = resultados.get(`${estudianteId}|${rubrica.nombre_columna}`)
        if (!resultado) return null
        return (
          <div key={rubrica.id}>
            <p className="text-xs font-semibold text-teal-300 mb-1">
              {rubrica.nombre_columna}: {formatear(resultado.total)}/{formatear(resultado.totalMax)}
              {rubrica.escala_salida ? ` → ${formatear(resultado.notaSalida)}/${rubrica.escala_salida}` : ''}
            </p>
            <table className="w-full text-xs">
              <tbody>
                {resultado.criterios.map((criterio, indiceCriterio) => (
                  <tr key={indiceCriterio} className="border-t border-gray-800 align-top">
                    <td className="py-1.5 pr-3 text-gray-300 whitespace-nowrap">{criterio.nombre}</td>
                    <td className="py-1.5 pr-3 text-gray-400">
                      {criterio.sinDatos && <span className="text-amber-400">Sin datos (vale 0). </span>}
                      {criterio.fuentes.map((fuente, indiceFuente) => (
                        <span key={indiceFuente} className={`block ${fuente.incluida ? '' : 'text-gray-600'}`}>
                          {fuente.etiqueta}:{' '}
                          {fuente.incluida
                            ? fuente.valorCrudo === null
                              ? `sin nota → 0 (obligatoria)`
                              : `${formatear(fuente.valorCrudo)}/${fuente.escalaMax} → ${formatear((fuente.normalizado ?? 0) * 100)} %`
                            : `excluida (${fuente.motivoExclusion ?? 'sin dato'})`}
                        </span>
                      ))}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-200 whitespace-nowrap">
                      {formatear(criterio.puntos)}/{formatear(criterio.puntosMax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
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
