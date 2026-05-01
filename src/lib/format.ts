/** Apellido1 Nombre1 a partir del nombre completo ecuatoriano (4 palabras: N1 N2 A1 A2) */
export function formatNombreCorto(nombre: string): string {
  const w = nombre.trim().split(/\s+/)
  if (w.length >= 4) return `${w[2]} ${w[0]}`
  if (w.length === 3) return `${w[1]} ${w[0]}`
  return nombre
}
