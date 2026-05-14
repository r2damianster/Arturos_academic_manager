export type EstadoAsistencia = 'Presente' | 'Ausente' | 'Atraso' | null | string

export function buildMoodleCSV(
  students: { id: string; email: string }[],
  attendance: Record<string, EstadoAsistencia>,
  hourIndex: number  // 0-based; determines cómo se trata "Atraso"
): string {
  const lines = ['username,status']
  for (const s of students) {
    const estado = attendance[s.id]
    let status: string
    if (estado === 'Presente') {
      status = ''
    } else if (estado === 'Atraso') {
      // Primera hora: FI (llegó tarde = falta esa hora); horas siguientes: presente (vacío)
      status = hourIndex === 0 ? 'FI' : ''
    } else {
      // Ausente / null / desconocido → falta injustificada
      status = 'FI'
    }
    lines.push(`${s.email},${status}`)
  }
  return lines.join('\n')
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function calcularHorasDesdeHorario(horaInicio: string, horaFin: string): number {
  const [sh, sm] = horaInicio.split(':').map(Number)
  const [eh, em] = horaFin.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(1, Math.round(mins / 60))
}
