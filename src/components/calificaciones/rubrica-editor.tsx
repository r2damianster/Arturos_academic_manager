'use client'

import { useMemo, useState, useTransition } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { guardarRubrica, recalcularRubrica } from '@/lib/actions/rubricas'
import { DefinicionRubricaSchema } from '@/lib/rubrica-schema'
import {
  calcularRubrica,
  type CriterioRubrica,
  type DatosEstudianteRubrica,
  type DefinicionRubrica,
  type FuenteRubrica,
} from '@/lib/rubrica-calculo'
import {
  BANDAS_RUBRICA_ESTANDAR,
  crearFuenteVacia,
  crearPlantillaFilosofia,
} from '@/lib/rubrica-presets'

export interface ItemDisponible {
  nombre: string
  parcial: number
  fuente: string
}

interface RubricaEditorProps {
  cursoId: string
  numParciales: number
  parcialInicial: number
  estudiantes: { id: string; nombre: string }[]
  itemsDisponibles: ItemDisponible[]
  datosPorEstudiante: Map<string, DatosEstudianteRubrica>
  fechasClase: string[]
  /** Si viene, se edita una rúbrica existente (nombre y parcial quedan fijos). */
  rubricaExistente?: {
    nombre_columna: string
    parcial: number
    escala_salida: number | null
    definicion: DefinicionRubrica
  }
  onClose: () => void
}

const claseInput =
  'rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500'

const NOMBRE_TIPO: Record<FuenteRubrica['tipo'], string> = {
  item: 'Nota de actividad',
  participacion: 'Participación (promedio)',
  asistencia: 'Asistencia (%)',
}

export function RubricaEditor({
  cursoId, numParciales, parcialInicial, estudiantes, itemsDisponibles, datosPorEstudiante, fechasClase,
  rubricaExistente, onClose,
}: RubricaEditorProps) {
  const esEdicion = !!rubricaExistente
  const [nombreColumna, setNombreColumna] = useState(rubricaExistente?.nombre_columna ?? '')
  const [parcial, setParcial] = useState(rubricaExistente?.parcial ?? parcialInicial)
  const [escalaSalidaTexto, setEscalaSalidaTexto] = useState(
    rubricaExistente?.escala_salida != null ? String(rubricaExistente.escala_salida) : ''
  )
  const [criterios, setCriterios] = useState<CriterioRubrica[]>(
    rubricaExistente?.definicion.criterios ?? crearPlantillaFilosofia().criterios
  )
  const [ingresosTardios, setIngresosTardios] = useState<{ estudianteId: string; desde: string }[]>(
    rubricaExistente?.definicion.ingresoTardio ?? []
  )
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const itemsDelParcial = itemsDisponibles // se pueden usar notas de cualquier parcial como fuente

  const actualizarCriterio = (indice: number, cambios: Partial<CriterioRubrica>) =>
    setCriterios(previos => previos.map((criterio, i) => (i === indice ? { ...criterio, ...cambios } : criterio)))

  const actualizarFuente = (indiceCriterio: number, indiceFuente: number, cambios: Partial<FuenteRubrica>) =>
    setCriterios(previos =>
      previos.map((criterio, i) =>
        i !== indiceCriterio
          ? criterio
          : {
              ...criterio,
              fuentes: criterio.fuentes.map((fuente, j) => (j === indiceFuente ? { ...fuente, ...cambios } : fuente)),
            }
      )
    )

  const cambiarTipoFuente = (indiceCriterio: number, indiceFuente: number, tipo: FuenteRubrica['tipo']) =>
    setCriterios(previos =>
      previos.map((criterio, i) =>
        i !== indiceCriterio
          ? criterio
          : { ...criterio, fuentes: criterio.fuentes.map((fuente, j) => (j === indiceFuente ? crearFuenteVacia(tipo) : fuente)) }
      )
    )

  // Se ignoran las filas de ingreso tardío incompletas (sin estudiante o sin fecha)
  const ingresosTardiosCompletos = ingresosTardios.filter(ingreso => ingreso.estudianteId && ingreso.desde)
  const definicion: DefinicionRubrica = {
    criterios,
    ...(ingresosTardiosCompletos.length > 0 ? { ingresoTardio: ingresosTardiosCompletos } : {}),
  }
  const validacion = useMemo(() => DefinicionRubricaSchema.safeParse(definicion), [criterios, ingresosTardios]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMaximo = criterios.reduce((acumulado, criterio) => acumulado + (Number(criterio.puntosMax) || 0), 0)
  const escalaSalida = escalaSalidaTexto.trim() === '' ? undefined : Number(escalaSalidaTexto)

  const vistaPrevia = useMemo(() => {
    if (!validacion.success) return null
    return estudiantes.map(estudiante => ({
      estudiante,
      resultado: calcularRubrica(
        validacion.data as DefinicionRubrica,
        datosPorEstudiante.get(estudiante.id) ?? { items: [], participacion: [], asistencia: [] },
        { fechasClase },
        escalaSalida && escalaSalida > 0 ? escalaSalida : undefined
      ),
    }))
  }, [validacion, estudiantes, datosPorEstudiante, fechasClase, escalaSalida])

  const handleGuardar = () => {
    setErrorMensaje(null)
    startTransition(async () => {
      const resultadoGuardado = await guardarRubrica({
        cursoId,
        parcial,
        nombreColumna,
        escalaSalida: escalaSalida && escalaSalida > 0 ? escalaSalida : null,
        definicion,
      })
      if (resultadoGuardado.error || !resultadoGuardado.rubricaId) {
        setErrorMensaje(resultadoGuardado.error ?? 'No se pudo guardar')
        return
      }
      const resultadoCalculo = await recalcularRubrica(resultadoGuardado.rubricaId)
      if (resultadoCalculo.error) {
        setErrorMensaje(`Rúbrica guardada, pero falló el cálculo: ${resultadoCalculo.error}`)
        return
      }
      onClose()
    })
  }

  const textoErrorValidacion = !validacion.success ? validacion.error.issues[0]?.message : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-3xl h-full overflow-y-auto bg-gray-900 border-l border-gray-700 shadow-2xl p-5 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{esEdicion ? 'Editar rúbrica' : 'Nueva nota por rúbrica'}</h2>
            <p className="text-xs text-gray-400">
              Cada criterio promedia sus fuentes ya normalizadas (cada una sobre su escala), así que escalas distintas pesan igual.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 text-xs text-gray-400 space-y-1">
            Nombre de la columna
            <input
              value={nombreColumna}
              onChange={e => setNombreColumna(e.target.value)}
              disabled={esEdicion}
              placeholder="Ej: ACD1"
              className={`${claseInput} w-full text-sm disabled:opacity-60`}
            />
          </label>
          <label className="text-xs text-gray-400 space-y-1">
            Parcial
            <select
              value={parcial}
              onChange={e => setParcial(Number(e.target.value))}
              disabled={esEdicion}
              className={`${claseInput} w-full text-sm disabled:opacity-60`}
            >
              {Array.from({ length: numParciales }, (_, i) => i + 1).map(numero => (
                <option key={numero} value={numero}>Parcial {numero}</option>
              ))}
            </select>
          </label>
          <label className="col-span-3 text-xs text-gray-400 space-y-1">
            Nota de salida sobre… (opcional; vacío = suma de puntos, hoy {totalMaximo})
            <input
              type="number" min={1} max={100} step={0.5}
              value={escalaSalidaTexto}
              onChange={e => setEscalaSalidaTexto(e.target.value)}
              placeholder={String(totalMaximo)}
              className={`${claseInput} w-32 block`}
            />
          </label>
        </div>

        {/* Criterios */}
        <div className="space-y-4">
          {criterios.map((criterio, indiceCriterio) => (
            <div key={indiceCriterio} className="rounded-xl border border-gray-700 bg-gray-800/40 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={criterio.nombre}
                  onChange={e => actualizarCriterio(indiceCriterio, { nombre: e.target.value })}
                  placeholder="Nombre del criterio"
                  className={`${claseInput} flex-1 text-sm`}
                />
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  Máx
                  <input
                    type="number" min={0.5} step={0.5}
                    value={criterio.puntosMax}
                    onChange={e => actualizarCriterio(indiceCriterio, { puntosMax: Number(e.target.value) })}
                    className={`${claseInput} w-16`}
                  />
                  pts
                </label>
                <select
                  value={criterio.modo}
                  onChange={e => {
                    const modo = e.target.value as CriterioRubrica['modo']
                    actualizarCriterio(indiceCriterio, {
                      modo,
                      bandas: modo === 'bandas' ? criterio.bandas ?? BANDAS_RUBRICA_ESTANDAR.map(banda => ({ ...banda })) : criterio.bandas,
                    })
                  }}
                  className={claseInput}
                >
                  <option value="lineal">Proporcional</option>
                  <option value="bandas">Por bandas</option>
                </select>
                <button
                  onClick={() => setCriterios(previos => previos.filter((_, i) => i !== indiceCriterio))}
                  title="Quitar criterio"
                  className="text-gray-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {criterio.modo === 'bandas' && (
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500">Si el logro es ≥ X %, otorga estos puntos (se aplica la banda más alta alcanzada).</p>
                  {(criterio.bandas ?? []).map((banda, indiceBanda) => (
                    <div key={indiceBanda} className="flex items-center gap-2 text-xs text-gray-400">
                      ≥
                      <input
                        type="number" min={0} max={100}
                        value={Math.round(banda.desde * 100)}
                        onChange={e =>
                          actualizarCriterio(indiceCriterio, {
                            bandas: (criterio.bandas ?? []).map((actual, i) =>
                              i === indiceBanda ? { ...actual, desde: Number(e.target.value) / 100 } : actual
                            ),
                          })
                        }
                        className={`${claseInput} w-16`}
                      />
                      % →
                      <input
                        type="number" min={0} step={0.5}
                        value={banda.puntos}
                        onChange={e =>
                          actualizarCriterio(indiceCriterio, {
                            bandas: (criterio.bandas ?? []).map((actual, i) =>
                              i === indiceBanda ? { ...actual, puntos: Number(e.target.value) } : actual
                            ),
                          })
                        }
                        className={`${claseInput} w-16`}
                      />
                      pts
                      <button
                        onClick={() =>
                          actualizarCriterio(indiceCriterio, {
                            bandas: (criterio.bandas ?? []).filter((_, i) => i !== indiceBanda),
                          })
                        }
                        className="text-gray-600 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => actualizarCriterio(indiceCriterio, { bandas: [...(criterio.bandas ?? []), { desde: 0, puntos: 0 }] })}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    + banda
                  </button>
                </div>
              )}

              {/* Fuentes */}
              <div className="space-y-2">
                {criterio.fuentes.map((fuente, indiceFuente) => (
                  <div key={indiceFuente} className="rounded-lg bg-gray-900/60 border border-gray-700 p-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={fuente.tipo}
                        onChange={e => cambiarTipoFuente(indiceCriterio, indiceFuente, e.target.value as FuenteRubrica['tipo'])}
                        className={claseInput}
                      >
                        {(Object.keys(NOMBRE_TIPO) as FuenteRubrica['tipo'][]).map(tipo => (
                          <option key={tipo} value={tipo}>{NOMBRE_TIPO[tipo]}</option>
                        ))}
                      </select>

                      {fuente.tipo === 'item' && (
                        <select
                          value={fuente.itemNombre ? `${fuente.itemParcial}|${fuente.itemNombre}` : ''}
                          onChange={e => {
                            const [parcialTexto, ...partesNombre] = e.target.value.split('|')
                            actualizarFuente(indiceCriterio, indiceFuente, {
                              itemParcial: Number(parcialTexto),
                              itemNombre: partesNombre.join('|'),
                            })
                          }}
                          className={`${claseInput} flex-1 min-w-[160px]`}
                        >
                          <option value="">Elegir actividad…</option>
                          {itemsDelParcial.map(item => (
                            <option key={`${item.parcial}|${item.nombre}`} value={`${item.parcial}|${item.nombre}`}>
                              {item.nombre} (P{item.parcial}{item.fuente === 'en_curso' ? ', en curso' : ''})
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={() =>
                          actualizarCriterio(indiceCriterio, {
                            fuentes: criterio.fuentes.filter((_, i) => i !== indiceFuente),
                          })
                        }
                        className="ml-auto text-gray-600 hover:text-red-400"
                        title="Quitar fuente"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <label className="flex items-center gap-1">
                        Sobre
                        <input
                          type="number" min={1}
                          value={fuente.escalaMax}
                          onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { escalaMax: Number(e.target.value) })}
                          className={`${claseInput} w-16`}
                        />
                      </label>
                      <label className="flex items-center gap-1" title="Valor que equivale a 0 puntos. En participación, 1 significa que el nivel 1 vale 0.">
                        Cero en
                        <input
                          type="number" min={0}
                          value={fuente.escalaMin ?? 0}
                          onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { escalaMin: Number(e.target.value) })}
                          className={`${claseInput} w-14`}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        Peso
                        <input
                          type="number" min={0.5} step={0.5}
                          value={fuente.peso ?? 1}
                          onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { peso: Number(e.target.value) })}
                          className={`${claseInput} w-14`}
                        />
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer" title="Obligatoria: sin dato cuenta 0. No obligatoria: sin dato se ignora.">
                        <input
                          type="checkbox"
                          checked={fuente.obligatoria}
                          onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { obligatoria: e.target.checked })}
                        />
                        Obligatoria (sin dato = 0)
                      </label>
                      {fuente.tipo === 'asistencia' && (
                        <label className="flex items-center gap-1">
                          Atraso vale
                          <select
                            value={fuente.valorAtraso ?? 1}
                            onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { valorAtraso: Number(e.target.value) })}
                            className={claseInput}
                          >
                            <option value={1}>presente</option>
                            <option value={0.5}>medio</option>
                            <option value={0}>ausente</option>
                          </select>
                        </label>
                      )}
                      {fuente.tipo !== 'item' && (
                        <>
                          <label className="flex items-center gap-1">
                            Desde
                            <input
                              type="date"
                              value={fuente.desde ?? ''}
                              onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { desde: e.target.value || undefined })}
                              className={claseInput}
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            Hasta
                            <input
                              type="date"
                              value={fuente.hasta ?? ''}
                              onChange={e => actualizarFuente(indiceCriterio, indiceFuente, { hasta: e.target.value || undefined })}
                              className={claseInput}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => actualizarCriterio(indiceCriterio, { fuentes: [...criterio.fuentes, crearFuenteVacia('item')] })}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus className="h-3 w-3" /> Agregar fuente
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() =>
              setCriterios(previos => [
                ...previos,
                { nombre: '', puntosMax: 2, modo: 'lineal', fuentes: [crearFuenteVacia('item')] },
              ])
            }
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus className="h-4 w-4" /> Agregar criterio
          </button>
        </div>

        {/* Ingreso tardío */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">Ingreso tardío</h3>
          <p className="text-xs text-gray-500">
            Para un estudiante que entró después del inicio, la asistencia y la participación no cuentan las sesiones anteriores a su fecha.
          </p>
          {ingresosTardios.map((ingreso, indiceIngreso) => (
            <div key={indiceIngreso} className="flex items-center gap-2">
              <select
                value={ingreso.estudianteId}
                onChange={e =>
                  setIngresosTardios(previos =>
                    previos.map((actual, i) => (i === indiceIngreso ? { ...actual, estudianteId: e.target.value } : actual))
                  )
                }
                className={`${claseInput} flex-1`}
              >
                <option value="">Elegir estudiante…</option>
                {estudiantes.map(estudiante => (
                  <option key={estudiante.id} value={estudiante.id}>{estudiante.nombre}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-400">
                Cuenta desde
                <input
                  type="date"
                  value={ingreso.desde}
                  onChange={e =>
                    setIngresosTardios(previos =>
                      previos.map((actual, i) => (i === indiceIngreso ? { ...actual, desde: e.target.value } : actual))
                    )
                  }
                  className={claseInput}
                />
              </label>
              <button
                onClick={() => setIngresosTardios(previos => previos.filter((_, i) => i !== indiceIngreso))}
                className="text-gray-600 hover:text-red-400"
                title="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setIngresosTardios(previos => [...previos, { estudianteId: '', desde: '' }])}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus className="h-3 w-3" /> Agregar estudiante con ingreso tardío
          </button>
        </div>

        {/* Vista previa */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">Vista previa</h3>
          {vistaPrevia ? (
            <div className="overflow-auto max-h-72 rounded-xl border border-gray-700">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400 font-medium">Estudiante</th>
                    {criterios.map((criterio, i) => (
                      <th key={i} className="px-2 py-2 text-gray-400 font-medium text-center max-w-[110px] truncate" title={criterio.nombre}>
                        {criterio.nombre || `Criterio ${i + 1}`}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-gray-200 font-semibold text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaPrevia.map(({ estudiante, resultado }) => (
                    <tr key={estudiante.id} className="border-t border-gray-800">
                      <td className="px-3 py-1.5 text-gray-300 whitespace-nowrap">{estudiante.nombre}</td>
                      {resultado.criterios.map((resultadoCriterio, i) => (
                        <td
                          key={i}
                          className={`px-2 py-1.5 text-center font-mono ${resultadoCriterio.sinDatos ? 'text-amber-400' : 'text-gray-300'}`}
                          title={resultadoCriterio.sinDatos ? 'Sin datos: vale 0' : undefined}
                        >
                          {resultadoCriterio.puntos}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-center font-mono font-semibold text-white">
                        {resultado.notaSalida}
                        <span className="text-gray-500 font-normal">/{escalaSalida && escalaSalida > 0 ? escalaSalida : resultado.totalMax}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-amber-400">{textoErrorValidacion}</p>
          )}
        </div>

        {errorMensaje && <p className="text-sm text-red-400">{errorMensaje}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-400 hover:bg-gray-800">Cancelar</button>
          <button
            onClick={handleGuardar}
            disabled={isPending || !validacion.success || nombreColumna.trim() === ''}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar y calcular'}
          </button>
        </div>
      </div>
    </div>
  )
}
