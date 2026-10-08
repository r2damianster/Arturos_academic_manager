/** Apellido1 Nombre1 a partir del nombre completo ecuatoriano (4 palabras: N1 N2 A1 A2) */
export function formatNombreCorto(nombre: string): string {
  const w = nombre.trim().split(/\s+/)
  if (w.length >= 4) return `${w[2]} ${w[0]}`
  if (w.length === 3) return `${w[1]} ${w[0]}`
  return nombre
}

/**
 * Nombre para llamar al estudiante en clase (pase de lista, modo clase, ruleta).
 * Usa el nombre preferido si existe; si no, el formato corto normal.
 * NO usar en reportes, calificaciones, exportaciones ni registros formales.
 */
export function nombreParaLlamar(estudiante: { nombre: string; nombre_preferido?: string | null }): string {
  const preferredName = estudiante.nombre_preferido?.trim()
  return preferredName ? preferredName : formatNombreCorto(estudiante.nombre)
}
