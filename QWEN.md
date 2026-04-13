# Qwen / Cline — gestor-universitario-next

> Instrucciones para usar este proyecto con Qwen (via Cline, Continue, o cualquier extensión LLM). Para Claude Code ver `CLAUDE.md`. Para contexto general ver `AI_AGENTS.md`.

## Contexto del proyecto
App Next.js 15 para gestión docente universitaria. Ver `AI_AGENTS.md` para descripción completa, rutas, stack y convenciones.

## Token budget — Windows
Si estás corriendo en Windows y el output es grande, resumir con:
```bash
<comando> | ollama run qwen2.5-coder "Summarize. Focus on errors or relevant changes only. Be concise."
```
O con llama3.2 si no tienes qwen2.5-coder instalado.

## Reglas para generar código en este proyecto

### Autenticación
- Usar siempre `await createClient()` de `@/lib/supabase/server` en Server Components y Server Actions.
- Para obtener el usuario: `const { data: { user } } = await supabase.auth.getUser()` — **nunca** `getSession()`.
- El `profesor_id` en inserts siempre es `user.id`, nunca viene del cliente/formData.

### Server Actions (`src/lib/actions/*.ts`)
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function miAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validar con Zod
  const schema = z.object({ campo: z.string().min(1) })
  const parsed = schema.safeParse({ campo: formData.get('campo') })
  if (!parsed.success) return { error: parsed.error.flatten() }

  const { error } = await supabase.from('tabla').insert({
    campo: parsed.data.campo,
    profesor_id: user.id,  // siempre del servidor
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/ruta')
  return { success: true }
}
```

### Base de datos
- RLS activo en todas las tablas — las políticas filtran por `profesor_id = auth.uid()`.
- No agregar `.eq('profesor_id', user.id)` en SELECTs — RLS ya lo hace.
- Calificaciones: siempre `upsert` con `onConflict: 'estudiante_id,curso_id'`.
- Campo `estado` en asistencia: `'Presente'` | `'Ausente'` | `'Atraso'` (con mayúscula inicial).
- `centro_computo` en `horarios_clase` es un `boolean`, no un tipo de aula.
- `bitacora_clase.estado`: `'planificado'` (antes de clase) | `'cumplido'` (tras tomar lista).
- Solo se pueden mover planificaciones con `estado='planificado'`, nunca `'cumplido'`.
- Replanificación: `replanificarClase()` en `src/lib/actions/bitacora.ts`
  - Modo `'merge'`: fusiona actividades_json de origen+destino, borra origen
  - Modo `'shift'`: desplaza bitácoras en cascada hasta encontrar hueco vacío o llegar a fecha_fin del curso

### Tipos
- Tipos generados en `src/types/database.types.ts` (no editar manualmente).
- Aliases y tipos de dominio en `src/types/domain.ts`.

### Portal del estudiante (`src/app/student/`)
- El portal usa RPC `get_occupied_slots` para slots de tutorías (bypassa RLS correctamente).
- Separar siempre la lógica del profesor de la del estudiante — son contextos distintos.

## Estructura de archivos relevantes
```
src/
├── app/
│   ├── dashboard/         → Módulos del profesor
│   ├── student/           → Portal del estudiante
│   ├── tutoria-action/    → Confirmación email (público)
│   └── auth/              → Login, callback OAuth
├── lib/
│   ├── supabase/          → createClient (browser + server)
│   └── actions/           → Server Actions por módulo
│       ├── cursos.ts
│       ├── asistencia.ts
│       ├── calificaciones.ts
│       ├── estudiantes.ts
│       ├── tutorias.ts
│       ├── eventos.ts
│       ├── trabajos.ts
│       └── bitacora.ts
├── components/            → Componentes UI por módulo
│   └── agenda/
│       ├── PlanificarModal.tsx
│       ├── PasarListaModal.tsx
│       └── ReplanificarModal.tsx
└── types/
    ├── database.types.ts  → Tipos Supabase (generado)
    └── domain.ts          → Aliases y tipos de dominio
supabase/
└── migrations/            → Historial SQL ordenado cronológicamente
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    ├── 003_functions.sql
    ├── 004_email_action_tokens.sql
    ├── 20260331_add_disponible_hasta.sql
    ├── 20260404_add_encuesta_campos.sql
    ├── 20260404_add_progreso.sql
    ├── 20260405_add_horarios_clases.sql
    ├── 20260405_add_horarios_tutoria.sql
    ├── 20260405_fix_anuncios_rls.sql
    ├── 20260411_get_occupied_slots.sql
    ├── 20260411_planificacion_clase.sql
    └── 20260413_replanificar_clases.sql
```

## Changelog
Ver `CHANGELOG.md` para historial detallado de features y fixes.
