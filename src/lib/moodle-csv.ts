export type EstadoAsistencia = 'Presente' | 'Ausente' | 'Atraso' | null | string

export function buildMoodleCSV(
  students: { id: string; email: string; estado?: string }[],
  attendance: Record<string, EstadoAsistencia>,
  hourIndex: number  // 0-based; determines cómo se trata "Atraso"
): string {
  const lines = ['username,status']
  for (const s of students) {
    // Omitir correos ficticios/provisionales para evitar error en Moodle
    if (esCorreoNoValidoParaMoodle(s.email)) {
      continue
    }

    const estado = s.estado === 'retirado' ? 'Ausente' : attendance[s.id]
    let status: string
    if (estado === 'Presente') {
      status = 'P'
    } else if (estado === 'Atraso') {
      // Primera hora: FI (llegó tarde = falta esa hora); horas siguientes: presente (P)
      status = hourIndex === 0 ? 'FI' : 'P'
    } else {
      // Ausente / null / desconocido / retirado → falta injustificada
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

const esCorreoNoValidoParaMoodle = (email: string | null | undefined) =>
  !email || email.startsWith('sinregistro.') || email.endsWith('@pendiente.local')

/** Estudiantes que buildMoodleCSV omite por no tener correo real (no se pueden importar a Moodle). */
export function getEstudiantesOmitidosMoodle<T extends { email: string; nombre?: string }>(students: T[]): T[] {
  return students.filter(student => esCorreoNoValidoParaMoodle(student.email))
}

/** Avisa al profesor de los estudiantes que no aparecen en el CSV descargado. */
export function avisarOmitidosMoodle(students: { email: string; nombre?: string }[]) {
  const omittedStudents = getEstudiantesOmitidosMoodle(students)
  if (omittedStudents.length === 0) return
  const names = omittedStudents.map(student => student.nombre ?? student.email).join('\n• ')
  window.alert(
    `El CSV de Moodle omitió ${omittedStudents.length} estudiante(s) sin correo real:\n• ${names}\n\nRegístralos manualmente en Moodle.`
  )
}
