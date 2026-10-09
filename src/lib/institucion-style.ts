export interface InstitucionStyle {
  label: string
  badgeClass: string
  borderClass: string
  dotClass: string
}

// Clases completas (no concatenadas) para que Tailwind las detecte.
// Se evitan azul/verde/ámbar: ya indican estados de clase.
const INSTITUCION_PALETTE: Omit<InstitucionStyle, 'label'>[] = [
  { badgeClass: 'bg-rose-900/40 text-rose-300 border border-rose-600/30',       borderClass: 'border-l-rose-500',    dotClass: 'bg-rose-500' },
  { badgeClass: 'bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-600/30', borderClass: 'border-l-fuchsia-500', dotClass: 'bg-fuchsia-500' },
  { badgeClass: 'bg-cyan-900/40 text-cyan-300 border border-cyan-600/30',       borderClass: 'border-l-cyan-500',    dotClass: 'bg-cyan-500' },
  { badgeClass: 'bg-orange-900/40 text-orange-300 border border-orange-600/30', borderClass: 'border-l-orange-500',  dotClass: 'bg-orange-500' },
  { badgeClass: 'bg-lime-900/40 text-lime-300 border border-lime-600/30',       borderClass: 'border-l-lime-500',    dotClass: 'bg-lime-500' },
  { badgeClass: 'bg-pink-900/40 text-pink-300 border border-pink-600/30',       borderClass: 'border-l-pink-500',    dotClass: 'bg-pink-500' },
]

const NEUTRAL_STYLE: Omit<InstitucionStyle, 'label'> = {
  badgeClass: 'bg-gray-800 text-gray-400 border border-gray-700',
  borderClass: 'border-l-gray-700',
  dotClass: 'bg-gray-600',
}

function hashInstitucion(normalizedName: string): number {
  let hash = 0
  for (let charIndex = 0; charIndex < normalizedName.length; charIndex++) {
    hash = (hash * 31 + normalizedName.charCodeAt(charIndex)) >>> 0
  }
  return hash
}

/** Color estable por institución: el mismo texto siempre produce el mismo color. */
export function getInstitucionStyle(institucion: string | null | undefined): InstitucionStyle {
  const trimmedName = institucion?.trim()
  if (!trimmedName) return { label: '', ...NEUTRAL_STYLE }
  const normalizedName = trimmedName.toUpperCase()
  const paletteEntry = INSTITUCION_PALETTE[hashInstitucion(normalizedName) % INSTITUCION_PALETTE.length]
  return { label: trimmedName, ...paletteEntry }
}
