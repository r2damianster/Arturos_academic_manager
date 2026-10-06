// Ejecutar: node --test src/lib/rubrica-calculo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularRubrica,
  calcularCriterio,
  borradorComentarioDesdeResultado,
  type CriterioRubrica,
  type DatosEstudianteRubrica,
  type DefinicionRubrica,
} from './rubrica-calculo.ts'

const fechasClase = ['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15']

const datosVacios: DatosEstudianteRubrica = { items: [], participacion: [], asistencia: [] }

test('normaliza escalas distintas antes de promediar (10 y 5)', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Creatividad',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [
      { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: true },
      { tipo: 'participacion', escalaMax: 5, obligatoria: false },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [{ nombre: 'Debate 1', parcial: 1, nota: 8 }],
    participacion: [{ fecha: '2026-09-01', nivel: 3.8 }],
    asistencia: [],
  }
  const resultado = calcularCriterio(criterio, datos, { fechasClase })
  // (8/10 + 3.8/5) / 2 = 0.78 → 1.56
  assert.equal(resultado.fraccion?.toFixed(2), '0.78')
  assert.equal(resultado.puntos, 1.56)
})

test('ítem no obligatorio sin nota se excluye del promedio', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Creatividad',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [
      { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: true },
      { tipo: 'item', itemNombre: 'Debate 2', itemParcial: 1, escalaMax: 10, obligatoria: false },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [{ nombre: 'Debate 1', parcial: 1, nota: 8 }],
    participacion: [],
    asistencia: [],
  }
  const resultado = calcularCriterio(criterio, datos, { fechasClase })
  assert.equal(resultado.puntos, 1.6)
  assert.equal(resultado.fuentes[1].incluida, false)
})

test('ítem obligatorio sin nota cuenta como 0', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Creatividad',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [
      { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: true },
      { tipo: 'item', itemNombre: 'Debate 2', itemParcial: 1, escalaMax: 10, obligatoria: true },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [{ nombre: 'Debate 1', parcial: 1, nota: 8 }],
    participacion: [],
    asistencia: [],
  }
  // (0.8 + 0) / 2 = 0.4 → 0.8
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 0.8)
})

test('nota con valor 0 explícito cuenta aunque la fuente no sea obligatoria', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Debate',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [
      { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: false },
      { tipo: 'item', itemNombre: 'Debate 2', itemParcial: 1, escalaMax: 10, obligatoria: false },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [
      { nombre: 'Debate 1', parcial: 1, nota: 10 },
      { nombre: 'Debate 2', parcial: 1, nota: 0 },
    ],
    participacion: [],
    asistencia: [],
  }
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 1)
})

test('participación obligatoria: sesiones sin registro valen 0', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Participación',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'participacion', escalaMax: 5, obligatoria: true }],
  }
  const datos: DatosEstudianteRubrica = {
    items: [],
    participacion: [
      { fecha: '2026-09-01', nivel: 5 },
      { fecha: '2026-09-03', nivel: 5 },
    ],
    asistencia: [],
  }
  // 10 / 5 sesiones = 2 de 5 → 0.4 → 0.8
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 0.8)
})

test('participación no obligatoria: promedia solo los registros existentes', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Participación',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'participacion', escalaMax: 5, obligatoria: false }],
  }
  const datos: DatosEstudianteRubrica = {
    items: [],
    participacion: [
      { fecha: '2026-09-01', nivel: 5 },
      { fecha: '2026-09-03', nivel: 5 },
    ],
    asistencia: [],
  }
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 2)
})

test('asistencia: atraso con valor configurable', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Asistencia',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false, valorAtraso: 0.5 }],
  }
  const datos: DatosEstudianteRubrica = {
    items: [],
    participacion: [],
    asistencia: [
      { fecha: '2026-09-01', estado: 'Presente' },
      { fecha: '2026-09-03', estado: 'Atraso' },
      { fecha: '2026-09-08', estado: 'Presente' },
      { fecha: '2026-09-10', estado: 'Ausente' },
    ],
  }
  // (1 + 0.5 + 1 + 0) / 4 = 62.5 % → 0.625 × 2 = 1.25
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 1.25)
})

test('asistencia obligatoria: la sesión sin registro cuenta como ausente', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Asistencia',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: true }],
  }
  const datos: DatosEstudianteRubrica = {
    items: [],
    participacion: [],
    asistencia: [{ fecha: '2026-09-01', estado: 'Presente' }],
  }
  // 1 presente de 5 sesiones = 20 % → 0.4
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 0.4)
})

test('rango de fechas limita asistencia y participación', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Asistencia',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false, desde: '2026-09-08', hasta: '2026-09-10' }],
  }
  const datos: DatosEstudianteRubrica = {
    items: [],
    participacion: [],
    asistencia: [
      { fecha: '2026-09-01', estado: 'Ausente' },
      { fecha: '2026-09-08', estado: 'Presente' },
      { fecha: '2026-09-10', estado: 'Presente' },
      { fecha: '2026-09-15', estado: 'Ausente' },
    ],
  }
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 2)
})

test('modo bandas: 88 % de asistencia cae en la banda 75-89 → 1.0', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Asistencia',
    puntosMax: 2,
    modo: 'bandas',
    bandas: [
      { desde: 1, puntos: 2 },
      { desde: 0.9, puntos: 1.5 },
      { desde: 0.75, puntos: 1 },
      { desde: 0.6, puntos: 0.5 },
    ],
    fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false }],
  }
  const asistencia = Array.from({ length: 25 }, (_, indice) => ({
    fecha: `2026-09-${String(indice + 1).padStart(2, '0')}`,
    estado: indice < 22 ? 'Presente' : 'Ausente', // 22/25 = 88 %
  }))
  const resultado = calcularCriterio(criterio, { ...datosVacios, asistencia }, { fechasClase })
  assert.equal(resultado.puntos, 1)
})

test('modo bandas: debajo de la banda más baja otorga 0', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Asistencia',
    puntosMax: 2,
    modo: 'bandas',
    bandas: [{ desde: 0.6, puntos: 0.5 }],
    fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false }],
  }
  const asistencia = [
    { fecha: '2026-09-01', estado: 'Presente' },
    { fecha: '2026-09-03', estado: 'Ausente' },
  ]
  assert.equal(calcularCriterio(criterio, { ...datosVacios, asistencia }, { fechasClase }).puntos, 0)
})

test('criterio sin datos vale 0 y queda marcado', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Participación',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'participacion', escalaMax: 5, obligatoria: false }],
  }
  const resultado = calcularCriterio(criterio, datosVacios, { fechasClase })
  assert.equal(resultado.sinDatos, true)
  assert.equal(resultado.puntos, 0)
  assert.equal(resultado.fraccion, null)
})

test('peso desigual entre fuentes', () => {
  const criterio: CriterioRubrica = {
    nombre: 'Mixto',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [
      { tipo: 'item', itemNombre: 'A', itemParcial: 1, escalaMax: 10, obligatoria: true, peso: 3 },
      { tipo: 'item', itemNombre: 'B', itemParcial: 1, escalaMax: 10, obligatoria: true, peso: 1 },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [
      { nombre: 'A', parcial: 1, nota: 10 },
      { nombre: 'B', parcial: 1, nota: 0 },
    ],
    participacion: [],
    asistencia: [],
  }
  // (1×3 + 0×1) / 4 = 0.75 → 1.5
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 1.5)
})

test('rúbrica Filosofía: 3 criterios calculables suman 4.88 / 6', () => {
  const definicion: DefinicionRubrica = {
    criterios: [
      {
        nombre: 'Participación en Clases',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [{ tipo: 'participacion', escalaMax: 5, obligatoria: false }],
      },
      {
        nombre: 'Asistencia y Puntualidad',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false }],
      },
      {
        nombre: 'Creatividad, Debate y Otros',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [
          { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: true },
          { tipo: 'item', itemNombre: 'Debate 2', itemParcial: 1, escalaMax: 10, obligatoria: false },
        ],
      },
    ],
  }
  const asistencia = Array.from({ length: 25 }, (_, indice) => ({
    fecha: `2026-09-${String(indice + 1).padStart(2, '0')}`,
    estado: indice < 22 ? 'Presente' : 'Ausente', // 88 %
  }))
  const datos: DatosEstudianteRubrica = {
    items: [{ nombre: 'Debate 1', parcial: 1, nota: 8 }],
    participacion: [
      { fecha: '2026-09-01', nivel: 4 },
      { fecha: '2026-09-03', nivel: 3.6 },
    ], // promedio 3.8 → 0.76 → 1.52
    asistencia,
  }
  const resultado = calcularRubrica(definicion, datos, { fechasClase })
  assert.deepEqual(resultado.criterios.map(criterio => criterio.puntos), [1.52, 1.76, 1.6])
  assert.equal(resultado.total, 4.88)
  assert.equal(resultado.totalMax, 6)
})

test('notaSalida reescala el total a la escala indicada', () => {
  const definicion: DefinicionRubrica = {
    criterios: [
      {
        nombre: 'A',
        puntosMax: 6,
        modo: 'lineal',
        fuentes: [{ tipo: 'item', itemNombre: 'X', itemParcial: 1, escalaMax: 10, obligatoria: true }],
      },
    ],
  }
  const datos: DatosEstudianteRubrica = { items: [{ nombre: 'X', parcial: 1, nota: 5 }], participacion: [], asistencia: [] }
  const resultado = calcularRubrica(definicion, datos, { fechasClase }, 10)
  assert.equal(resultado.total, 3)
  assert.equal(resultado.notaSalida, 5)
})

test('valor crudo mayor a la escala se acota a 1', () => {
  const criterio: CriterioRubrica = {
    nombre: 'A',
    puntosMax: 2,
    modo: 'lineal',
    fuentes: [{ tipo: 'item', itemNombre: 'X', itemParcial: 1, escalaMax: 10, obligatoria: true }],
  }
  const datos: DatosEstudianteRubrica = { items: [{ nombre: 'X', parcial: 1, nota: 12 }], participacion: [], asistencia: [] }
  assert.equal(calcularCriterio(criterio, datos, { fechasClase }).puntos, 2)
})

test('borrador de comentario lista criterios incompletos y actividades obligatorias sin nota', () => {
  const definicion: DefinicionRubrica = {
    criterios: [
      {
        nombre: 'Asistencia',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [{ tipo: 'asistencia', escalaMax: 100, obligatoria: false }],
      },
      {
        nombre: 'Debate',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [
          { tipo: 'item', itemNombre: 'Debate 1', itemParcial: 1, escalaMax: 10, obligatoria: true },
          { tipo: 'item', itemNombre: 'Debate 2', itemParcial: 1, escalaMax: 10, obligatoria: true },
        ],
      },
    ],
  }
  const datos: DatosEstudianteRubrica = {
    items: [{ nombre: 'Debate 1', parcial: 1, nota: 8 }],
    participacion: [],
    asistencia: [{ fecha: '2026-09-01', estado: 'Presente' }],
  }
  const borrador = borradorComentarioDesdeResultado(calcularRubrica(definicion, datos, { fechasClase }))
  // Asistencia 100 % → completa, no aparece. Debate: Debate 2 obligatorio sin nota cuenta 0 (valorCrudo null).
  assert.equal(borrador, 'Debate: 0.8/2 (Debate 1 8/10; falta: Debate 2).')
})

test('borrador vacío cuando todos los criterios están completos', () => {
  const definicion: DefinicionRubrica = {
    criterios: [
      {
        nombre: 'A',
        puntosMax: 2,
        modo: 'lineal',
        fuentes: [{ tipo: 'item', itemNombre: 'X', itemParcial: 1, escalaMax: 10, obligatoria: true }],
      },
    ],
  }
  const datos: DatosEstudianteRubrica = { items: [{ nombre: 'X', parcial: 1, nota: 10 }], participacion: [], asistencia: [] }
  assert.equal(borradorComentarioDesdeResultado(calcularRubrica(definicion, datos, { fechasClase })), '')
})
