# Changelog — gestor-universitario-next

Formato: `[fecha] tipo: descripción`

---

## [2026-04-14] — Sesión 2 (tarde)

### Features
- **Copiar/Mover plan de clase** (`PlanificarModal`): toggle Copiar vs Mover (mover elimina el original). La fecha destino ya no es libre — es un `<select>` con las próximas fechas válidas del curso seleccionado, derivadas de sus `dia_semana` en `horarios_clases`. Auto-selecciona la primera fecha válida al cambiar curso.
- **`moverPlanificacion()`** en `bitacora.ts`: acción que ejecuta `copiarPlanificacion` + `DELETE` del original en una sola operación, con `revalidatePath`.
- **Confirmaciones "Asistiré" visibles en agenda del profesor** (`agenda-client.tsx`): el contador `voy` ahora filtra `anuncios_tutoria_curso` por `fecha === ds` (antes contaba todos sin filtro de fecha). El bloque de tutoría muestra borde más vivo y texto "X asisten" en naranja cuando hay confirmaciones. El picker emergente muestra la lista de nombres de los estudiantes confirmados ese día.

### Bug conocido (pendiente)
- **"Sin fechas disponibles"** en panel de copiar plan: el `cursoDiasMap` se construye con `c.dia_semana.toLowerCase()` mapeado contra `DIA_TO_DOW` que usa claves con tilde (`'miércoles'`, `'sábado'`). Si los valores almacenados en DB omiten tildes o tienen capitalización diferente, el lookup falla silenciosamente y `fechasDestino` queda vacío.
  - **Fix sugerido**: normalizar el string antes del lookup (strip tildes) o incluir variantes sin tilde en `DIA_TO_DOW`. Alternativa más robusta: hacer fetch cliente de `horarios_clases` al abrir el panel de copia, en lugar de depender de la prop `clases`.

---

## [2026-04-14] — Sesión 1 (mañana) — Estado actual

### Features implementadas
- Portal completo del estudiante (onboarding, calendario tutorías, perfil)
- Agenda semanal del profesor (clases, eventos, tutorías en una sola vista)
- Sistema de tutorías por curso y disponibilidad puntual del profesor
- Planificación de clases integrada en agenda
- Confirmación de tutorías por email con token público
- Gestión de cursos con subida de estudiantes por Excel
- Toma de asistencia y participación por clase
- Calificaciones con upsert (no duplicados)
- Trabajos/tareas por curso
- Perfil del profesor y del estudiante
- Widget horario semanal navegable
- Sidebar slide-over para confirmar tutoría
- Viewport dinámico en calendario de tutorías (Tmin-1h / Tmax+1h)
- Tipos TypeScript sincronizados con esquema real de Supabase

---

## Historial de commits recientes

### 2026-04-14
- `refactor`: `src/types/database.types.ts` — sincronización masiva: `auth_user_id` en `estudiantes`, `centro_computo` en `horarios_clases`, `num_parciales`/`nombres_tareas` en `cursos`, `bitacora_id` en `asistencia`; tablas nuevas `horarios`, `reservas`, `encuesta_estudiante`; RPC `get_occupied_slots`
- `refactor`: eliminados `as any` y `eslint-disable` en actions y pages (tipos ahora cubiertos)
- `feat`: `supabase/migrations/20260414_add_auth_user_id_estudiantes.sql` — migración que documenta `auth_user_id` en `estudiantes`

### 2026-04-13
- `fix`: mostrar etiqueta 'Centro Cómputo' usando campo booleano `centro_computo`
- `fix`: sincronizar `perfiles_estudiante` al editar perfil y corregir `estudianteId` en anuncios `tutoria_curso`
- `fix`: etiqueta 'Centro Cómputo' y botón 'Asistiré' en calendario estudiante
- `feat`: mostrar clases propias del estudiante en calendario de tutorías
- `fix`: usar RPC `get_occupied_slots` para bypassear RLS en portal estudiante
- `fix`: tutoria_curso de otros cursos aparece como 'No disp.' en calendario estudiante
- `fix`: corregir lógica de colores en calendario de tutorías del estudiante
- `refactor`: unificar Mis Cursos y Tomar Lista; mover Nuevo Curso al sidebar footer
- `fix`: mostrar slots agendados (pendiente+confirmada) como 'Agendado' en portal estudiante
- `fix`: subir z-index del contenedor de tutoría a z-50 cuando el popover está abierto

### 2026-04-12
- `feat`: agenda — editar eventos, cancelar reservas y ajuste de colores
- `fix`: subir z-index de clase blocks a z-30 para capturar click sobre tutoría (z-20)
- `feat`: módulo de planificación de clases integrado en agenda
- `refactor`: unificar tutorías en agenda y organizar agentes
- `fix`: renombrar parámetros `buildSlots` para evitar shadowing de `fromMin`
- `refactor`: agenda con calendario semanal como vista principal
- `feat`: viewport dinámico en calendario de tutorías (Tmin-1h / Tmax+1h)
- `refactor`: integrar Tutorías dentro de Agenda en sidebar del profesor

### 2026-04-11
- `fix`: mover query de eventos después de declaración de `user` (fix error TS build)
- `feat`: agenda personal del profesor y fix `observacion_part` en asistencia
- `fix`: añadir anotación de tipo explícita para `cookiesToSet` (fix error TS build)
- `feat`: aula, centro_computo, perfiles en calificaciones, obs independiente, fix doble dialog tutoría
- `fix`: cookies de sesión en callback se escriben directo en el redirect response
- `fix`: flujo reset password via callback PKCE + soporte param `next`
- `feat`: sidebar slide-over para confirmar tutoría en lugar de panel inferior
- `fix`: RLS anuncios usa `auth_user_id` en lugar de `auth.users`
- `fix`: separar query de `anuncios_tutoria_curso` para evitar fallo por RLS
- `fix`: selector tipo visible con null y leyenda tutoría de curso en manager
- `feat`: widget horario semanal navegable y fix selector tipo en móvil
- `feat`: implementar tutorías por curso y disponibilidad puntual

---

## Migraciones SQL aplicadas

| Archivo | Descripción | Fecha |
|---------|-------------|-------|
| `001_initial_schema.sql` | Esquema base | inicio |
| `002_rls_policies.sql` | Políticas RLS | inicio |
| `003_functions.sql` | Funciones PG | inicio |
| `004_email_action_tokens.sql` | Tokens email | pre-2026-03 |
| `20260331_add_disponible_hasta` | Campo expiración disponibilidad | 2026-03-31 |
| `20260404_add_encuesta_campos` | Encuesta en tutorías | 2026-04-04 |
| `20260404_add_progreso` | Progreso planificación | 2026-04-04 |
| `20260405_add_horarios_clases` | Horarios de clase | 2026-04-05 |
| `20260405_add_horarios_tutoria` | Horarios disponibles del profesor | 2026-04-05 |
| `20260405_fix_anuncios_rls` | Fix RLS anuncios | 2026-04-05 |
| `20260411_get_occupied_slots` | RPC bypass RLS portal estudiante | 2026-04-11 |
| `20260411_planificacion_clase` | Tabla planificación clases | 2026-04-11 |
| `20260413_replanificar_clases` | Replanificación (merge + shift cascada) | 2026-04-13 |
| `20260414_add_auth_user_id_estudiantes` | Columna `auth_user_id` en `estudiantes` | 2026-04-14 |
