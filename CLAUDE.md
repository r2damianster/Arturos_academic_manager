# Claude Code — gestor-universitario-next

> Instrucciones específicas para Claude Code. Para Qwen/Cline ver `QWEN.md`. Para contexto general del proyecto ver `AI_AGENTS.md`.

## Token Optimization (Windows — OBLIGATORIO)
El tool `distill` no es compatible con Windows. Para comandos con output grande:

**Bash/WSL:**
```bash
<comando> | ollama run llama3.2 "Summarize this output. Focus only on errors or relevant changes. Be extremely concise."
```
**PowerShell:**
```powershell
<comando> | Out-String | ForEach-Object { ollama run llama3.2 "Summarize this output. Focus only on errors or relevant changes. Be extremely concise. $_" }
```
Aplicar en: `npm run build`, `git diff`, `npm test`, `tsc --noEmit`, `npm install`.

---

## Proyecto
App Next.js 15 (v16.2.1) para gestión docente universitaria — cursos, asistencia, calificaciones, tutorías, agenda y portal del estudiante.

- **Stack**: Next.js 15 App Router · Supabase (PostgreSQL + RLS + Auth) · TypeScript · Tailwind CSS · shadcn/ui · Zod
- **Deploy**: Vercel + Supabase Cloud
- **Tipos DB**: `src/types/database.types.ts` (generado con Supabase CLI) → aliases en `src/types/domain.ts`
- **Server Actions**: `src/lib/actions/*.ts` — patrón `'use server'` + Zod + `revalidatePath`
- **Cliente Supabase**: `await createClient()` de `@/lib/supabase/server` (server-side)

## Rutas (`src/app/`)
```
/dashboard/              → Panel principal del profesor
/dashboard/cursos        → CRUD cursos + subida de Excel
/dashboard/estudiantes   → Ficha individual de estudiante
/dashboard/pase-lista    → Toma de asistencia + participación
/dashboard/agenda        → Calendario semanal (clases + eventos + tutorías + planificación)
/dashboard/tutorias      → Horarios disponibles + reservas
/dashboard/config        → Perfil del profesor
/student/                → Portal del estudiante (onboarding, calendario, perfil)
/student/tutorias        → Reserva de tutorías (estudiante)
/tutoria-action/         → Confirmación pública por email token
/auth/login              → Login/registro
/auth/callback           → Handler OAuth/PKCE
```

## Agentes disponibles (`.claude/agents/`)
- **db-expert** — esquema completo incrustado; queries, migraciones, diseño de tablas
- **frontend** — componentes React, páginas RSC, formularios, Tailwind/shadcn
- **server-actions** — lógica de negocio, Server Actions, patrones Supabase
- **reviewer** — revisión de seguridad, tipos TS, consistencia de patrones
- **student-frontend** — especialista en `/student/*`
- **activity-summary** — changelogs, reportes de sesión

## Migraciones (`supabase/migrations/`)
```
001_initial_schema.sql          → Tablas base
002_rls_policies.sql            → Políticas RLS
003_functions.sql               → Funciones PG
004_email_action_tokens.sql     → Tokens de confirmación por email
20260331_add_disponible_hasta   → Campo expiración disponibilidad tutorías
20260404_add_encuesta_campos    → Campos encuesta en tutorías
20260404_add_progreso           → Campo progreso en planificación
20260405_add_horarios_clases    → Horarios de clase
20260405_add_horarios_tutoria   → Horarios de tutoría del profesor
20260405_fix_anuncios_rls       → Fix RLS en anuncios
20260411_get_occupied_slots     → RPC bypass RLS para slots portal estudiante
20260411_planificacion_clase    → Planificación de clases en agenda
20260413_replanificar_clases    → Replanificación de clases (merge + shift cascada)
20260414_add_auth_user_id_estudiantes → Columna auth_user_id en tabla estudiantes
```

## Tipos TypeScript (`src/types/database.types.ts`)
Archivo mantenido **manualmente** (no regenerar sin revisar — tiene tablas extras no en el schema inicial):
- `horarios`, `reservas`, `encuesta_estudiante` — agregadas manualmente (existen en DB, no en schema inicial)
- `estudiantes.auth_user_id`, `horarios_clases.centro_computo`, `cursos.nombres_tareas/num_parciales`, `asistencia.bitacora_id` — campos agregados via dashboard sin migración previa

## Convenciones críticas
- `getUser()` en servidor, **nunca** `getSession()`
- Inserts siempre incluyen `profesor_id: user.id` (nunca del formData)
- RLS activo — no filtrar manualmente por `profesor_id` en SELECTs del profesor
- Calificaciones: upsert por `(estudiante_id, curso_id)`, nunca insert duplicado
- `estado` en asistencia: mayúscula inicial (`'Presente'`, `'Ausente'`, `'Atraso'`)
- Portal estudiante usa RPC `get_occupied_slots` para bypassear RLS donde es necesario
- `centro_computo` es columna booleana en `horarios_clase`, no un enum de tipo de aula
