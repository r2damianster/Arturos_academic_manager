/**
 * Parser puro para archivos de calificaciones exportados desde Moodle.
 * Soporta .ods, .xlsx, .xls, .csv (via SheetJS).
 * Sin dependencias de Supabase — testable de forma aislada.
 */

import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type TipoColumna =
  | 'tarea'
  | 'subtotal_categoria'
  | 'ponderacion'
  | 'total_parcial'
  | 'total_recuperacion'
  | 'total_curso'
  | 'asistencia'
  | 'descarga'
  | 'identidad'
  | 'otro'

export interface ColumnaIdentidad {
  col_index: number
  header_raw: string
  rol: 'nombre' | 'apellido' | 'email' | 'num_id' | 'institucion' | 'departamento' | 'otro'
}

export interface ColumnaNota {
  col_index: number
  header_raw: string
  nombre_limpio: string      // clave estable de upsert (sin "(Real)", trimmed)
  tipo: TipoColumna
  parcial: number | null     // extraído del header (P1, P2...)
  categoria: string | null   // nombre de categoría (C1, C2...) si es subtotal
  importable: boolean        // false si es total/ponderacion/asistencia (no se importa)
  muestra_valores: string[]  // primeros 5 valores no vacíos/no "-"
}

export interface FilaEstudiante {
  nombre: string
  apellido: string
  email: string          // campo "Dirección de correo"
  num_id: string         // campo "Número de ID" (puede ser email u otro identificador)
  valores: Record<number, number | null>  // col_index → nota (null si "-" o vacío)
}

export interface ResultadoParser {
  columnas_identidad: ColumnaIdentidad[]
  columnas_notas: ColumnaNota[]
  filas_estudiantes: FilaEstudiante[]
  fecha_descarga_moodle: Date | null
  es_moodle: boolean     // heurística: ¿parece un export Moodle?
  advertencias: string[]
}

// ---------------------------------------------------------------------------
// Regex de clasificación de headers
// ---------------------------------------------------------------------------

const RE_TAREA        = /^tarea:/i
const RE_SUBTOTAL     = /^total\s+p(\d+)\s*-\s*(.+?)\s*\(c\d+\)\s*\(real\)\s*$/i
const RE_PONDERACION  = /^ponderaci[oó]n/i
const RE_TOTAL_PARC   = /^total\s+p(\d+)\s*\(real\)\s*$/i
const RE_TOTAL_RECUP  = /^total\s+recuperaci[oó]n/i
const RE_TOTAL_CURSO  = /^total\s+del\s+curso/i
const RE_ASISTENCIA   = /^asistencia:/i
const RE_DESCARGA     = /[uú]ltima\s+descarga/i
const RE_PARCIAL_NUM  = /\bP(\d+)\b/i  // extrae número de parcial de cualquier header

// Campos de identidad conocidos (lowercase)
const IDENTIDAD_MAP: Record<string, ColumnaIdentidad['rol']> = {
  'nombre': 'nombre',
  'apellido(s)': 'apellido',
  'apellidos': 'apellido',
  'número de id': 'num_id',
  'numero de id': 'num_id',
  'institución': 'institucion',
  'institucion': 'institucion',
  'departamento': 'departamento',
  'dirección de correo': 'email',
  'direccion de correo': 'email',
  'correo electrónico': 'email',
  'correo electronico': 'email',
  'email': 'email',
}

// ---------------------------------------------------------------------------
// Normalización de nombre_item (clave estable de upsert)
// ---------------------------------------------------------------------------

function normalizarNombreItem(header: string): string {
  return header
    .replace(/\s*\(real\)\s*$/i, '')      // quitar sufijo "(Real)"
    .replace(/^tarea:\s*/i, '')           // quitar prefijo "Tarea:"
    .replace(/\s+/g, ' ')                 // colapsar espacios
    .trim()
}

// ---------------------------------------------------------------------------
// Clasificación de una columna dado su header
// ---------------------------------------------------------------------------

function clasificarColumna(
  header: string,
  colIndex: number,
  todasLasFilas: string[][]
): ColumnaNota {
  const h = header.trim()
  const hLower = h.toLowerCase()

  // Muestras de valores (primeros 5 no vacíos ni "-")
  const muestra_valores: string[] = []
  for (const fila of todasLasFilas) {
    if (muestra_valores.length >= 5) break
    const val = (fila[colIndex] ?? '').toString().trim()
    if (val && val !== '-' && val !== '') muestra_valores.push(val)
  }

  // Extraer número de parcial del header
  const matchParcial = RE_PARCIAL_NUM.exec(h)
  const parcial = matchParcial ? parseInt(matchParcial[1], 10) : null

  if (RE_TOTAL_CURSO.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'total_curso', parcial: null, categoria: null, importable: false, muestra_valores }
  }
  if (RE_TOTAL_RECUP.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'total_recuperacion', parcial: null, categoria: null, importable: false, muestra_valores }
  }
  if (RE_DESCARGA.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'descarga', parcial: null, categoria: null, importable: false, muestra_valores }
  }
  if (RE_ASISTENCIA.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'asistencia', parcial, categoria: null, importable: false, muestra_valores }
  }
  if (RE_PONDERACION.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'ponderacion', parcial, categoria: null, importable: false, muestra_valores }
  }
  if (RE_TOTAL_PARC.test(h)) {
    const m = RE_TOTAL_PARC.exec(h)!
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'total_parcial', parcial: parseInt(m[1], 10), categoria: null, importable: false, muestra_valores }
  }
  if (RE_SUBTOTAL.test(h)) {
    const m = RE_SUBTOTAL.exec(h)!
    const parcialNum = parseInt(m[1], 10)
    const categoriaRaw = m[2].trim()
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'subtotal_categoria', parcial: parcialNum, categoria: categoriaRaw, importable: true, muestra_valores }
  }
  if (RE_TAREA.test(hLower)) {
    return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'tarea', parcial, categoria: null, importable: true, muestra_valores }
  }

  // otro
  return { col_index: colIndex, header_raw: h, nombre_limpio: normalizarNombreItem(h), tipo: 'otro', parcial, categoria: null, importable: false, muestra_valores }
}

// ---------------------------------------------------------------------------
// Parsear un valor de celda Moodle → number | null
// ---------------------------------------------------------------------------

function parsearNota(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === '' || s === '-') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Función principal de parseo
// ---------------------------------------------------------------------------

export function parsearArchivoMoodle(buffer: ArrayBuffer): ResultadoParser {
  const advertencias: string[] = []

  const wb = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  if (sheetName.toLowerCase() !== 'calificaciones') {
    advertencias.push(`La hoja se llama "${sheetName}", no "Calificaciones". Puede no ser un export Moodle estándar.`)
  }

  // sheet_to_json con header:1 → array de arrays, raw:false para obtener texto formateado
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][]

  if (rawRows.length < 2) {
    return { columnas_identidad: [], columnas_notas: [], filas_estudiantes: [], fecha_descarga_moodle: null, es_moodle: false, advertencias: ['Archivo vacío o sin datos.'] }
  }

  const headerRow = rawRows[0] as (string | null)[]
  const dataRows  = rawRows.slice(1).filter(r => r.some(c => c !== null && c !== '')) as string[][]

  // Clasificar columnas
  const columnas_identidad: ColumnaIdentidad[] = []
  const columnas_notas: ColumnaNota[] = []

  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] ?? '').toString().trim()
    if (!h) continue

    const hLower = h.toLowerCase()
    const rolIdentidad = IDENTIDAD_MAP[hLower]
    if (rolIdentidad) {
      columnas_identidad.push({ col_index: i, header_raw: h, rol: rolIdentidad })
    } else {
      columnas_notas.push(clasificarColumna(h, i, dataRows))
    }
  }

  // Detectar columnas de identidad por rol
  const getColByRol = (rol: ColumnaIdentidad['rol']) =>
    columnas_identidad.find(c => c.rol === rol)?.col_index ?? -1

  const colNombre   = getColByRol('nombre')
  const colApellido = getColByRol('apellido')
  const colEmail    = getColByRol('email')
  const colNumId    = getColByRol('num_id')

  // Heurística: es Moodle si tiene Nombre + Apellido + Email
  const es_moodle = colNombre >= 0 && colApellido >= 0 && colEmail >= 0

  if (!es_moodle) {
    advertencias.push('No se detectaron columnas "Nombre", "Apellido(s)" y "Dirección de correo". El archivo puede no ser un export de Moodle.')
  }

  // Detectar columna de descarga Moodle para fecha
  const colDescarga = columnas_notas.find(c => c.tipo === 'descarga')
  let fecha_descarga_moodle: Date | null = null
  if (colDescarga && dataRows[0]) {
    const valDescarga = (dataRows[0][colDescarga.col_index] ?? '').toString().trim()
    if (valDescarga) {
      const ts = parseInt(valDescarga, 10)
      if (!isNaN(ts) && ts > 1_000_000_000) {
        fecha_descarga_moodle = new Date(ts * 1000)
      }
    }
  }

  // Parsear filas de estudiantes
  const filas_estudiantes: FilaEstudiante[] = []
  for (const row of dataRows) {
    const email   = colEmail   >= 0 ? (row[colEmail]   ?? '').toString().trim().toLowerCase() : ''
    const num_id  = colNumId   >= 0 ? (row[colNumId]   ?? '').toString().trim().toLowerCase() : ''
    const nombre  = colNombre  >= 0 ? (row[colNombre]  ?? '').toString().trim() : ''
    const apellido = colApellido >= 0 ? (row[colApellido] ?? '').toString().trim() : ''

    if (!email && !nombre) continue  // fila vacía

    const valores: Record<number, number | null> = {}
    for (const col of columnas_notas) {
      if (!col.importable) continue
      valores[col.col_index] = parsearNota(row[col.col_index])
    }

    filas_estudiantes.push({ nombre, apellido, email, num_id, valores })
  }

  // Advertencias adicionales
  if (filas_estudiantes.length === 0) {
    advertencias.push('No se encontraron filas de estudiantes con datos.')
  }
  const tareasCount = columnas_notas.filter(c => c.tipo === 'tarea').length
  if (tareasCount === 0) {
    advertencias.push('No se detectaron columnas de tipo "Tarea:". El archivo puede no tener calificaciones individuales.')
  }

  return {
    columnas_identidad,
    columnas_notas,
    filas_estudiantes,
    fecha_descarga_moodle,
    es_moodle,
    advertencias,
  }
}
