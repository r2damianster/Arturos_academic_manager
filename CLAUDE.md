# Claude Code — gestor-universitario-next

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
App Next.js 15 para gestión docente universitaria (cursos, asistencia, calificaciones, tutorías, agenda).
- Stack: Next.js 15 App Router · Supabase (PostgreSQL+RLS+Auth) · TypeScript · Tailwind · shadcn/ui · Zod
- Tipos DB: `src/types/database.types.ts` (generado) → aliases en `src/types/domain.ts`
- Server Actions: `src/lib/actions/*.ts` — patrón `'use server'` + Zod + `revalidatePath`
- Cliente Supabase: `await createClient()` de `@/lib/supabase/server` (server-side)

## Rutas principales (`src/app/`)
```
/dashboard/cursos        → CRUD cursos
/dashboard/estudiantes   → gestión estudiantes
/dashboard/pase-lista    → asistencia + participación
/dashboard/agenda        → calendario semanal (clases + eventos + tutorías)
/dashboard/tutorias      → horarios disponibles + reservas
/student/                → portal del estudiante
/tutoria-action/         → confirmación pública por email token
```

## Agentes disponibles (`.claude/agents/`)
- **db-expert** — esquema completo incrustado; para queries, migraciones, diseño de tablas
- **frontend** — componentes React, páginas RSC, formularios, Tailwind/shadcn
- **server-actions** — lógica de negocio, Server Actions, patrones Supabase
- **reviewer** — revisión de seguridad, tipos TS, consistencia de patrones

## Convenciones críticas
- `getUser()` en servidor, nunca `getSession()`
- Inserts siempre incluyen `profesor_id: user.id` (nunca del formData)
- RLS activo — no filtrar manualmente por profesor_id en SELECTs
- Calificaciones: upsert por `(estudiante_id, curso_id)`, nunca insert duplicado
- `estado` en asistencia: mayúscula inicial ('Presente', 'Ausente', 'Atraso')
