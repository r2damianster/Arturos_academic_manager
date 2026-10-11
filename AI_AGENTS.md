# AI Agents — gestor-universitario-next

Guía general del proyecto para cualquier asistente IA (Claude, Qwen, Gemini, GPT, etc.).

- Para Claude Code: ver `CLAUDE.md`
- **Antigravity / Qwen / Gemini / cualquier otro agente: leer OBLIGATORIAMENTE `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`** (errores reales cometidos en este repo)
- Para historial de cambios: ver `CHANGELOG.md`

> ⚠ Reglas críticas: (1) jamás llaves/datos de estudiantes en el repo; (2) RLS explícita, nunca bucles masivos; (3) filtrar `cursos.estado='activo'` también en consultas con join; (4) commits descriptivos, nunca `auto-commit`; (5) actualizar `CLAUDE.md` + `CHANGELOG.md` en cada cambio.

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
| `trabajos_asignados` | Trabajos/tareas por estudiante |
| `horarios` / `reservas` | Disponibilidad de tutoría / citas de estudiantes |
| `horarios_clases` | Horario semanal de clases |
| `eventos_profesor` | Eventos personales de la agenda |
| `perfiles_estudiante` | Perfil vinculado a auth.users del estudiante |
| `bitacora_clase` | Planificación de clases (tema, actividades_json, estado) |

**RLS**: Todas las tablas del profesor filtran por `profesor_id = auth.uid()`.

---

## Convenciones del código

```
1. getUser() en servidor, nunca getSession()
2. profesor_id siempre del servidor (user.id), nunca del formData
3. RLS activo — no filtrar por profesor_id en SELECTs
4. Calificaciones: upsert(estudiante_id, curso_id), no insert duplicado
5. estado en asistencia: 'Presente' | 'Ausente' | 'Atraso' (mayúscula inicial)
6. centro_computo en horarios_clases es boolean, no enum
7. Portal estudiante: usar RPC get_occupied_slots para bypassear RLS
8. bitacora_clase.estado: 'borrador' | 'en_revision' | 'planificado' | 'cumplido' | 'suspendido'
9. Calificaciones solo se pueden mover si estado='planificado', nunca si='cumplido'
10. Replanificación: modo 'merge' fusiona actividades; modo 'shift' desplaza en cascada
```

---

## Skills disponibles (`.claude/skills/` y `.agents/skills/`)

- **`subir-planificacion`**: Procesa, estructura e inserta automáticamente una planificación académica completa (sílabo, lista de temas, ejercicios, talleres, recursos y calendarios) en Supabase (`bitacora_clase` y `logros_aprendizaje`).
- **`registrar-clase`**: Planifica una sesión individual, la marca como cumplida y registra la asistencia a partir de descripción en lenguaje natural.
- **`evaluar-participacion`** y **`registrar-tutoria`** (`.agents/skills/`): participación/control de lectura y tutorías manuales con fuzzy matching.

---

## Migraciones SQL

Orden y descripción en `supabase/migrations/` y en `CLAUDE.md` § Migraciones.

## Desarrollo local

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

Variables de servidor (Vercel): `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GROQ_MODEL` (opcional), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Detalle en `CLAUDE.md`.

---

## Seguridad

- **Middleware** (`middleware.ts`, raíz): Protege `/dashboard/*` y `/student/*` — redirige a login si no hay sesión.
- **RLS**: Cada tabla filtra automáticamente por `profesor_id = auth.uid()`.
- **Server Actions**: `profesor_id` siempre se obtiene del servidor, nunca del cliente.
- **PKCE**: Reset de password y OAuth usan flujo PKCE via `/auth/callback`.
