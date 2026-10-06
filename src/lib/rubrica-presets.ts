import type { DefinicionRubrica, FuenteRubrica } from './rubrica-calculo'

/** Escala sugerida del valor crudo según el tipo de fuente. */
export const ESCALA_POR_DEFECTO: Record<FuenteRubrica['tipo'], number> = {
  item: 10,
  participacion: 5,
  asistencia: 100,
}

/** Valor crudo que equivale a 0 puntos. Participación: el nivel 1 vale 0. */
export const ESCALA_MIN_POR_DEFECTO: Record<FuenteRubrica['tipo'], number> = {
  item: 0,
  participacion: 1,
  asistencia: 0,
}

export const BANDAS_RUBRICA_ESTANDAR = [
  { desde: 1, puntos: 2 },
  { desde: 0.9, puntos: 1.5 },
  { desde: 0.75, puntos: 1 },
  { desde: 0.6, puntos: 0.5 },
]

/** Asistencia de Filosofía: con pocas sesiones una falta (≈89 %) sigue siendo "Muy bueno". */
const BANDAS_ASISTENCIA_FILOSOFIA = [
  { desde: 1, puntos: 2 },
  { desde: 0.85, puntos: 1.5 },
  { desde: 0.75, puntos: 1 },
  { desde: 0.6, puntos: 0.5 },
]

/**
 * Plantilla basada en la rúbrica de Filosofía: solo los criterios que se pueden calcular desde la app
 * (participación, asistencia y debates). Talleres físicos y fichas de lectura dependen de archivos en Moodle.
 * "Creatividad" arranca sin fuentes: el profesor elige qué debates/actividades cuentan.
 */
export function crearPlantillaFilosofia(): DefinicionRubrica {
  return {
    criterios: [
      {
        nombre: 'Participación en Clases',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [
          {
            tipo: 'participacion',
            escalaMax: ESCALA_POR_DEFECTO.participacion,
            escalaMin: ESCALA_MIN_POR_DEFECTO.participacion,
            obligatoria: false,
          },
        ],
      },
      {
        nombre: 'Asistencia y Puntualidad',
        puntosMax: 2,
        modo: 'bandas',
        bandas: BANDAS_ASISTENCIA_FILOSOFIA.map(banda => ({ ...banda })),
        fuentes: [{ tipo: 'asistencia', escalaMax: ESCALA_POR_DEFECTO.asistencia, obligatoria: true, valorAtraso: 1 }],
      },
      {
        nombre: 'Creatividad Propositiva, Debate y Otros Aportes',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [],
      },
    ],
  }
}

export function crearFuenteVacia(tipo: FuenteRubrica['tipo']): FuenteRubrica {
  return {
    tipo,
    escalaMax: ESCALA_POR_DEFECTO[tipo],
    ...(ESCALA_MIN_POR_DEFECTO[tipo] > 0 ? { escalaMin: ESCALA_MIN_POR_DEFECTO[tipo] } : {}),
    obligatoria: false,
    ...(tipo === 'asistencia' ? { valorAtraso: 1 } : {}),
  }
}
