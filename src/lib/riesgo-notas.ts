/**
 * Detección de riesgo por calificación: una sola columna por debajo del umbral basta,
 * aunque las demás estén en el máximo. Puro y sin dependencias (testable con node --test).
 *
 * Solo cuentan notas formales (fuente moodle, manual o rubrica) de tipo 'tarea'.
 * Las notas 'en_curso' nunca entran: son datos de proceso, no evaluativos.
 */

export const UMBRAL_NOTA_RIESGO_PCT = 70
export const NOTA_MAXIMA_POR_DEFECTO = 10

const FUENTES_FORMALES = ['moodle', 'manual', 'rubrica']

export interface ItemNotaRiesgo {
  estudiante_id: string
  parcial: number
  nombre_item: string
  tipo: string
  nota: number | string | null
  fuente: string
}

/** Lo mínimo que se necesita de una rúbrica para saber sobre cuánto es su columna. */
export interface RubricaEscala {
  parcial: number
  nombre_columna: string
  escala_salida: number | null
  definicion: { criterios: { puntosMax: number }[] }
}

export interface NotaBaja {
  columna: string
  parcial: number
  nota: number
  max: number
  pct: number
}

const redondear = (valor: number, decimales = 2): number => {
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}

const claveColumna = (parcial: number, nombre: string) => `${parcial}|${nombre}`

/** Máximo de una columna de rúbrica: su escala de salida o la suma de puntos de sus criterios. */
export function maximoDeRubrica(rubrica: RubricaEscala): number {
  return rubrica.escala_salida ?? redondear(rubrica.definicion.criterios.reduce((suma, criterio) => suma + criterio.puntosMax, 0))
}

/**
 * Notas por debajo del umbral (por defecto 70 % del máximo de su columna), por estudiante.
 * Solo aparecen en el resultado los estudiantes con al menos una nota baja.
 */
export function calcularNotasBajas(
  items: ItemNotaRiesgo[],
  rubricas: RubricaEscala[],
  umbralPct: number = UMBRAL_NOTA_RIESGO_PCT
): Record<string, NotaBaja[]> {
  const maximoPorColumna = new Map<string, number>(
    rubricas.map(rubrica => [claveColumna(rubrica.parcial, rubrica.nombre_columna), maximoDeRubrica(rubrica)])
  )

  const notasBajasPorEstudiante: Record<string, NotaBaja[]> = {}
  for (const item of items) {
    if (item.tipo !== 'tarea' || !FUENTES_FORMALES.includes(item.fuente) || item.nota === null) continue
    const nota = Number(item.nota)
    if (Number.isNaN(nota)) continue
    const max = maximoPorColumna.get(claveColumna(item.parcial, item.nombre_item)) ?? NOTA_MAXIMA_POR_DEFECTO
    if (max <= 0 || (nota / max) * 100 >= umbralPct) continue

    const lista = (notasBajasPorEstudiante[item.estudiante_id] ??= [])
    lista.push({
      columna: item.nombre_item,
      parcial: item.parcial,
      nota: redondear(nota),
      max: redondear(max),
      pct: Math.round((nota / max) * 100),
    })
  }

  for (const lista of Object.values(notasBajasPorEstudiante)) {
    lista.sort((a, b) => a.pct - b.pct)
  }
  return notasBajasPorEstudiante
}

/** "ACD1 (P1): 3/6 · 50 %" */
export function describirNotaBaja(nota: NotaBaja): string {
  return `${nota.columna} (P${nota.parcial}): ${nota.nota}/${nota.max} · ${nota.pct} %`
}
