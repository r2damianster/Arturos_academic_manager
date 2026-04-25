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

## Workflow de deploy (SIEMPRE seguir este orden)

```bash
git fetch && git pull          # 1. Sincronizar con GitHub antes de empezar
# ... implementar cambios ...
npx tsc --noEmit               # 2. Verificar tipos ANTES de commitear
git add <archivos específicos> # 3. Nunca git add -A (riesgo de incluir .env)
git commit -m "Tipo: mensaje"
git push origin main           # 4. Vercel despliega automáticamente desde main
```

**Forzar redeploy sin cambios de código** (cuando se agregan env vars en Vercel):
```bash
git commit --allow-empty -m "ci: redeploy to pick up env var changes"
git push origin main
```

---

## Proyecto
App Next.js 15 para gestión docente universitaria — cursos, asistencia, calificaciones, tutorías, agenda y portal del estudiante.

- **Stack**: Next.js 15 App Router · Supabase (PostgreSQL + RLS + Auth) · TypeScript · Tailwind CSS · shadcn/ui · Zod
- **Deploy**: Vercel + Supabase Cloud
- **Tipos DB**: `src/types/database.types.ts` (mantenido manualmente) → aliases en `src/types/domain.ts`
- **Server Actions**: `src/lib/actions/*.ts` — patrón `'use server'` + Zod + `revalidatePath`
- **Cliente Supabase**: `await createClient()` de `@/lib/supabase/server` (server-side)
- **Admin Client**: `createAdminClient()` de `@/lib/supabase/server` — usa `SUPABASE_SERVICE_ROLE_KEY`, bypasea RLS. Usar SOLO si RLS genuinamente no puede modelar el acceso. Requiere que la variable esté en Vercel.

## Rutas (`src/app/`)
```
/dashboard/                        → Panel principal del profesor
/dashboard/cursos                  → CRUD cursos + subida de Excel
/dashboard/cursos/[cursoId]        → Detalle curso: métricas, módulos, tabla estudiantes
/dashboard/cursos/[cursoId]/encuesta → Perfil del grupo: datos socioeconómicos, uso IA
/dashboard/cursos/[cursoId]/asistencia → Reporte de asistencia (tabla cruzada)
/dashboard/cursos/[cursoId]/calificaciones → Notas por parcial
/dashboard/cursos/[cursoId]/trabajos → Asignación y seguimiento de trabajos
/dashboard/cursos/[cursoId]/pase-lista → Bitácora + asistencia (con date picker para editar pasadas)
/dashboard/estudiantes             → Ficha individual de estudiante
/dashboard/agenda                  → Calendario semanal (clases + eventos + tutorías + planificación)
/dashboard/tutorias                → Horarios disponibles + reservas
/dashboard/modo-clase/[bitacoraId] → Vista de clase en tiempo real (herramientas: ruleta, agrupación)
/dashboard/herramientas            → Ruleta y agrupación de estudiantes
/dashboard/planificacion           → Vista de planificación
/dashboard/config                  → Perfil del profesor
/student/                          → Portal del estudiante (onboarding, calendario, perfil)
/student/tutorias                  → Reserva de tutorías (estudiante)
/tutoria-action/                   → Confirmación pública por email token
/auth/login                        → Login/registro
/auth/callback                     → Handler OAuth/PKCE
```

## Agentes disponibles (`.claude/agents/`)
- **db-expert** — esquema completo incrustado; queries, migraciones, diseño de tablas
- **frontend** — componentes React, páginas RSC, formularios, Tailwind/shadcn
- **server-actions** — lógica de negocio, Server Actions, patrones Supabase
- **reviewer** — revisión de seguridad, tipos TS, consistencia de patrones
- **student-frontend** — especialista en `/student/*`
- **activity-summary** — changelogs, reportes de sesión
- **deploy** — workflow completo de git sync + tsc check + commit + push

## Supabase — acceso y migraciones

### Aplicar migraciones (en orden de preferencia)
1. **MCP Supabase activo en sesión** (`execute_sql` / `apply_migration`) — más directo
2. **CLI**: `npx supabase db push` — requiere `SUPABASE_ACCESS_TOKEN` en el entorno (token personal de `app.supabase.com/account/tokens`, distinto al service role key)
3. **SQL Editor del dashboard** (`vylkasmcveazzaspwgcr.supabase.co → SQL Editor`) — siempre disponible como fallback

Siempre crear el archivo en `supabase/migrations/YYYYMMDD_nombre.sql` aunque se aplique manualmente.

### Workflow correcto cuando aparece "0 resultados" por RLS
1. Identificar la tabla afectada
2. Verificar si tiene política para el rol que consulta (profesor/estudiante)
3. Crear migración: `ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS` + `CREATE POLICY`
4. Aplicar en SQL Editor
5. Cambiar de `createAdminClient()` a `createClient()` si se usó como workaround

### Variables de entorno requeridas en Vercel
| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente browser y server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente autenticado normal |
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` — bypasea RLS |

## Migraciones (`supabase/migrations/`)
```
001_initial_schema.sql               → Tablas base
002_rls_policies.sql                 → Políticas RLS (no incluye encuesta_estudiante)
003_functions.sql                    → Funciones PG
004_email_action_tokens.sql          → Tokens de confirmación por email
20260331_add_disponible_hasta        → Campo expiración disponibilidad tutorías
20260404_add_encuesta_campos         → Campos encuesta en tutorías
20260404_add_progreso                → Campo progreso en planificación
20260405_add_horarios_clases         → Horarios de clase
20260405_add_horarios_tutoria        → Horarios de tutoría del profesor
20260405_fix_anuncios_rls            → Fix RLS en anuncios
20260411_get_occupied_slots          → RPC bypass RLS para slots portal estudiante
20260411_planificacion_clase         → Planificación de clases en agenda
20260413_replanificar_clases         → Replanificación de clases (merge + shift cascada)
20260414_add_auth_user_id_estudiantes → Columna auth_user_id en tabla estudiantes
20260417_add_estado_estudiantes      → Estado activo/retirado en estudiantes
20260422_add_hora_inicio_real_bitacora → Hora real de inicio de clase en bitácora
20260425_encuesta_rls_profesor       → RLS para encuesta_estudiante (aplicada via SQL Editor)
```

## Tipos TypeScript (`src/types/database.types.ts`)
Archivo mantenido **manualmente** (no regenerar sin revisar — tiene tablas extras no en el schema inicial):
- `horarios`, `reservas`, `encuesta_estudiante` — agregadas manualmente
- `estudiantes.auth_user_id`, `horarios_clases.centro_computo`, `cursos.nombres_tareas/num_parciales`, `asistencia.bitacora_id` — campos agregados via dashboard sin migración previa
- **Deuda técnica**: `encuesta_estudiante` en los tipos no refleja todos los campos `uso_ia_*` con tipado estricto — hay `as any` en la página de encuesta

## Features recientes (2026-04-25 — sesión 5)

### Dashboard unificado (Panel)
- **Sidebar hover** (`sidebar.tsx`, `layout.tsx`): sidebar desktop colapsa a `w-16` (solo iconos) en reposo y expande a `w-[260px]` al hover. CSS puro con clase `group` + `group-hover`. Layout ajustado a `md:ml-16`.
- **Fusión dashboard + agenda**: `/dashboard/page.tsx` ahora incluye `AgendaClient` completo con todos sus controles (tutorías, eventos, planificación, pase de lista). `/dashboard/agenda/page.tsx` redirige a `/dashboard`.
- **Sidebar limpiado**: eliminados "Agenda" y "Tutorías" del nav. "Inicio" renombrado a "Panel". Orden actual: Panel → Planificación → Modo Clase → Mis Cursos → Herramientas. Cambio replicado en `sidebar.tsx` y `mobile-nav.tsx`.

### Nuevos componentes (`src/components/dashboard/`)
- **`SummaryPanel.tsx`**: panel colapsable con 3 stats + lista de cursos + botón Tomar Lista. Estado en `localStorage('summary-panel-open')`.
- **`TodayPanel.tsx`**: panel "Hoy" con flechas `< >` para navegar por días. Filtra clases normales, tutorías con reservas y eventos del día seleccionado. Clases `tutoria_curso` solo aparecen si hay confirmaciones ("Asistiré"). Toggle "Ver todos" muestra ítems sin actividad en opacidad reducida. Estado colapsable en `localStorage('today-panel-open')`.
- **`AgendaSection.tsx`**: wrapper colapsable sobre `AgendaClient`. Estado en `localStorage('agenda-section-open')`.

## Features recientes (2026-04-25 — sesión 4)

### Reorganización de cursos
- **Detalle de curso** (`[cursoId]/page.tsx`): agrega métricas por estudiante (% asistencia con barra de color, trabajos activos, encuesta respondida). 3 stat cards globales (asistencia promedio, trabajos activos, con encuesta).
- **EstudiantesMetricsTable** (`src/components/cursos/estudiantes-metrics-table.tsx`): tabla responsive con barras de progreso semáforo y retirados colapsables.
- **Página de Encuesta** (`[cursoId]/encuesta/page.tsx`): RSC puro con distribuciones de carrera, modalidad, vivienda, género, trabajo, nivel tecnología y 9 dimensiones de uso de IA. Tabla individual con flag de `problemas_reportados`.
- **Sidebar reordenado**: Inicio → Agenda → Tutorías → Planificación → Modo Clase → Mis Cursos → Herramientas.

### Fix crítico navegación móvil
- `mobile-nav.tsx` sincronizado con `sidebar.tsx`: agregados Tutorías, Modo Clase y Herramientas que faltaban en móvil.

### RLS encuesta_estudiante
- Tabla creada desde dashboard sin políticas. Aplicada `profesor_lee_encuestas_sus_estudiantes` y `estudiante_own_encuesta` via SQL Editor.

## Features recientes (2026-04-14 — sesiones 1-3)

### Agenda del profesor
- `copiarPlanificacion` / `moverPlanificacion` — copia o mueve plan entre cursos/fechas
- `PlanificarModal` — badge Centro Cómputo, fechas filtradas por `dia_semana`, toggle Copiar/Mover
- `PasarListaModal` — tab "Todos a la vez" y tab "Uno por uno" con barra de progreso
- Edición de asistencias pasadas: el date picker en Bitácora y Lista permite seleccionar fechas pasadas y carga registros existentes para editar
- PDF export diario/semanal (`/dashboard/agenda/imprimir`)

### Modo Clase y Herramientas (pull 2026-04-25)
- `modo-clase/[bitacoraId]` — vista de clase en tiempo real
- `herramientas/` — Ruleta de estudiantes y Agrupación aleatoria

### Portal del estudiante
- `ChatBot` flotante (`src/components/student/ChatBot.tsx`) — ayuda contextual, FAQ, chips de sugerencias. Estructura lista para conectar Claude API.

## Bugs pendientes
- **"Sin fechas disponibles"** en `PlanificarModal` al copiar plan: `DIA_TO_DOW` usa claves con tilde (`'miércoles'`, `'sábado'`) pero la BD puede tener valores sin tilde. Fix: normalizar con `.normalize('NFD').replace(/[̀-ͯ]/g,'')` en el lookup.
- **Desconexión bitácora**: `guardarBitacoraData()` (pase-lista) y `guardarPlanificacion()` (agenda) escriben a `bitacora_clase` en formatos incompatibles (`actividades` texto vs `actividades_json`). Pendiente unificar.

## Convenciones críticas

### Navegación — CRÍTICO
**`sidebar.tsx` y `mobile-nav.tsx` tienen arrays `navItems` completamente independientes.**
Al agregar, eliminar o reordenar un ítem en uno → replicarlo en el otro. Sin esto, los ítems sólo aparecen en desktop o sólo en móvil.

Orden actual (sesión 5): **Panel → Planificación → Modo Clase → Mis Cursos → Herramientas** (Agenda y Tutorías eliminados — la agenda vive dentro del Panel).

**Sidebar desktop hover**: `w-16` en reposo → `w-[260px]` al hover. Labels con `opacity-0 group-hover:opacity-100`. El layout usa `md:ml-16`, no `md:ml-[260px]`.

### Supabase
- `getUser()` en servidor, **nunca** `getSession()`
- Inserts siempre incluyen `profesor_id: user.id` (nunca del formData)
- RLS activo — no filtrar manualmente por `profesor_id` en SELECTs del profesor
- Antes de usar `createAdminClient()`, verificar si el problema es una política RLS faltante
- `encuesta_estudiante` tiene RLS desde 2026-04-25 con política para profesor y estudiante

### Calificaciones y asistencia
- Calificaciones: upsert por `(estudiante_id, curso_id)`, nunca insert duplicado
- `estado` en asistencia: mayúscula inicial (`'Presente'`, `'Ausente'`, `'Atraso'`)
- Editar asistencias pasadas: ir a Bitácora y Lista → cambiar la fecha en el date picker

### Datos
- `centro_computo` es columna booleana en `horarios_clase`, no un enum de tipo de aula
- Portal estudiante usa RPC `get_occupied_slots` para bypassear RLS donde es necesario
