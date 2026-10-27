// Semanas calendario (lunes a domingo) entre la fecha de asignación y la fecha de una clase.
// 0 = misma semana de la asignación, 1 = semana siguiente, etc. Una clase suspendida no corre la fase.

function lunesDeLaSemana(fecha: string): number {
  const date = new Date(fecha + 'T12:00:00')
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - daysSinceMonday)
  return date.getTime()
}

export function semanasEntre(fechaAsignacion: string, fechaClase: string): number {
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.round((lunesDeLaSemana(fechaClase) - lunesDeLaSemana(fechaAsignacion)) / millisecondsPerWeek)
}
