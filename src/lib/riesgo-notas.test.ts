// Ejecutar: node --test src/lib/riesgo-notas.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularNotasBajas, type ItemNotaRiesgo, type RubricaEscala } from './riesgo-notas.ts'

const item = (parcial: number, nombre: string, nota: number | null, fuente = 'moodle', tipo = 'tarea'): ItemNotaRiesgo =>
  ({ estudiante_id: 'e1', parcial, nombre_item: nombre, tipo, nota, fuente })

const rubricaSobre6: RubricaEscala = {
  parcial: 1,
  nombre_columna: 'ACD1',
  escala_salida: null,
  definicion: { criterios: [{ puntosMax: 2 }, { puntosMax: 2 }, { puntosMax: 2 }] },
}

test('una sola columna baja basta aunque la otra esté en el máximo', () => {
  const resultado = calcularNotasBajas([item(1, 'ACD1', 3, 'rubrica'), item(1, 'Taller', 10)], [rubricaSobre6])
  assert.equal(resultado.e1.length, 1)
  assert.deepEqual(resultado.e1[0], { columna: 'ACD1', parcial: 1, nota: 3, max: 6, pct: 50 })
})

test('columna sin rúbrica se asume sobre 10', () => {
  const resultado = calcularNotasBajas([item(1, 'Taller', 6.9)], [])
  assert.equal(resultado.e1[0].pct, 69)
})

test('exactamente 70 % no es riesgo', () => {
  assert.deepEqual(calcularNotasBajas([item(1, 'Taller', 7), item(1, 'ACD1', 4.2, 'rubrica')], [rubricaSobre6]), {})
})

test('ignora en_curso, totales, notas vacías y escala_salida respetada', () => {
  const resultado = calcularNotasBajas(
    [item(1, 'A', 1, 'en_curso'), item(1, 'B', 1, 'moodle', 'subtotal_categoria'), item(1, 'C', null)],
    []
  )
  assert.deepEqual(resultado, {})
  const conEscala: RubricaEscala = { ...rubricaSobre6, escala_salida: 10 }
  assert.equal(calcularNotasBajas([item(1, 'ACD1', 6, 'rubrica')], [conEscala]).e1[0].pct, 60)
})
