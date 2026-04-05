import type { Database } from './database.types'

// Aliases de tipos de tabla
export type Profesor        = Database['public']['Tables']['profesores']['Row']
export type Curso           = Database['public']['Tables']['cursos']['Row']
export type Estudiante      = Database['public']['Tables']['estudiantes']['Row']
export type PerfilEstudiante = Database['public']['Tables']['perfiles_estudiante']['Row']
export type RegistroAsistencia = Database['public']['Tables']['asistencia']['Row']
export type Participacion   = Database['public']['Tables']['participacion']['Row']
export type Calificacion    = Database['public']['Tables']['calificaciones']['Row']
export type Trabajo         = Database['public']['Tables']['trabajos_asignados']['Row']
export type ObservacionTrabajo = Database['public']['Tables']['observaciones_trabajo']['Row']
export type BitacoraClase   = Database['public']['Tables']['bitacora_clase']['Row']
export type HorarioClase    = Database['public']['Tables']['horarios_clases']['Row']
export type AnuncioTutoria  = Database['public']['Tables']['anuncios_tutoria_curso']['Row']

// Tipos de Insert
export type CursoInsert      = Database['public']['Tables']['cursos']['Insert']
export type EstudianteInsert = Database['public']['Tables']['estudiantes']['Insert']
export type AsistenciaInsert = Database['public']['Tables']['asistencia']['Insert']
export type ParticipacionInsert = Database['public']['Tables']['participacion']['Insert']
export type CalificacionInsert = Database['public']['Tables']['calificaciones']['Insert']
export type TrabajoInsert    = Database['public']['Tables']['trabajos_asignados']['Insert']
export type HorarioClaseInsert = Database['public']['Tables']['horarios_clases']['Insert']
export type AnuncioTutoriaInsert = Database['public']['Tables']['anuncios_tutoria_curso']['Insert']

// Tipos compuestos para vistas
export type EstudianteConCalificaciones = Estudiante & {
  calificaciones: Calificacion | null
}

export type EstudianteConStats = Estudiante & {
  total_sesiones: number
  presentes: number
  ausentes: number
  porcentaje: number
}

export type FichaEstudiante = {
  estudiante: Estudiante
  perfil: PerfilEstudiante | null
  calificaciones: Calificacion | null
  asistencia: RegistroAsistencia[]
  participacion: Participacion[]
  trabajos: (Trabajo & { observaciones: ObservacionTrabajo[] })[]
  stats: {
    total_sesiones: number
    presentes: number
    ausentes: number
    atrasos: number
    porcentaje: number
    promedio_participacion: number | null
  }
}

export type ResumenAsistencia = {
  estudiante: Estudiante
  registros: RegistroAsistencia[]
  presentes: number
  ausentes: number
  atrasos: number
  porcentaje: number
}

// Estados de trabajo
export const ESTADOS_TRABAJO = ['Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado'] as const
export type EstadoTrabajo = typeof ESTADOS_TRABAJO[number]

export const NIVELES_PARTICIPACION = [1, 2, 3, 4, 5] as const
export type NivelParticipacion = typeof NIVELES_PARTICIPACION[number]
