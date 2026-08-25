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
          rol: string
          created_at: string
        }
        Insert: {
          id: string
          nombre: string
          email: string
          avatar_url?: string | null
          institucion?: string | null
          rol?: string
          created_at?: string
        }
        Update: {
          nombre?: string
          avatar_url?: string | null
          institucion?: string | null
          rol?: string
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
          num_parciales: number | null
          nombres_tareas: Json | null
          observacion: string | null
          institucion: string | null
          encuesta_inicial_habilitada: boolean
          encuesta_parcial_habilitada: boolean
          tipo: string
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
          num_parciales?: number | null
          nombres_tareas?: Json | null
          observacion?: string | null
          institucion?: string | null
          encuesta_inicial_habilitada?: boolean
          encuesta_parcial_habilitada?: boolean
          tipo?: string
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
          num_parciales?: number | null
          nombres_tareas?: Json | null
          observacion?: string | null
          institucion?: string | null
          encuesta_inicial_habilitada?: boolean
          encuesta_parcial_habilitada?: boolean
          tipo?: string
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
      logros_aprendizaje: {
        Row: {
          id: string
          curso_id: string
          descripcion: string
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          curso_id: string
          descripcion: string
          orden?: number
          created_at?: string
        }
        Update: {
          descripcion?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "logros_aprendizaje_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
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
          centro_computo: boolean
          obligatoria: boolean
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
          centro_computo?: boolean
          obligatoria?: boolean
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
          centro_computo?: boolean
          obligatoria?: boolean
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
          auth_user_id: string | null
          estado: string
          retirado_at: string | null
          persona_id: string
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          nombre: string
          email: string
          tutoria?: boolean
          auth_user_id?: string | null
          estado?: string
          retirado_at?: string | null
          persona_id?: string
          created_at?: string
        }
        Update: {
          nombre?: string
          email?: string
          tutoria?: boolean
          auth_user_id?: string | null
          estado?: string
          retirado_at?: string | null
          persona_id?: string
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
          observacion_part: string | null
          bitacora_id: string | null
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
          observacion_part?: string | null
          bitacora_id?: string | null
          created_at?: string
        }
        Update: {
          estado?: string
          atraso?: boolean
          horas?: number
          momento?: string | null
          observacion_part?: string | null
          bitacora_id?: string | null
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
          acd3: number | null
          ta3: number | null
          pe3: number | null
          ex3: number | null
          acd4: number | null
          ta4: number | null
          pe4: number | null
          ex4: number | null
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
          acd3?: number | null
          ta3?: number | null
          pe3?: number | null
          ex3?: number | null
          acd4?: number | null
          ta4?: number | null
          pe4?: number | null
          ex4?: number | null
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
          acd3?: number | null
          ta3?: number | null
          pe3?: number | null
          ex3?: number | null
          acd4?: number | null
          ta4?: number | null
          pe4?: number | null
          ex4?: number | null
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
      tipos_tutoria: {
        Row: {
          id: number
          profesor_id: string | null
          nombre: string
          duracion_minutos: number
          descripcion: string | null
          activo: boolean
          orden: number
          created_at: string
        }
        Insert: {
          id?: number
          profesor_id?: string | null
          nombre: string
          duracion_minutos: number
          descripcion?: string | null
          activo?: boolean
          orden?: number
          created_at?: string
        }
        Update: {
          nombre?: string
          duracion_minutos?: number
          descripcion?: string | null
          activo?: boolean
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipos_tutoria_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          }
        ]
      }
      horarios: {
        Row: {
          id: number
          profesor_id: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          estado: string
          disponible_hasta: string | null
          permitir_multiples: boolean
          buffer_minutos: number
          created_at: string
        }
        Insert: {
          id?: number
          profesor_id: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          estado?: string
          disponible_hasta?: string | null
          permitir_multiples?: boolean
          buffer_minutos?: number
          created_at?: string
        }
        Update: {
          estado?: string
          disponible_hasta?: string | null
          permitir_multiples?: boolean
          buffer_minutos?: number
        }
        Relationships: [
          {
            foreignKeyName: "horarios_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          }
        ]
      }
      reservas: {
        Row: {
          id: number
          horario_id: number | null
          fecha: string
          auth_user_id: string
          estudiante_nombre: string
          estudiante_carrera: string
          email: string
          telefono: string
          notas: string | null
          estado: string
          created_at: string
          profesor_id: string | null
          origen: string
          curso_id: string | null
          hora_inicio_manual: string | null
          hora_fin_manual: string | null
          modalidad: string
          link_zoom: string | null
          tipo_tutoria_id: number | null
          hora_inicio_reserva: string | null
          hora_fin_reserva: string | null
          duracion_minutos: number | null
        }
        Insert: {
          id?: number
          horario_id?: number | null
          fecha: string
          auth_user_id: string
          estudiante_nombre: string
          estudiante_carrera?: string
          email: string
          telefono?: string
          notas?: string | null
          estado?: string
          created_at?: string
          profesor_id?: string | null
          origen?: string
          curso_id?: string | null
          hora_inicio_manual?: string | null
          hora_fin_manual?: string | null
          modalidad?: string
          link_zoom?: string | null
          tipo_tutoria_id?: number | null
          hora_inicio_reserva?: string | null
          hora_fin_reserva?: string | null
          duracion_minutos?: number | null
        }
        Update: {
          estado?: string
          notas?: string | null
          profesor_id?: string | null
          origen?: string
          curso_id?: string | null
          hora_inicio_manual?: string | null
          hora_fin_manual?: string | null
          modalidad?: string
          link_zoom?: string | null
          tipo_tutoria_id?: number | null
          hora_inicio_reserva?: string | null
          hora_fin_reserva?: string | null
          duracion_minutos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          }
        ]
      }
      encuesta_estudiante: {
        Row: {
          id: string
          auth_user_id: string
          genero: string | null
          fecha_nac: string | null
          telefono: string | null
          gmail: string | null
          nivel_estudio: string | null
          carrera: string | null
          institucion: string | null
          carrera_inicio_deseada: number | null
          carrera_actual_deseada: number | null
          modalidad_carrera: string | null
          situacion_vivienda: string | null
          es_foraneo: boolean
          nivel_tecnologia: number | null
          tiene_laptop: boolean
          tiene_pc_escritorio: boolean
          comparte_pc: boolean
          sin_computadora: boolean
          dispositivo_movil: string | null
          trabaja: boolean
          tipo_trabajo: string | null
          horas_trabajo_diarias: number | null
          libros_anio: number | null
          gusto_escritura: number | null
          uso_ia_comprension: number | null
          uso_ia_resumen: number | null
          uso_ia_ideas: number | null
          uso_ia_redaccion: number | null
          uso_ia_tareas: number | null
          uso_ia_verificacion: number | null
          uso_ia_critico: number | null
          uso_ia_traduccion: number | null
          uso_ia_idiomas: number | null
          problemas_reportados: string | null
          consentimiento: boolean
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          genero?: string | null
          fecha_nac?: string | null
          telefono?: string | null
          gmail?: string | null
          nivel_estudio?: string | null
          carrera?: string | null
          institucion?: string | null
          carrera_inicio_deseada?: number | null
          carrera_actual_deseada?: number | null
          modalidad_carrera?: string | null
          situacion_vivienda?: string | null
          es_foraneo?: boolean
          nivel_tecnologia?: number | null
          tiene_laptop?: boolean
          tiene_pc_escritorio?: boolean
          comparte_pc?: boolean
          sin_computadora?: boolean
          dispositivo_movil?: string | null
          trabaja?: boolean
          tipo_trabajo?: string | null
          horas_trabajo_diarias?: number | null
          libros_anio?: number | null
          gusto_escritura?: number | null
          uso_ia_comprension?: number | null
          uso_ia_resumen?: number | null
          uso_ia_ideas?: number | null
          uso_ia_redaccion?: number | null
          uso_ia_tareas?: number | null
          uso_ia_verificacion?: number | null
          uso_ia_critico?: number | null
          uso_ia_traduccion?: number | null
          uso_ia_idiomas?: number | null
          problemas_reportados?: string | null
          consentimiento?: boolean
          created_at?: string
        }
        Update: {
          genero?: string | null
          fecha_nac?: string | null
          telefono?: string | null
          gmail?: string | null
          nivel_estudio?: string | null
          carrera?: string | null
          institucion?: string | null
          carrera_inicio_deseada?: number | null
          carrera_actual_deseada?: number | null
          modalidad_carrera?: string | null
          situacion_vivienda?: string | null
          es_foraneo?: boolean
          nivel_tecnologia?: number | null
          tiene_laptop?: boolean
          tiene_pc_escritorio?: boolean
          comparte_pc?: boolean
          sin_computadora?: boolean
          dispositivo_movil?: string | null
          trabaja?: boolean
          tipo_trabajo?: string | null
          horas_trabajo_diarias?: number | null
          libros_anio?: number | null
          gusto_escritura?: number | null
          uso_ia_comprension?: number | null
          uso_ia_resumen?: number | null
          uso_ia_ideas?: number | null
          uso_ia_redaccion?: number | null
          uso_ia_tareas?: number | null
          uso_ia_verificacion?: number | null
          uso_ia_critico?: number | null
          uso_ia_traduccion?: number | null
          uso_ia_idiomas?: number | null
          problemas_reportados?: string | null
          consentimiento?: boolean
        }
        Relationships: []
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
          estado: string | null
          actividades_json: Json | null
          hora_inicio_real: string | null
          razon_suspension: string | null
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
          estado?: string | null
          actividades_json?: Json | null
          hora_inicio_real?: string | null
          razon_suspension?: string | null
          created_at?: string
        }
        Update: {
          tema?: string
          actividades?: string | null
          materiales?: string | null
          observaciones?: string | null
          estado?: string | null
          actividades_json?: Json | null
          hora_inicio_real?: string | null
          razon_suspension?: string | null
        }
        Relationships: []
      }
      eventos_profesor: {
        Row: {
          id: string
          profesor_id: string
          titulo: string
          descripcion: string | null
          tipo: string
          fecha_inicio: string
          fecha_fin: string
          hora_inicio: string | null
          hora_fin: string | null
          todo_el_dia: boolean
          recurrente: boolean
          recurrencia: string | null
          recurrencia_dias: number[] | null
          recurrencia_hasta: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          titulo: string
          descripcion?: string | null
          tipo: string
          fecha_inicio: string
          fecha_fin: string
          hora_inicio?: string | null
          hora_fin?: string | null
          todo_el_dia?: boolean
          recurrente?: boolean
          recurrencia?: string | null
          recurrencia_dias?: number[] | null
          recurrencia_hasta?: string | null
          created_at?: string
        }
        Update: {
          titulo?: string
          descripcion?: string | null
          tipo?: string
          fecha_inicio?: string
          fecha_fin?: string
          hora_inicio?: string | null
          hora_fin?: string | null
          todo_el_dia?: boolean
          recurrente?: boolean
          recurrencia?: string | null
          recurrencia_dias?: number[] | null
          recurrencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_profesor_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          }
        ]
      }
      grupo_categorias: {
        Row: {
          id: string
          nombre: string
          valores: string[]
          orden: number
        }
        Insert: {
          id?: string
          nombre: string
          valores?: string[]
          orden?: number
        }
        Update: {
          nombre?: string
          valores?: string[]
          orden?: number
        }
        Relationships: []
      }
      grupos_clase: {
        Row: {
          id: string
          bitacora_id: string | null
          curso_id: string | null
          profesor_id: string
          nombre: string
          categoria: string | null
          tipo: 'aleatoria' | 'manual' | 'afinidad'
          orden: number
          abierto: boolean
          max_integrantes: number | null
          es_plantilla: boolean
          plantilla_nombre: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bitacora_id?: string | null
          curso_id?: string | null
          profesor_id: string
          nombre: string
          categoria?: string | null
          tipo: 'aleatoria' | 'manual' | 'afinidad'
          orden?: number
          abierto?: boolean
          max_integrantes?: number | null
          es_plantilla?: boolean
          plantilla_nombre?: string | null
          created_at?: string
        }
        Update: {
          nombre?: string
          categoria?: string | null
          tipo?: 'aleatoria' | 'manual' | 'afinidad'
          orden?: number
          abierto?: boolean
          max_integrantes?: number | null
          es_plantilla?: boolean
          plantilla_nombre?: string | null
        }
        Relationships: []
      }
      grupo_integrantes: {
        Row: {
          id: string
          grupo_id: string
          estudiante_id: string
          asignado_por: 'profesor' | 'estudiante'
          created_at: string
        }
        Insert: {
          id?: string
          grupo_id: string
          estudiante_id: string
          asignado_por?: 'profesor' | 'estudiante'
          created_at?: string
        }
        Update: {
          asignado_por?: 'profesor' | 'estudiante'
        }
        Relationships: []
      }
      grupo_participacion: {
        Row: {
          id: string
          grupo_id: string | null
          estudiante_id: string
          bitacora_id: string
          nota: number | null
          created_at: string
        }
        Insert: {
          id?: string
          grupo_id?: string | null
          estudiante_id: string
          bitacora_id: string
          nota?: number | null
          created_at?: string
        }
        Update: {
          nota?: number | null
        }
        Relationships: []
      }
      citaciones_tutoria: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha_citacion: string
          razon: string
          detalle_razon: string | null
          estado: string
          reserva_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          fecha_citacion?: string
          razon: string
          detalle_razon?: string | null
          estado?: string
          reserva_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          curso_id?: string
          estudiante_id?: string
          fecha_citacion?: string
          razon?: string
          detalle_razon?: string | null
          estado?: string
          reserva_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "citaciones_tutoria_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citaciones_tutoria_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citaciones_tutoria_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profesores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citaciones_tutoria_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          }
        ]
      }
      actividades_inbox: {
        Row: {
          id: string
          profesor_id: string
          titulo: string
          descripcion: string | null
          tipo: 'nota' | 'tarea' | 'recordatorio'
          prioridad: 'baja' | 'normal' | 'alta'
          archivada: boolean
          pinned: boolean
          completada: boolean
          color: 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'teal' | 'azul' | 'morado' | null
          checklist_items: { id: string; texto: string; done: boolean }[]
          curso_id: string | null
          etiquetas: string[]
          fecha_vencimiento: string | null
          fecha_cumplimiento: string | null
          conversion_destino: 'evento' | 'planificacion' | 'bitacora_actividad' | 'tutoria_manual' | 'horario_tutoria' | null
          conversion_ref_id: string | null
          conversion_fecha: string | null
          origen: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          titulo: string
          descripcion?: string | null
          tipo?: 'nota' | 'tarea' | 'recordatorio'
          prioridad?: 'baja' | 'normal' | 'alta'
          archivada?: boolean
          pinned?: boolean
          completada?: boolean
          color?: 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'teal' | 'azul' | 'morado' | null
          checklist_items?: { id: string; texto: string; done: boolean }[]
          curso_id?: string | null
          etiquetas?: string[]
          fecha_vencimiento?: string | null
          fecha_cumplimiento?: string | null
          conversion_destino?: 'evento' | 'planificacion' | 'bitacora_actividad' | 'tutoria_manual' | 'horario_tutoria' | null
          conversion_ref_id?: string | null
          conversion_fecha?: string | null
          origen?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          titulo?: string
          descripcion?: string | null
          tipo?: 'nota' | 'tarea' | 'recordatorio'
          prioridad?: 'baja' | 'normal' | 'alta'
          archivada?: boolean
          pinned?: boolean
          completada?: boolean
          color?: 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'teal' | 'azul' | 'morado' | null
          checklist_items?: { id: string; texto: string; done: boolean }[]
          curso_id?: string | null
          etiquetas?: string[]
          fecha_vencimiento?: string | null
          fecha_cumplimiento?: string | null
          conversion_destino?: 'evento' | 'planificacion' | 'bitacora_actividad' | 'tutoria_manual' | 'horario_tutoria' | null
          conversion_ref_id?: string | null
          conversion_fecha?: string | null
          origen?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actividades_inbox_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          }
        ]
      }
      calificaciones_items: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          parcial: number
          categoria: string | null
          nombre_item: string
          tipo: 'tarea' | 'subtotal_categoria' | 'otro'
          nota: number | null
          fuente: 'moodle' | 'manual'
          import_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          estudiante_id: string
          parcial: number
          categoria?: string | null
          nombre_item: string
          tipo: 'tarea' | 'subtotal_categoria' | 'otro'
          nota?: number | null
          fuente?: 'moodle' | 'manual'
          import_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          parcial?: number
          categoria?: string | null
          nombre_item?: string
          tipo?: 'tarea' | 'subtotal_categoria' | 'otro'
          nota?: number | null
          fuente?: 'moodle' | 'manual'
          import_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calificaciones_items_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calificaciones_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "calificaciones_imports"
            referencedColumns: ["id"]
          }
        ]
      }
      calificaciones_imports: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          archivo_nombre: string
          hash_archivo: string | null
          fecha_descarga_moodle: string | null
          parciales_afectados: number[]
          columnas_importadas: Json
          num_estudiantes_match: number
          num_estudiantes_sin_match: number
          num_celdas_creadas: number
          num_celdas_actualizadas: number
          num_celdas_sin_cambio: number
          num_celdas_preservadas: number
          snapshot_antes: Json | null
          revertido_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          archivo_nombre: string
          hash_archivo?: string | null
          fecha_descarga_moodle?: string | null
          parciales_afectados?: number[]
          columnas_importadas?: Json
          num_estudiantes_match?: number
          num_estudiantes_sin_match?: number
          num_celdas_creadas?: number
          num_celdas_actualizadas?: number
          num_celdas_sin_cambio?: number
          num_celdas_preservadas?: number
          snapshot_antes?: Json | null
          revertido_at?: string | null
          created_at?: string
        }
        Update: {
          num_estudiantes_match?: number
          num_estudiantes_sin_match?: number
          num_celdas_creadas?: number
          num_celdas_actualizadas?: number
          num_celdas_sin_cambio?: number
          num_celdas_preservadas?: number
          revertido_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calificaciones_imports_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          }
        ]
      }
      encuesta_parcial: {
        Row: {
          id: string
          estudiante_id: string
          curso_id: string
          auth_user_id: string
          tipo: string
          porcentaje_curso: number | null
          semana_iso: number | null
          trabaja_actual: string | null
          tipo_trabajo_actual: string | null
          horas_trabajo_actual: number | null
          tiene_laptop_actual: boolean | null
          tiene_pc_escritorio_actual: boolean | null
          comparte_pc_actual: boolean | null
          sin_computadora_actual: boolean | null
          dispositivo_movil_actual: string | null
          nivel_tecnologia_actual: number | null
          situacion_vivienda_actual: string | null
          es_foraneo_actual: boolean | null
          carrera_sigue_deseada: number | null
          gusto_escritura_actual: number | null
          uso_ia_comprension_actual: number | null
          uso_ia_resumen_actual: number | null
          uso_ia_ideas_actual: number | null
          uso_ia_redaccion_actual: number | null
          uso_ia_tareas_actual: number | null
          uso_ia_verificacion_actual: number | null
          uso_ia_critico_actual: number | null
          uso_ia_traduccion_actual: number | null
          uso_ia_idiomas_actual: number | null
          horas_dedicacion_estudio: string | null
          cambios_perfil: Json
          autopercepcion_aprendizaje: number | null
          esfuerzo_dedicado: number | null
          comprension_temas_propia: number | null
          preparacion_evaluacion: number | null
          cumplimiento_entregas: number | null
          dificultades: string[] | null
          detalle_dificultades: string | null
          utilidad_profesional: number | null
          aplicacion_practica: number | null
          actualidad_contenidos: number | null
          motivacion_post_curso: number | null
          claridad_explicaciones: number | null
          pertinencia_tareas: number | null
          claridad_instrucciones: number | null
          ritmo_clase: number | null
          calidad_recursos: number | null
          justicia_evaluacion: number | null
          retroalimentacion_recibida: number | null
          puntualidad_docente: number | null
          trato_docente: number | null
          dominio_tema: number | null
          estrategias_didacticas: number | null
          disponibilidad_docente: number | null
          satisfaccion_tutorias: number | null
          facilidad_reserva_tutoria: number | null
          fortalezas_curso: string | null
          sugerencias_mejora: string | null
          comentario_libre: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          estudiante_id: string
          curso_id: string
          auth_user_id: string
          tipo?: string
          porcentaje_curso?: number | null
          semana_iso?: number | null
          trabaja_actual?: string | null
          tipo_trabajo_actual?: string | null
          horas_trabajo_actual?: number | null
          tiene_laptop_actual?: boolean | null
          tiene_pc_escritorio_actual?: boolean | null
          comparte_pc_actual?: boolean | null
          sin_computadora_actual?: boolean | null
          dispositivo_movil_actual?: string | null
          nivel_tecnologia_actual?: number | null
          situacion_vivienda_actual?: string | null
          es_foraneo_actual?: boolean | null
          carrera_sigue_deseada?: number | null
          gusto_escritura_actual?: number | null
          uso_ia_comprension_actual?: number | null
          uso_ia_resumen_actual?: number | null
          uso_ia_ideas_actual?: number | null
          uso_ia_redaccion_actual?: number | null
          uso_ia_tareas_actual?: number | null
          uso_ia_verificacion_actual?: number | null
          uso_ia_critico_actual?: number | null
          uso_ia_traduccion_actual?: number | null
          uso_ia_idiomas_actual?: number | null
          horas_dedicacion_estudio?: string | null
          cambios_perfil?: Json
          autopercepcion_aprendizaje?: number | null
          esfuerzo_dedicado?: number | null
          comprension_temas_propia?: number | null
          preparacion_evaluacion?: number | null
          cumplimiento_entregas?: number | null
          dificultades?: string[] | null
          detalle_dificultades?: string | null
          utilidad_profesional?: number | null
          aplicacion_practica?: number | null
          actualidad_contenidos?: number | null
          motivacion_post_curso?: number | null
          claridad_explicaciones?: number | null
          pertinencia_tareas?: number | null
          claridad_instrucciones?: number | null
          ritmo_clase?: number | null
          calidad_recursos?: number | null
          justicia_evaluacion?: number | null
          retroalimentacion_recibida?: number | null
          puntualidad_docente?: number | null
          trato_docente?: number | null
          dominio_tema?: number | null
          estrategias_didacticas?: number | null
          disponibilidad_docente?: number | null
          satisfaccion_tutorias?: number | null
          facilidad_reserva_tutoria?: number | null
          fortalezas_curso?: string | null
          sugerencias_mejora?: string | null
          comentario_libre?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          tipo?: string
          porcentaje_curso?: number | null
          semana_iso?: number | null
          trabaja_actual?: string | null
          tipo_trabajo_actual?: string | null
          horas_trabajo_actual?: number | null
          tiene_laptop_actual?: boolean | null
          tiene_pc_escritorio_actual?: boolean | null
          comparte_pc_actual?: boolean | null
          sin_computadora_actual?: boolean | null
          dispositivo_movil_actual?: string | null
          nivel_tecnologia_actual?: number | null
          situacion_vivienda_actual?: string | null
          es_foraneo_actual?: boolean | null
          carrera_sigue_deseada?: number | null
          gusto_escritura_actual?: number | null
          uso_ia_comprension_actual?: number | null
          uso_ia_resumen_actual?: number | null
          uso_ia_ideas_actual?: number | null
          uso_ia_redaccion_actual?: number | null
          uso_ia_tareas_actual?: number | null
          uso_ia_verificacion_actual?: number | null
          uso_ia_critico_actual?: number | null
          uso_ia_traduccion_actual?: number | null
          uso_ia_idiomas_actual?: number | null
          horas_dedicacion_estudio?: string | null
          cambios_perfil?: Json
          autopercepcion_aprendizaje?: number | null
          esfuerzo_dedicado?: number | null
          comprension_temas_propia?: number | null
          preparacion_evaluacion?: number | null
          cumplimiento_entregas?: number | null
          dificultades?: string[] | null
          detalle_dificultades?: string | null
          utilidad_profesional?: number | null
          aplicacion_practica?: number | null
          actualidad_contenidos?: number | null
          motivacion_post_curso?: number | null
          claridad_explicaciones?: number | null
          pertinencia_tareas?: number | null
          claridad_instrucciones?: number | null
          ritmo_clase?: number | null
          calidad_recursos?: number | null
          justicia_evaluacion?: number | null
          retroalimentacion_recibida?: number | null
          puntualidad_docente?: number | null
          trato_docente?: number | null
          dominio_tema?: number | null
          estrategias_didacticas?: number | null
          disponibilidad_docente?: number | null
          satisfaccion_tutorias?: number | null
          facilidad_reserva_tutoria?: number | null
          fortalezas_curso?: string | null
          sugerencias_mejora?: string | null
          comentario_libre?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_parcial_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encuesta_parcial_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_occupied_slots: {
        Args: {
          p_horario_ids: number[]
        }
        Returns: {
          horario_id: number
          fecha: string
        }[]
      }
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
      get_encuestas_parciales_pendientes: {
        Args: {
          p_auth_user_id: string
        }
        Returns: {
          curso_id: string
          asignatura: string
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
