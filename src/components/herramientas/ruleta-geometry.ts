// Geometría compartida entre la ruleta principal (Ruleta.tsx) y la ventana
// proyector (modo-clase/[bitacoraId]/proyector) — deben dibujar el mismo círculo.

export type RuletaItem = { id: string; label: string }

export const RULETA_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
]

export const getRuletaColor = (i: number) => RULETA_COLORS[i % RULETA_COLORS.length]

export const RULETA_SIZE = 340
export const RULETA_CX = RULETA_SIZE / 2
export const RULETA_CY = RULETA_SIZE / 2
export const RULETA_R = RULETA_SIZE / 2 - 5

export function ruletaPolar(angle: number, r: number) {
  return {
    x: RULETA_CX + r * Math.cos(angle - Math.PI / 2),
    y: RULETA_CY + r * Math.sin(angle - Math.PI / 2),
  }
}

export function ruletaSegPath(i: number, segAngle: number): string {
  const a0 = i * segAngle
  const a1 = a0 + segAngle
  const s = ruletaPolar(a0, RULETA_R)
  const e = ruletaPolar(a1, RULETA_R)
  const large = segAngle > Math.PI ? 1 : 0
  return `M ${RULETA_CX} ${RULETA_CY} L ${s.x} ${s.y} A ${RULETA_R} ${RULETA_R} 0 ${large} 1 ${e.x} ${e.y} Z`
}

// Ecuador: Nombre1 [Nombre2] Apellido1 [Apellido2]
export function formatStudentName(nombre: string): string {
  const words = nombre.trim().split(/\s+/)
  if (words.length >= 4) return `${words[0]} ${words[2]}`
  if (words.length === 3) return `${words[0]} ${words[1]}`
  return words[0]
}

export function ruletaShortLabel(label: string, n: number, libre: boolean): string {
  const base = libre ? label : formatStudentName(label)
  const max = libre
    ? (n <= 8 ? 16 : n <= 15 ? 12 : n <= 25 ? 9 : 7)
    : (n <= 8 ? 14 : n <= 15 ? 11 : n <= 25 ? 8 : 6)
  return base.length <= max ? base : base.slice(0, max - 1) + '…'
}

export function ruletaFontSize(n: number): number {
  if (n <= 6) return 10
  if (n <= 10) return 9
  if (n <= 16) return 7.5
  if (n <= 25) return 6.5
  return 5.5
}

export type RuletaSyncState = {
  items: RuletaItem[]
  rotation: number
  spinning: boolean
  ticker: string | null
  winnerLabel: string | null
  libre: boolean
}

export const ruletaChannelName = (bitacoraId: string) => `ruleta-sync-${bitacoraId}`
