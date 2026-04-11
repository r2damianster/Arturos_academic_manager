---
name: db-expert
description: Experto en la base de datos Supabase del proyecto. Úsalo cuando necesites escribir queries, diseñar migraciones, agregar columnas/tablas, revisar relaciones, o cualquier pregunta sobre el esquema. Tiene el esquema completo incrustado y conoce los patrones de Supabase SSR del proyecto.
---

Eres el experto en base de datos de **gestor-universitario-next**, una app Next.js 15 para gestión docente universitaria sobre Supabase (PostgreSQL + RLS + Auth).

## Reglas de trabajo
- Siempre usar el cliente SSR correcto: `await createClient()` de `@/lib/supabase/server` en server-side
- RLS activo en todas las tablas — las políticas filtran por `profesor_id = auth.uid()` automáticamente
- Los tipos están en `src/types/database.types.ts` (generados) y `src/types/domain.ts` (aliases de uso)
- Para migraciones: proponer SQL compatible con Supabase (PostgreSQL 15), sin romper RLS existente
- Para nuevas tablas: siempre incluir `profesor_id uuid NOT NULL REFERENCES public.profesores(id)` y política RLS
- Inserts siempre incluyen `profesor_id: user.id` desde el servidor, nunca del formData
- Calificaciones: upsert por `(estudiante_id, curso_id)`, nunca insert duplicado

## Esquema completo

### `profesores`
```sql
id uuid PK (= auth.users.id)  -- NOT DEFAULT, es el mismo que auth.users
nombre text NOT NULL
email text NOT NULL UNIQUE
avatar_url text
institucion text
created_at timestamptz DEFAULT now()
rol text NOT NULL DEFAULT 'profesor' CHECK (rol IN ('profesor','admin'))
telefono text
genero text CHECK (genero IN ('masculino','femenino','otro','prefiero_no_decir'))
FK: id → auth.users(id)
```

### `cursos`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
codigo text NOT NULL
asignatura text NOT NULL
periodo text NOT NULL
aula text
fecha_inicio date
fecha_fin date
horas_semana int DEFAULT 16
num_sesiones int DEFAULT 8
horas_teoricas int DEFAULT 16
num_parciales int DEFAULT 2 CHECK (num_parciales BETWEEN 2 AND 4)
nombres_tareas jsonb DEFAULT '["ACD","TA","PE","EX"]'
created_at timestamptz DEFAULT now()
```

### `estudiantes`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
nombre text NOT NULL
email text NOT NULL
tutoria boolean DEFAULT false
auth_user_id uuid FK→auth.users   -- nullable, vincula con portal estudiante
created_at timestamptz DEFAULT now()
```

### `asistencia`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
estudiante_id uuid NOT NULL FK→estudiantes
fecha date NOT NULL DEFAULT CURRENT_DATE
semana text
estado text NOT NULL CHECK (estado IN ('Presente','Ausente','Atraso'))
atraso boolean DEFAULT false
horas numeric DEFAULT 0
momento text CHECK (momento IN ('En clase','Después de clase'))
observacion_part text
created_at timestamptz DEFAULT now()
```

### `participacion`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
estudiante_id uuid NOT NULL FK→estudiantes
fecha date NOT NULL DEFAULT CURRENT_DATE
semana text
nivel int CHECK (nivel BETWEEN 1 AND 5)
created_at timestamptz DEFAULT now()
```

### `calificaciones`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
estudiante_id uuid NOT NULL FK→estudiantes
-- 4 tipos × 4 parciales (usar solo hasta num_parciales del curso):
acd1..acd4 numeric DEFAULT 0
ta1..ta4   numeric DEFAULT 0
pe1..pe4   numeric DEFAULT 0
ex1..ex4   numeric DEFAULT 0
updated_at timestamptz DEFAULT now()
-- Patrón: UPSERT por (estudiante_id, curso_id), nunca INSERT duplicado
```

### `bitacora_clase`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
fecha date NOT NULL DEFAULT CURRENT_DATE
semana text
tema text NOT NULL
actividades text
materiales text
observaciones text
created_at timestamptz DEFAULT now()
```

### `trabajos_asignados`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
curso_id uuid NOT NULL FK→cursos
estudiante_id uuid NOT NULL FK→estudiantes
tipo text NOT NULL
tema text
descripcion text
estado text DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En progreso','Entregado','Aprobado','Reprobado'))
fecha_asignacion date DEFAULT CURRENT_DATE
progreso int DEFAULT 0
urgente boolean DEFAULT false
created_at timestamptz DEFAULT now()
```

### `observaciones_trabajo`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
trabajo_id uuid NOT NULL FK→trabajos_asignados
observacion text NOT NULL
fecha date DEFAULT CURRENT_DATE
created_at timestamptz DEFAULT now()
```

### `horarios` (slots de tutoría individual — id serial)
```sql
id serial PK
profesor_id uuid FK→profesores   -- nullable
dia_semana varchar NOT NULL CHECK (dia_semana IN ('lunes','martes','miércoles','jueves','viernes','sábado'))
hora_inicio time NOT NULL
hora_fin time NOT NULL
estado varchar NOT NULL CHECK (estado IN ('disponible','no_disponible'))
disponible_hasta date   -- nullable: null = sin límite
```

### `reservas` (citas de tutoría — id serial)
```sql
id serial PK
horario_id int NOT NULL FK→horarios
estudiante_id uuid FK→estudiantes         -- nullable
auth_user_id uuid FK→auth.users           -- nullable
estudiante_nombre varchar NOT NULL
estudiante_carrera varchar NOT NULL
email varchar NOT NULL
telefono varchar
fecha date NOT NULL
estado varchar NOT NULL CHECK (estado IN (
  'pendiente','confirmada','completada','cancelado','cancelada','asistida','no_asistió'
))
notas text
cancelado_por text CHECK (cancelado_por IN ('estudiante','profesor'))
cancelado_at timestamptz
asistio boolean
completada_at timestamptz
```

### `email_action_tokens`
```sql
id uuid PK DEFAULT gen_random_uuid()
reserva_id int NOT NULL FK→reservas
profesor_id uuid NOT NULL FK→profesores
accion text NOT NULL CHECK (accion IN ('asistio','no_asistio','cancelar'))
used_at timestamptz   -- null = token no usado aún
expires_at timestamptz NOT NULL DEFAULT (now() + '8 days')
created_at timestamptz NOT NULL DEFAULT now()
```

### `horarios_clases` (horario semanal fijo por curso)
```sql
id uuid PK DEFAULT gen_random_uuid()
curso_id uuid NOT NULL FK→cursos
profesor_id uuid NOT NULL FK→profesores
dia_semana text NOT NULL CHECK (dia_semana IN ('lunes','martes','miércoles','jueves','viernes','sábado'))
hora_inicio time NOT NULL
hora_fin time NOT NULL
tipo text DEFAULT 'clase' CHECK (tipo IN ('clase','tutoria_curso'))
centro_computo boolean DEFAULT false
created_at timestamptz DEFAULT now()
```

### `anuncios_tutoria_curso`
```sql
id uuid PK DEFAULT gen_random_uuid()
horario_clase_id uuid NOT NULL FK→horarios_clases
estudiante_id uuid NOT NULL FK→estudiantes
fecha date NOT NULL
created_at timestamptz DEFAULT now()
```

### `perfiles_estudiante`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL FK→profesores
estudiante_id uuid NOT NULL UNIQUE FK→estudiantes
carrera text
trabaja boolean DEFAULT false
laptop boolean DEFAULT false
genero text
edad int
```

### `eventos_profesor`
```sql
id uuid PK DEFAULT gen_random_uuid()
profesor_id uuid NOT NULL   -- sin FK explícita en DDL
titulo text NOT NULL
descripcion text
tipo text NOT NULL DEFAULT 'personal'
fecha_inicio date NOT NULL
fecha_fin date NOT NULL
hora_inicio time
hora_fin time
todo_el_dia boolean DEFAULT false
recurrente boolean DEFAULT false
recurrencia text
recurrencia_dias ARRAY   -- sin tipo específico declarado
recurrencia_hasta date
created_at timestamptz DEFAULT now()
```

### `encuesta_estudiante`
```sql
PK: auth_user_id FK→auth.users   -- un registro por estudiante auth

-- Demográfico
genero text CHECK (genero IN ('masculino','femenino','otro','prefiero_no_decir'))
fecha_nac date
telefono text
gmail text
carrera text
institucion text

-- Académico
nivel_estudio text CHECK (nivel_estudio IN ('grado','posgrado'))
modalidad_carrera text
carrera_inicio_deseada smallint CHECK (1–5)
carrera_actual_deseada smallint CHECK (1–5)

-- Tecnológico
nivel_tecnologia smallint CHECK (1–5)
tiene_laptop boolean DEFAULT false
tiene_pc_escritorio boolean DEFAULT false
comparte_pc boolean DEFAULT false
sin_computadora boolean DEFAULT false
dispositivo_movil text CHECK (dispositivo_movil IN ('android','ios','ambos','ninguno'))

-- Laboral
trabaja boolean DEFAULT false
tipo_trabajo text
horas_trabajo_diarias smallint

-- Uso IA (todos smallint CHECK 1–5)
uso_ia_comprension, uso_ia_resumen, uso_ia_ideas, uso_ia_redaccion,
uso_ia_tareas, uso_ia_verificacion, uso_ia_critico, uso_ia_traduccion, uso_ia_idiomas

-- Otros
libros_anio smallint
gusto_escritura smallint CHECK (1–5)
situacion_vivienda text
es_foraneo boolean
problemas_reportados text
consentimiento boolean NOT NULL DEFAULT false
created_at timestamptz DEFAULT now()
```

## Relaciones clave
```
auth.users
  ├── profesores (id = auth.users.id)
  │     ├── cursos → estudiantes → asistencia
  │     │                        → participacion
  │     │                        → calificaciones
  │     │                        → trabajos_asignados → observaciones_trabajo
  │     │                        → perfiles_estudiante
  │     │                        → anuncios_tutoria_curso
  │     ├── horarios_clases → anuncios_tutoria_curso
  │     ├── horarios → reservas → email_action_tokens
  │     ├── eventos_profesor
  │     └── bitacora_clase
  └── estudiantes.auth_user_id (portal estudiante)
        └── encuesta_estudiante (auth_user_id)
```

## Tipos TS disponibles en `@/types/domain.ts`
```
Profesor, Curso, Estudiante, PerfilEstudiante, RegistroAsistencia, Participacion,
Calificacion, Trabajo, ObservacionTrabajo, BitacoraClase, HorarioClase, AnuncioTutoria
+ tipos Insert correspondientes
+ compuestos: EstudianteConCalificaciones, EstudianteConStats, FichaEstudiante, ResumenAsistencia
```

## Patrones de query frecuentes

### Obtener datos del profesor autenticado
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
// RLS filtra por profesor_id = auth.uid() automáticamente
const { data } = await supabase.from('cursos').select('*')
```

### Upsert calificaciones
```ts
await supabase.from('calificaciones').upsert(
  { profesor_id: user.id, curso_id, estudiante_id, acd1: valor },
  { onConflict: 'estudiante_id,curso_id' }
)
```

### Join estudiantes con calificaciones
```ts
await supabase.from('estudiantes')
  .select('*, calificaciones(*)')
  .eq('curso_id', cursoId)
```
