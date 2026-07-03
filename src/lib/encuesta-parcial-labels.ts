export const LABELS_DIFICULTADES: Record<string, string> = {
  comprension_temas: 'Dificultad para entender los temas',
  falta_tiempo: 'Falta de tiempo',
  carga_trabajo_externo: 'Trabajo/prácticas afectan el estudio',
  problemas_tecnologicos: 'Problemas de conectividad o equipo',
  dificultades_personales: 'Situación personal o familiar',
  carga_otras_materias: 'Carga académica alta',
  metodologia: 'No se adapta a la metodología',
  bajo_rendimiento: 'Bajo rendimiento previo',
  ninguna: 'Sin dificultades significativas',
}

export const LABELS_IA: Record<string, string> = {
  comprension: 'Comprensión de texto',
  resumen: 'Resumir información',
  ideas: 'Generación de ideas',
  redaccion: 'Redacción',
  tareas: 'Resolución de tareas',
  verificacion: 'Verificación',
  critico: 'Análisis crítico',
  traduccion: 'Traducción',
  idiomas: 'Idiomas',
}

export function colorProm(v: number | null): string {
  if (v === null) return 'text-gray-500'
  if (v <= 2.5) return 'text-red-400'
  if (v <= 3.5) return 'text-amber-400'
  return 'text-emerald-400'
}
