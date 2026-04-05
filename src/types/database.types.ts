// Tipos del esquema de Supabase
// Regenerar con: npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profesores: {
        Row: {
          id: string
          nombre: string
          email: string
          avatar_url: string | null
          institucion: string | null
          created_at: string
        }
        Insert: {
          id: string
          nombre: string
          email: string
          avatar_url?: string | null
          institucion?: string | null
          created_at?: string
        }
        Update: {
          nombre?: string
          avatar_url?: string | null
          institucion?: string | null
        }
        Relationships: []
      }
      cursos: {
        Row: {
          id: string
          profesor_id: string
          codigo: string
          asignatura: string
          periodo: string
          fecha_inicio: string | null
          fecha_fin: string | null
          horas_semana: number
          num_sesiones: number
          horas_teoricas: number
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          codigo: string
          asignatura: string
          periodo: string
          fecha_inicio?: string | null
          fecha_fin?: string | null
          horas_semana?: number
          num_sesiones?: number
          horas_teoricas?: number
          created_at?: string
        }
        Update: {
          codigo?: string
          asignatura?: string
          periodo?: string
          fecha_inicio?: string | null
          fecha_fin?: string | null
          horas_semana?: number
          num_sesiones?: number
          horas_teoricas?: number
        }
        Relationships: [
          {
            foreignKeyName: "cursos_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          }
        ]
      }
      horarios_clases: {
        Row: {
          id: string
          curso_id: string
          profesor_id: string
          dia_semana: string
          hora_inicio: string
          hora_fin: string
          tipo: string
          created_at: string
        }
        Insert: {
          id?: string
          curso_id: string
          profesor_id: string
          dia_semana: string
          hora_inicio: string
          hora_fin: string
          tipo?: string
          created_at?: string
        }
        Update: {
          id?: string
          curso_id?: string
          profesor_id?: string
          dia_semana?: string
          hora_inicio?: string
          hora_fin?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_clases_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_clases_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          }
        ]
      }
      anuncios_tutoria_curso: {
        Row: {
          id: string
          horario_clase_id: string
          estudiante_id: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          horario_clase_id: string
          estudiante_id: string
          fecha: string
          created_at?: string
        }
        Update: {
          id?: string
          horario_clase_id?: string
          estudiante_id?: string
          fecha?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_tutoria_curso_horario_clase_id_fkey"
            columns: ["horario_clase_id"]
            isOneToOne: false
            referencedRelation: "horarios_clases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_tutoria_curso_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          }
        ]
      }
      estudiantes: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          nombre: string
          email: string
          tutoria: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          nombre: string
          email: string
          tutoria?: boolean
          created_at?: string
        }
        Update: {
          nombre?: string
          email?: string
          tutoria?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "estudiantes_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          }
        ]
      }
      perfiles_estudiante: {
        Row: {
          id: string
          profesor_id: string
          estudiante_id: string
          carrera: string | null
          trabaja: boolean
          laptop: boolean
          genero: string | null
          edad: number | null
        }
        Insert: {
          id?: string
          profesor_id: string
          estudiante_id: string
          carrera?: string | null
          trabaja?: boolean
          laptop?: boolean
          genero?: string | null
          edad?: number | null
        }
        Update: {
          carrera?: string | null
          trabaja?: boolean
          laptop?: boolean
          genero?: string | null
          edad?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_estudiante_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: true
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          }
        ]
      }
      asistencia: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha: string
          semana: string | null
          estado: string
          atraso: boolean
          horas: number
          momento: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha?: string
          semana?: string | null
          estado: string
          atraso?: boolean
          horas?: number
          momento?: string | null
          created_at?: string
        }
        Update: {
          estado?: string
          atraso?: boolean
          horas?: number
          momento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          }
        ]
      }
      participacion: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha: string
          semana: string | null
          nivel: number | null
          observacion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha?: string
          semana?: string | null
          nivel?: number | null
          observacion?: string | null
          created_at?: string
        }
        Update: {
          nivel?: number | null
          observacion?: string | null
        }
        Relationships: []
      }
      calificaciones: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          acd1: number
          ta1: number
          pe1: number
          ex1: number
          acd2: number
          ta2: number
          pe2: number
          ex2: number
          updated_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          acd1?: number
          ta1?: number
          pe1?: number
          ex1?: number
          acd2?: number
          ta2?: number
          pe2?: number
          ex2?: number
          updated_at?: string
        }
        Update: {
          acd1?: number
          ta1?: number
          pe1?: number
          ex1?: number
          acd2?: number
          ta2?: number
          pe2?: number
          ex2?: number
          updated_at?: string
        }
        Relationships: []
      }
      trabajos_asignados: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          tipo: string
          tema: string | null
          descripcion: string | null
          estado: string
          fecha_asignacion: string
          progreso: number
          urgente: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          tipo: string
          tema?: string | null
          descripcion?: string | null
          estado?: string
          fecha_asignacion?: string
          progreso?: number
          urgente?: boolean | null
          created_at?: string
        }
        Update: {
          tipo?: string
          tema?: string | null
          descripcion?: string | null
          estado?: string
          progreso?: number
          urgente?: boolean | null
        }
        Relationships: []
      }
      observaciones_trabajo: {
        Row: {
          id: string
          profesor_id: string
          trabajo_id: string
          observacion: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          trabajo_id: string
          observacion: string
          fecha?: string
          created_at?: string
        }
        Update: {
          observacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "observaciones_trabajo_trabajo_id_fkey"
            columns: ["trabajo_id"]
            isOneToOne: false
            referencedRelation: "trabajos_asignados"
            referencedColumns: ["id"]
          }
        ]
      }
      bitacora_clase: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          fecha: string
          semana: string | null
          tema: string
          actividades: string | null
          materiales: string | null
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          fecha?: string
          semana?: string | null
          tema: string
          actividades?: string | null
          materiales?: string | null
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          tema?: string
          actividades?: string | null
          materiales?: string | null
          observaciones?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_semana: {
        Args: {
          p_curso_id: string
        }
        Returns: string
      }
      stats_asistencia: {
        Args: {
          p_estudiante_id: string
          p_curso_id: string
        }
        Returns: {
          total_sesiones: number
          presentes: number
          ausentes: number
          atrasos: number
          porcentaje: number
          promedio_part: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
