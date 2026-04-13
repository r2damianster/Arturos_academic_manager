# AI Agents — gestor-universitario-next

Guía general del proyecto para cualquier asistente IA (Claude, Qwen, Gemini, GPT, etc.).

- Para Claude Code: ver `CLAUDE.md`
- Para Qwen/Cline/Continue: ver `QWEN.md`
- Para historial de cambios: ver `CHANGELOG.md`

---

## ¿Qué es este proyecto?

**Gestor Universitario** es una aplicación web para docentes universitarios que centraliza:
- Gestión de cursos y estudiantes
- Toma de asistencia y participación
- Calificaciones y trabajos
- Tutorías (disponibilidad del profesor + reservas de estudiantes)
- Agenda semanal (clases + eventos + tutorías)
- Portal del estudiante (reservas, calendario, perfil)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Server Components) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + OAuth) |
| Seguridad DB | Row Level Security (RLS) |
| Tipos | TypeScript 5 + Zod |
| Estilos | Tailwind CSS 3 + shadcn/ui |
| Deploy | Vercel + Supabase Cloud |

---

## Estructura de rutas

### Portal del Profesor (`/dashboard/`)
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Panel principal |
| `/dashboard/cursos` | CRUD de cursos, subida de Excel |
| `/dashboard/estudiantes/[id]` | Ficha de estudiante (notas, asistencia) |
| `/dashboard/pase-lista` | Toma de asistencia por curso/fecha |
| `/dashboard/agenda` | Calendario semanal (clases + eventos + tutorías) |
| `/dashboard/tutorias` | Gestión de disponibilidad y reservas |
| `/dashboard/config` | Perfil del profesor |
| `/dashboard/admin` | Panel de administración |

### Portal del Estudiante (`/student/`)
| Ruta | Descripción |
|------|-------------|
| `/student` | Inicio del estudiante |
| `/student/onboarding` | Configuración inicial del perfil |
| `/student/tutorias` | Calendario de tutorías + reserva |
| `/student/perfil` | Perfil del estudiante |

### Rutas públicas
| Ruta | Descripción |
|------|-------------|
| `/auth/login` | Login y registro |
| `/auth/callback` | Handler OAuth/PKCE reset password |
| `/tutoria-action` | Confirmación de tutoría via token email |

---

## Tablas principales en Supabase

| Tabla | Descripción |
|-------|-------------|
| `cursos` | Cursos del profesor |
| `estudiantes` | Estudiantes vinculados a cursos |
| `asistencia` | Registros de asistencia por clase |
| `calificaciones` | Notas por estudiante y curso |
| `trabajos` | Trabajos/tareas por curso |
| `tutorias` | Sesiones de tutoría (disponibilidad + reservas) |
| `horarios_clase` | Horarios de clases regulares |
| `horarios_tutoria_profesor` | Disponibilidad del profesor para tutorías |
| `eventos` | Eventos en la agenda del profesor |
| `perfiles_estudiante` | Perfil vinculado a auth.users del estudiante |
| `bitacora` | Log de actividad del profesor |

**RLS**: Todas las tablas del profesor filtran por `profesor_id = auth.uid()`.

---

## Convenciones del código

```
1. getUser() en servidor, nunca getSession()
2. profesor_id siempre del servidor (user.id), nunca del formData
3. RLS activo — no filtrar por profesor_id en SELECTs
4. Calificaciones: upsert(estudiante_id, curso_id), no insert duplicado
5. estado en asistencia: 'Presente' | 'Ausente' | 'Atraso' (mayúscula inicial)
6. centro_computo en horarios_clase es boolean, no enum
7. Portal estudiante: usar RPC get_occupied_slots para bypassear RLS
```

---

## Migraciones SQL (`supabase/migrations/`)

Ejecutar en orden para inicializar la base de datos:

1. `001_initial_schema.sql` — Tablas base
2. `002_rls_policies.sql` — Políticas RLS
3. `003_functions.sql` — Funciones PG auxiliares
4. `004_email_action_tokens.sql` — Tokens de acción por email
5. `20260331_add_disponible_hasta.sql` — Expiración de disponibilidad
6. `20260404_add_encuesta_campos.sql` — Campos encuesta en tutorías
7. `20260404_add_progreso.sql` — Progreso en planificación
8. `20260405_add_horarios_clases.sql` — Horarios de clase
9. `20260405_add_horarios_tutoria.sql` — Horarios disponibles del profesor
10. `20260405_fix_anuncios_rls.sql` — Fix RLS en anuncios
11. `20260411_get_occupied_slots.sql` — RPC para portal estudiante
12. `20260411_planificacion_clase.sql` — Tabla planificación de clases

---

## Setup local

```bash
# 1. Clonar e instalar
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar con tus credenciales de Supabase

# 3. Ejecutar migraciones en Supabase SQL Editor (en orden)

# 4. Correr en desarrollo
npm run dev
```

Variables requeridas en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Seguridad

- **Middleware** (`src/middleware.ts`): Protege `/dashboard/*` y `/student/*` — redirige a login si no hay sesión.
- **RLS**: Cada tabla filtra automáticamente por `profesor_id = auth.uid()`.
- **Server Actions**: `profesor_id` siempre se obtiene del servidor, nunca del cliente.
- **PKCE**: Reset de password y OAuth usan flujo PKCE via `/auth/callback`.
