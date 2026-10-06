/**
 * Motor de cálculo de notas por rúbrica. Función pura: sin acceso a BD, sin IA.
 *
 * Reglas:
 *  1. Equidad entre escalas: cada fuente declara su escala (`escalaMax`) y se normaliza a 0-1
 *     antes de promediar. Nunca se suman valores crudos de escalas distintas.
 *  2. Obligatoria: sin dato cuenta como 0. No obligatoria: sin dato se excluye del promedio.
 */

export type TipoFuente = 'item' | 'participacion' | 'asistencia'

export interface FuenteRubrica {
  tipo: TipoFuente
  /** Texto mostrado en el desglose. Por defecto: nombre del ítem, "Participación" o "Asistencia". */
  etiqueta?: string
  /** Solo tipo 'item': columna de calificaciones_items y parcial donde vive. */
  itemNombre?: string
  itemParcial?: number
  /** Escala del valor crudo: 10 para actividades, 5 para participación, 100 para asistencia (%). */
  escalaMax: number
  /** Peso dentro del criterio. Por defecto 1 (promedio simple). */
  peso?: number
  obligatoria: boolean
  /** Rango de fechas ISO (inclusive) para participación y asistencia. */
  desde?: string
  hasta?: string
  /** Solo asistencia: cuánto vale un Atraso respecto a un Presente (0 a 1). Por defecto 1. */
  valorAtraso?: number
}

/** Banda de la rúbrica: si la fracción lograda es >= `desde` (0 a 1), otorga `puntos`. */
export interface BandaRubrica {
  desde: number
  puntos: number
}

export interface CriterioRubrica {
  nombre: string
  puntosMax: number
  /** 'lineal': puntos = fracción × puntosMax. 'bandas': puntos de la primera banda alcanzada. */
  modo: 'lineal' | 'bandas'
  bandas?: BandaRubrica[]
  fuentes: FuenteRubrica[]
}

export interface DefinicionRubrica {
  criterios: CriterioRubrica[]
}

export interface DatosEstudianteRubrica {
  items: { nombre: string; parcial: number; nota: number | null }[]
  participacion: { fecha: string; nivel: number | null }[]
  asistencia: { fecha: string; estado: string }[]
}

export interface ContextoRubrica {
  /** Fechas ISO de todas las sesiones del curso. Denominador de las fuentes obligatorias de fecha. */
  fechasClase: string[]
}

export interface ResultadoFuente {
  etiqueta: string
  tipo: TipoFuente
  valorCrudo: number | null
  escalaMax: number
  normalizado: number | null
  peso: number
  obligatoria: boolean
  incluida: boolean
  motivoExclusion?: string
}

export interface ResultadoCriterio {
  nombre: string
  puntos: number
  puntosMax: number
  /** Fracción lograda (0 a 1), o null si ninguna fuente aportó datos. */
  fraccion: number | null
  sinDatos: boolean
  fuentes: ResultadoFuente[]
}

export interface ResultadoRubrica {
  criterios: ResultadoCriterio[]
  total: number
  totalMax: number
  /** Total reescalado a `escalaSalida`. Si no se indica escala, coincide con `total`. */
  notaSalida: number
}

const EPSILON = 1e-9

export const redondear = (valor: number, decimales = 2): number => {
  const factor = 10 ** decimales
  return Math.round((valor + EPSILON) * factor) / factor
}

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor))

const dentroDeRango = (fecha: string, desde?: string, hasta?: string): boolean =>
  (!desde || fecha >= desde) && (!hasta || fecha <= hasta)

const etiquetaPorDefecto = (fuente: FuenteRubrica): string => {
  if (fuente.etiqueta) return fuente.etiqueta
  if (fuente.tipo === 'item') return fuente.itemNombre ?? 'Actividad'
  return fuente.tipo === 'participacion' ? 'Participación' : 'Asistencia'
}

/** Valor crudo de una fuente para un estudiante, o null si no hay dato. */
function obtenerValorCrudo(
  fuente: FuenteRubrica,
  datos: DatosEstudianteRubrica,
  contexto: ContextoRubrica
): number | null {
  if (fuente.tipo === 'item') {
    const item = datos.items.find(
      candidato => candidato.nombre === fuente.itemNombre && candidato.parcial === fuente.itemParcial
    )
    return item?.nota ?? null
  }

  const fechasEnRango = contexto.fechasClase.filter(fecha => dentroDeRango(fecha, fuente.desde, fuente.hasta))

  if (fuente.tipo === 'participacion') {
    const nivelPorFecha = new Map<string, number>()
    for (const registro of datos.participacion) {
      if (registro.nivel !== null && dentroDeRango(registro.fecha, fuente.desde, fuente.hasta)) {
        nivelPorFecha.set(registro.fecha, registro.nivel)
      }
    }
    if (fuente.obligatoria) {
      // Denominador: todas las sesiones del rango; la sesión sin registro vale 0
      if (fechasEnRango.length === 0) return null
      const suma = fechasEnRango.reduce((acumulado, fecha) => acumulado + (nivelPorFecha.get(fecha) ?? 0), 0)
      return suma / fechasEnRango.length
    }
    if (nivelPorFecha.size === 0) return null
    const suma = [...nivelPorFecha.values()].reduce((acumulado, nivel) => acumulado + nivel, 0)
    return suma / nivelPorFecha.size
  }

  // Asistencia: devuelve porcentaje 0-100
  const valorAtraso = acotar(fuente.valorAtraso ?? 1, 0, 1)
  const valorPorFecha = new Map<string, number>()
  for (const registro of datos.asistencia) {
    if (!dentroDeRango(registro.fecha, fuente.desde, fuente.hasta)) continue
    valorPorFecha.set(
      registro.fecha,
      registro.estado === 'Presente' ? 1 : registro.estado === 'Atraso' ? valorAtraso : 0
    )
  }
  const fechasConsideradas = fuente.obligatoria ? fechasEnRango : [...valorPorFecha.keys()]
  if (fechasConsideradas.length === 0) return null
  const suma = fechasConsideradas.reduce((acumulado, fecha) => acumulado + (valorPorFecha.get(fecha) ?? 0), 0)
  return (suma / fechasConsideradas.length) * 100
}

export function calcularFuente(
  fuente: FuenteRubrica,
  datos: DatosEstudianteRubrica,
  contexto: ContextoRubrica
): ResultadoFuente {
  const peso = fuente.peso ?? 1
  const base = {
    etiqueta: etiquetaPorDefecto(fuente),
    tipo: fuente.tipo,
    escalaMax: fuente.escalaMax,
    peso,
    obligatoria: fuente.obligatoria,
  }

  const valorReal = obtenerValorCrudo(fuente, datos, contexto)

  if (valorReal !== null) {
    return {
      ...base,
      valorCrudo: valorReal,
      normalizado: acotar(valorReal / fuente.escalaMax, 0, 1),
      incluida: true,
    }
  }
  if (fuente.obligatoria && fuente.tipo === 'item') {
    return { ...base, valorCrudo: null, normalizado: 0, incluida: true }
  }
  return {
    ...base,
    valorCrudo: null,
    normalizado: null,
    incluida: false,
    motivoExclusion: 'Sin dato y no obligatoria',
  }
}

const puntosPorBandas = (fraccion: number, bandas: BandaRubrica[]): number => {
  const bandasDeMayorAMenor = [...bandas].sort((a, b) => b.desde - a.desde)
  const bandaAlcanzada = bandasDeMayorAMenor.find(banda => fraccion + EPSILON >= banda.desde)
  return bandaAlcanzada?.puntos ?? 0
}

export function calcularCriterio(
  criterio: CriterioRubrica,
  datos: DatosEstudianteRubrica,
  contexto: ContextoRubrica
): ResultadoCriterio {
  const fuentes = criterio.fuentes.map(fuente => calcularFuente(fuente, datos, contexto))
  const fuentesIncluidas = fuentes.filter(fuente => fuente.incluida && fuente.normalizado !== null)
  const pesoTotal = fuentesIncluidas.reduce((acumulado, fuente) => acumulado + fuente.peso, 0)

  if (fuentesIncluidas.length === 0 || pesoTotal <= 0) {
    return { nombre: criterio.nombre, puntos: 0, puntosMax: criterio.puntosMax, fraccion: null, sinDatos: true, fuentes }
  }

  const fraccion =
    fuentesIncluidas.reduce((acumulado, fuente) => acumulado + (fuente.normalizado as number) * fuente.peso, 0) /
    pesoTotal

  const puntos =
    criterio.modo === 'bandas' && criterio.bandas?.length
      ? puntosPorBandas(fraccion, criterio.bandas)
      : fraccion * criterio.puntosMax

  return {
    nombre: criterio.nombre,
    puntos: redondear(puntos),
    puntosMax: criterio.puntosMax,
    fraccion,
    sinDatos: false,
    fuentes,
  }
}

export function calcularRubrica(
  definicion: DefinicionRubrica,
  datos: DatosEstudianteRubrica,
  contexto: ContextoRubrica,
  escalaSalida?: number
): ResultadoRubrica {
  const criterios = definicion.criterios.map(criterio => calcularCriterio(criterio, datos, contexto))
  const total = redondear(criterios.reduce((acumulado, criterio) => acumulado + criterio.puntos, 0))
  const totalMax = redondear(criterios.reduce((acumulado, criterio) => acumulado + criterio.puntosMax, 0))
  const notaSalida =
    escalaSalida !== undefined && totalMax > 0 ? redondear((total / totalMax) * escalaSalida) : total
  return { criterios, total, totalMax, notaSalida }
}

const formatearNumero = (valor: number): string => String(redondear(valor))

/**
 * Borrador determinista (sin IA) del comentario "qué falta" para pegar en Moodle.
 * Lista solo los criterios que no alcanzaron el máximo, con el valor de cada fuente,
 * y marca las actividades obligatorias que no tienen nota.
 */
export function borradorComentarioDesdeResultado(resultado: ResultadoRubrica): string {
  const lineas = resultado.criterios
    .filter(criterio => criterio.puntos < criterio.puntosMax)
    .map(criterio => {
      if (criterio.sinDatos) return `${criterio.nombre}: sin datos registrados.`
      const detalleFuentes = criterio.fuentes
        .filter(fuente => fuente.incluida)
        .map(fuente =>
          fuente.valorCrudo === null
            ? `falta: ${fuente.etiqueta}`
            : `${fuente.etiqueta} ${formatearNumero(fuente.valorCrudo)}/${formatearNumero(fuente.escalaMax)}`
        )
        .join('; ')
      return `${criterio.nombre}: ${formatearNumero(criterio.puntos)}/${formatearNumero(criterio.puntosMax)} (${detalleFuentes}).`
    })
  return lineas.join('\n')
}
