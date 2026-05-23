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

- **Stack**: Next.js 15 App Router · Supabase (PostgreSQL + RLS + Auth) · TypeScript · Tailwind CSS · shadcn/ui · Zod · @dnd-kit/core
- **Deploy**: Vercel + Supabase Cloud
- **Tipos DB**: `src/types/database.types.ts` (mantenido manualmente) → aliases en `src/types/domain.ts`
- **Server Actions**: `src/lib/actions/*.ts` — patrón `'use server'` + Zod + `revalidatePath`
- **Cliente Supabase**: `await createClient()` de `@/lib/supabase/server` (server-side)
- **Admin Client**: `createAdminClient()` de `@/lib/supabase/server` — usa `SUPABASE_SERVICE_ROLE_KEY`, bypasea RLS. Usar SOLO si RLS genuinamente no puede modelar el acceso. Requiere que la variable esté en Vercel.

## Rutas (`src/app/`)
```
/dashboard/                        → Panel principal del profesor
/dashboard/cursos                  → Lista de cursos + botón "+ Nuevo Curso" en header
/dashboard/cursos/nuevo            → Formulario crear curso (accesible desde /cursos, no desde sidebar)
/dashboard/cursos/[cursoId]        → Detalle curso: métricas, módulos, tabla estudiantes
/dashboard/cursos/[cursoId]/editar → Edición completa del curso — 6 tabs: Info | Calendario | Horarios | Evaluación | Logros | Zona peligrosa
/dashboard/cursos/[cursoId]/encuesta → Perfil del grupo: datos socioeconómicos, uso IA
/dashboard/cursos/[cursoId]/asistencia → Reporte de asistencia (tabla cruzada paginada)
/dashboard/cursos/[cursoId]/calificaciones → Evaluaciones: notas, participación y resumen
/dashboard/cursos/[cursoId]/calificaciones/config → Configuración: num_parciales y nombres_tareas
/dashboard/cursos/[cursoId]/trabajos → Asignación y seguimiento de trabajos
/dashboard/cursos/[cursoId]/pase-lista → Bitácora + asistencia (con date picker para editar pasadas)
/dashboard/estudiantes             → Ficha individual de estudiante
/dashboard/actividades             → Inbox de notas/tareas/recordatorios estilo Google Keep
/dashboard/agenda                  → redirige a /dashboard (agenda integrada en el Panel)
/dashboard/tutorias                → Horarios disponibles + reservas + tabs Historial/Citaciones
/dashboard/modo-clase              → redirige a /dashboard/planificacion
/dashboard/modo-clase/[bitacoraId] → Vista de clase en tiempo real (herramientas: ruleta, agrupación, ficha estudiante, tabs móvil)
/dashboard/herramientas            → Ruleta y agrupación de estudiantes
/dashboard/planificacion           → Mis Clases: panel "Hoy" + grid semanal + Generador IA + "▶ Iniciar clase" en celdas
/dashboard/config                  → Página "Administración": perfil del profesor + tabs admin (si rol=admin)
/dashboard/config?tab=admin        → Tab "Panel Admin": gestión de usuarios y permisos
/dashboard/admin                   → redirige a /dashboard/config?tab=admin
/student/                          → Portal del estudiante (onboarding, calendario, perfil, grupos)
/student/tutorias                  → Reserva de tutorías con modalidad (presencial/virtual/otro)
/student/evidencias                → Ensamblador de evidencias PDF
/tutoria-action/                   → Confirmación pública por email token
/auth/login                        → Login/registro
/auth/callback                     → Handler OAuth/PKCE
/api/generar-docx                  → Convierte guía de texto a .docx descargable (librería docx)
/api/generar-pdf                   → Convierte guía de texto a PDF descargable (pdf-lib)
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
| `GROQ_API_KEY` | Groq — requerido para `GeneradorPanel`, `PerfilPedagogicoPanel`, `AutodiagnosticoWidget`, `generarPrepTutoria`, `corregirPlan`, `/api/student/chat`. Sin ella todos caen a fallback amigable. |
| `GROQ_MODEL` | Modelo Groq (opcional, default `llama-3.3-70b-versatile`) |
| `RESEND_API_KEY` | Envío de emails de citación a tutoría (`citaciones.ts`) |
| `RESEND_FROM_EMAIL` | Dirección remitente para emails de citación |

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
20260426_grupos_clase                → Tablas grupo_categorias, grupos_clase, grupo_integrantes, grupo_participacion + RLS completo
20260426_grupos_student_rls         → Política adicional para que estudiantes vean conteos de grupos abiertos
20260501_add_observacion_cursos     → Columna observacion TEXT en cursos
20260501_add_institucion_cursos     → Columna institucion TEXT en cursos
20260501_add_horas_tutoria_ofrecidas → Columna horas_ofrecidas en horarios
20260501_add_tutor_horas_semana     → Tabla tutor_horas_semana (acumulado por curso/semana)
20260503_fix_calcular_semana        → Corrección RPC calcular_semana
20260503_fix_semanas_historico      → Recalcula semana en participacion/asistencia (semanas ISO)
20260503_add_citaciones_tutoria     → Tabla citaciones_tutoria con RLS (estados: pendiente|agendada|asistida|no_asistida|cumplida)
20260509_plantillas_grupos          → Columnas es_plantilla/plantilla_nombre en grupos_clase
20260509_limit_reservas_por_semana  → RPC reservar_tutoria: max 1 reserva activa por semana por estudiante
20260509_cancelar_con_ventana_horaria → Funciones SECURITY DEFINER: cancelar_mi_reserva (ventana 1h) y marcar_no_asistire
20260514_fix_participacion_unique_constraint → UNIQUE INDEX en participacion(curso_id, estudiante_id, fecha) — fix crítico
20260514_historial_tutorias         → Columnas profesor_id, origen, curso_id, hora_inicio/fin_manual en reservas; horario_id nullable
20260519_actividades_inbox          → Tabla actividades_inbox con RLS y trigger updated_at
20260519_actividades_keep_style     → Rediseño schema: archivada, pinned, completada, color, checklist_items JSONB
20260520_add_modalidad_reservas     → Columnas modalidad (presencial|virtual|otro) y link_zoom en reservas; RPC actualizada
20260521_add_logros_aprendizaje     → Tabla logros_aprendizaje(id, curso_id, descripcion, orden) con RLS
20260522_add_obligatoria_horarios_clases → Columna obligatoria BOOLEAN DEFAULT FALSE en horarios_clases
```

## Tipos TypeScript (`src/types/database.types.ts`)
Archivo mantenido **manualmente** (no regenerar sin revisar — tiene tablas extras no en el schema inicial):
- `horarios`, `reservas`, `encuesta_estudiante` — agregadas manualmente
- `estudiantes.auth_user_id`, `horarios_clases.centro_computo`, `cursos.nombres_tareas/num_parciales`, `asistencia.bitacora_id` — campos agregados via dashboard sin migración previa
- **Deuda técnica acumulada** (tablas/columnas no reflejadas en los tipos, usan `as any`):
  - `actividades_inbox` — tabla nueva completa (color, checklist_items JSONB, pinned, completada, archivada)
  - `citaciones_tutoria` — tabla nueva completa
  - `logros_aprendizaje` — tabla nueva completa
  - `reservas.modalidad`, `reservas.link_zoom`, `reservas.profesor_id`, `reservas.origen`, `reservas.curso_id` — columnas nuevas
  - `horarios_clases.obligatoria` — columna nueva
  - `encuesta_estudiante` — campos `uso_ia_*` sin tipado estricto

## Features recientes (2026-05-23 — sesión 21)

### Integración IA extendida — Groq en toda la app (solo Groq, sin Ollama en producción)

#### Corrección ortográfica con IA en PlanificarModal
- **FEAT** `corregirPlan({ texto })` en `src/lib/actions/generar-contenido.ts` — Groq con prompt estricto de solo corrección ortográfica y conectores lógicos. NUNCA reescribe ni cambia contenido.
- **MOD** `src/components/agenda/PlanificarModal.tsx`:
  - Botón `✦ Corregir` junto al label "Tema" → corrige campo `tema`
  - Botón `✦ Corregir` junto al label "Observaciones" → corrige campo `observaciones`
  - Botón `✦ Corregir` en header de sección Actividades → `handleCorregirActividades()` corre `Promise.all` sobre todos los campos `actividad` no vacíos en paralelo. **Nunca toca el campo `recurso`** (URLs no necesitan corrección).
  - Estado `correcting: 'tema' | 'obs' | 'acts' | null` — deshabilita todos los botones mientras corre.

#### Contexto histórico en generación de guías
- **MOD** `generarHtmlSemanal` y `generarGuiaSemanal` — nuevo param opcional `cursoId?: string`. Cuando presente, llama `fetchHistorialClases(supabase, cursoId, excludeIds)` que consulta las últimas 2 bitácoras `estado='cumplido'` del curso (excluyendo semanas seleccionadas). Inyecta como "CONTEXTO DE CLASES ANTERIORES" en el prompt con instrucción de NO repetir temas ya cubiertos.
- **MOD** `src/components/planificacion/GeneradorPanel.tsx` — ambas llamadas incluyen `cursoId: selectedCursoId ?? undefined`.

#### Detección de riesgo + citación masiva en detalle de curso
- **FEAT** `src/components/cursos/RiesgoPanel.tsx` — panel colapsable ámbar. Muestra estudiantes con asistencia < 75%. Botón "Citar a N estudiantes a tutoría" → secuencial `citarEstudiante()` por cada uno con razones generadas por template (no Groq). Progreso inline `citados/total`. Estados: idle → loading → done (verde) / error.
- **MOD** `src/app/dashboard/cursos/[cursoId]/page.tsx` — computa `enRiesgo[]` y renderiza `<RiesgoPanel>` antes de `EstudiantesMetricsTable`.

#### Perfil pedagógico del grupo con IA
- **FEAT** `generarPerfilPedagogico({ contexto, asignatura })` en `generar-contenido.ts` — exactamente 3 párrafos (Perfil / Oportunidades / Recomendaciones), máx 250 palabras, basado SOLO en datos provistos.
- **FEAT** `src/components/cursos/PerfilPedagogicoPanel.tsx` — botón "✦ Generar perfil" / "Regenerar". Muestra 3 párrafos en card morado. Botón copiar.
- **MOD** `src/app/dashboard/cursos/[cursoId]/encuesta/page.tsx` — computa `perfilContexto` string desde métricas ya calculadas en RSC (sin queries extras). Inserta `<PerfilPedagogicoPanel>` antes de la tabla individual de estudiantes.

#### Autodiagnóstico estudiantil pre-parcial
- **FEAT** `generarAutodiagnostico({ asignatura, pctAsistencia, trabajosActivos, trabajosCompletados, tutoriasAsistidas, tutoriasFaltadas })` en `generar-contenido.ts` — 2-3 frases motivacionales en tono de tutor empático, basadas en datos reales del estudiante.
- **FEAT** `src/components/student/AutodiagnosticoWidget.tsx` — botón "✦ Ver cómo voy en este curso". Resultado en card índigo con botón cerrar.
- **MOD** `src/app/student/page.tsx` — `AutodiagnosticoWidget` al pie de cada tarjeta de curso.

#### Prep para tutoría tras reserva exitosa
- **FEAT** `generarPrepTutoria({ nombreProfesor, carreraEstudiante })` en `generar-contenido.ts` — 3 sugerencias numeradas de preparación para el estudiante antes de la sesión.
- **MOD** `src/app/student/tutorias/tutorias-booking.tsx` — tras `handleConfirm()` exitoso, dispara `generarPrepTutoria()` de forma no bloqueante. Resultado en panel índigo bajo el mensaje de éxito con botón "Cerrar".

#### ChatBot estudiantil con datos reales (Groq)
- **FEAT** `src/app/api/student/chat/route.ts` — POST endpoint. Autentica usuario, fetch asistencia/trabajos/reservas de todos sus cursos, construye `contexto` string, llama Groq (max_tokens 400, temperatura 0.6). Si GROQ_API_KEY falta → respuesta amigable de fallback.
- **MOD** `src/components/student/ChatBot.tsx`:
  - FAQ local primero (instantáneo, sin costo de API) — si matchea, responde directo.
  - Si no matchea FAQ → POST a `/api/student/chat` con historial de mensajes.
  - Typing dots animados (`animate-bounce` staggered) mientras espera respuesta.
  - Input deshabilitado durante carga. Fallback graceful si red falla.

---

## Features recientes (2026-05-22 — sesiones 15-20)

### Inbox de Notas / Actividades (`/dashboard/actividades`)
- **FEAT** Tabla `actividades_inbox` con tipos `nota | tarea | recordatorio`, colores (rojo|naranja|amarillo|verde|teal|azul|morado), `pinned`, `completada`, `archivada`, `checklist_items JSONB`, `fecha_vencimiento`, `curso_id`. RLS completo.
- **FEAT** `src/lib/actions/actividades.ts` — CRUD completo + checklist (addItem/toggle/remove/save) + convertirAEvento + convertirVariasAEvento + getActividades + getCounts + getActividadesParaHoy + getUltimasNotas.
- **FEAT** `src/app/dashboard/actividades/page.tsx` + `actividades-client.tsx` — vista con filtros por tipo/curso/color/búsqueda, toggle archivadas, botones QuickAdd y EditarPanel.
- **FEAT** Componentes: `ActividadCard`, `QuickAddModal`, `EditarActividadPanel`, `ChecklistEditor`, `ColorPicker`, `ConvertirEventoModal`, `MiniNotaCard`.
- **FEAT** `src/components/actividades/FloatingNotesPanel.tsx` — panel flotante persistente en todo el dashboard (oculto en `/modo-clase` y `/actividades`). Crear nota rápida, ver últimas 8, selección múltiple para convertir a evento. Estado en `localStorage`.
- **MOD** `src/app/dashboard/layout.tsx` — `FloatingNotesPanel` inyectado globalmente.

### Sistema de Citaciones a Tutoría
- **FEAT** Tabla `citaciones_tutoria(id, profesor_id, curso_id, estudiante_id, fecha_citacion, razon, detalle_razon, estado, reserva_id)`. Estados: `pendiente | agendada | asistida | no_asistida | cumplida`.
- **FEAT** `src/lib/actions/citaciones.ts` — `citarEstudiante`, `actualizarEstadoCitacion`, `getCitacionesPorCurso`, `obtenerCitacionesPendientesEstudiante`, `enviarEmailCitacion` (Resend, sin que el profesor abra su correo), `agendarCitacion`.
- **FEAT** `src/components/tutorias/CitacionesTab.tsx` — tabla de citaciones activas con transiciones de estado inline.

### Historial de Tutorías
- **FEAT** `reservas` nuevas columnas: `profesor_id`, `origen TEXT DEFAULT 'agendada'`, `curso_id`, `hora_inicio_manual`, `hora_fin_manual`. `horario_id` ahora nullable (permite entradas manuales).
- **FEAT** `src/lib/actions/tutorias.ts` — `registrarTutoriaManual`, `getHistorialTutorias` (join con citaciones_tutoria).
- **FEAT** `src/components/tutorias/HistorialTab.tsx` — filtros por curso/institución/fecha/origen/estado, exportación CSV.
- **MOD** `src/app/dashboard/tutorias/tutorias-page-client.tsx` — 3 tabs: **Horarios** | **Historial** | **Citaciones**.

### Generador IA con Groq (`/dashboard/planificacion`)
- **FEAT** `src/lib/actions/generar-contenido.ts` — Groq API (`llama-3.3-70b-versatile`): `generarHtmlSemanal` (HTML estilo Moodle LMS con restricciones estrictas: no inventar referencias, video YouTube como CTA, iframe solo para Google Slides), `generarGuiaSemanal` (texto plano con competencias blandas, rúbrica 4 niveles, logros institucionales opcionales), `mejorarContenido` (chat de refinamiento con historial).
- **FEAT** `src/components/planificacion/GeneradorPanel.tsx` — panel 3 pasos: selección curso+semana → configuración tipo+instrucción → resultado con preview + descarga .txt/.docx/.pdf + modo chat.
- **FEAT** `src/app/api/generar-docx/route.ts` — text→`.docx` via librería `docx`. Parsea encabezados MAYÚSCULAS, bullets, campos clave:valor.
- **FEAT** `src/app/api/generar-pdf/route.ts` — text→PDF via `pdf-lib`. Tipografía A4 con word-wrap.
- **MOD** `planificacion-client.tsx` — botón "Generador IA" en header abre `GeneradorPanel` como overlay.
- **REQUERIDO EN VERCEL**: `GROQ_API_KEY` (obligatorio), `GROQ_MODEL` (opcional).

### Logros de Aprendizaje por Curso
- **FEAT** Tabla `logros_aprendizaje(id, curso_id, descripcion, orden)` con RLS.
- **FEAT** `src/lib/actions/logros.ts` — `getLogros`, `addLogro`, `updateLogro`, `deleteLogro`, `reorderLogros`.
- Usados en `GeneradorPanel` como objetivos institucionales del curso.

### Edición completa de curso (`/dashboard/cursos/[cursoId]/editar`)
- **FEAT** `src/app/dashboard/cursos/[cursoId]/editar/page.tsx` — RSC con 6 tabs vía `editar-client.tsx`: **Información | Calendario | Horarios | Evaluación | Logros | Zona peligrosa**.
- Tab Logros: lista drag-reorderable con CRUD inline. Tab Peligro: eliminar curso.

### Ficha de Estudiante — Drawer Universal
- **FEAT** `src/components/ficha-estudiante/FichaEstudianteDrawer.tsx` — drawer lateral con tabs `resumen | trabajos | participación | encuesta`. Incluye "Citar a tutoría" con selector de razón. Toggle datos sensibles con `useSensibleToggle`.
- **FEAT** `src/lib/actions/ficha-estudiante.ts` — `getFichaEstudiante(estudianteId, cursoId, bitacoraId?)` retorna `FichaEstudianteData`: asistencia, participación, trabajos, citaciones, grupoActual.
- **FEAT** `src/lib/hooks/use-sensible-toggle.ts` — persiste en `localStorage`, sincronizado entre pestañas via `StorageEvent`.
- **MOD** `pase-lista-client.tsx`, `AsistenciaPorEstudiante.tsx`, `modo-clase-client.tsx` — botón por estudiante abre el drawer.

### PlanDropModal — Drag entre días/cursos mejorado
- **FEAT** `src/components/agenda/PlanDropModal.tsx` — modal de confirmación para drag con opciones: Mover / Copiar / Mover en Cascada (destino libre) o Reemplazar / Combinar / Cascada (destino con plan).
- **MOD** `src/lib/actions/bitacora.ts` — tipos exportados `AccionDrag` y `ColisionDrag`. `gestionarDragPlanificacion` refactorizado. Nueva action `trasladarActividades(sourceBitacoraId, indices[], targetBitacoraId, mode)`.
- **MOD** `planificacion-client.tsx` y `PlanificacionExtensiva.tsx` — ambos usan `PlanDropModal`.

### Modalidad en Reservas de Tutoría
- **FEAT** `reservas.modalidad TEXT DEFAULT 'presencial'` (check: `presencial | virtual | otro`) + `reservas.link_zoom TEXT`. RPC `reservar_tutoria` actualizada con `p_modalidad` y `p_link_zoom`.
- **MOD** `src/app/student/tutorias/tutorias-booking.tsx` — selector modalidad + campo link_zoom condicional.

### Límites y ventana de cancelación en reservas
- **FEAT** `reservar_tutoria` RPC: máx 1 reserva activa por semana (lunes-domingo ISO). Error claro si ya tiene una.
- **FEAT** `cancelar_mi_reserva(p_reserva_id)` SECURITY DEFINER: solo permite cancelar con >1h de anticipación. `marcar_no_asistire`: registra inasistencia si ya pasó el corte.

### Campo obligatoria en horarios de clase
- **FEAT** `horarios_clases.obligatoria BOOLEAN NOT NULL DEFAULT FALSE`. Visible en `HorarioClase` interface y en `TodayPanel`.

### Plantillas de Grupos
- **FEAT** `grupos_clase.es_plantilla BOOLEAN DEFAULT false` + `grupos_clase.plantilla_nombre TEXT`. Prop `plantillas` y `gruposUltimaSesion` en `modo-clase-client.tsx`.

### Fix crítico — participación única
- **FIX** `UNIQUE INDEX participacion_curso_estudiante_fecha_key` — sin este índice el upsert en `registrarParticipacion` fallaba silenciosamente. Registros previos al 2026-05-14 pueden estar incompletos.

### Sidebar — orden actualizado (sesión 15+)
- Orden actual: **Panel → Clases → Tutorías → Mis Cursos → Herramientas** · Footer: **Administración**
- **Tutorias** re-agregado al sidebar (había sido removido en sesión 7). Verificar siempre que `sidebar.tsx` y `mobile-nav.tsx` estén sincronizados.

---

## Features recientes (2026-05-01 — sesión 14)

### Edición de curso completa
- **FEAT** `src/components/cursos/editar-curso-panel.tsx`: `HorariosEditor` embebido dentro del panel (ya no está separado en la página). Campo `observacion` (textarea libre, max 500 chars). Campo `institucion` editable por curso. Botón "Editar datos del curso" con borde visible.
- **FEAT** `src/lib/actions/cursos.ts`: `DetallesCursoSchema` y `actualizarDetallesCurso` actualizados para incluir `observacion` e `institucion`.
- **MOD** `src/app/dashboard/cursos/[cursoId]/page.tsx`: `HorariosEditor` removido de la página (ahora vive dentro del panel).
- **MIGRACIÓN** `supabase/migrations/20260501_add_observacion_cursos.sql` — aplicada en producción.
- **MIGRACIÓN** `supabase/migrations/20260501_add_institucion_cursos.sql` — aplicada en producción.
- **MOD** `src/types/database.types.ts`: `observacion: string | null` e `institucion: string | null` en Row/Insert/Update de `cursos`.

### Drag A↔B en modo extensivo
- **FEAT** `src/components/agenda/PlanificacionExtensiva.tsx`: cards con plan muestran ícono `⠿` (solo visible con Curso B activo). Al soltar sobre el otro curso aparece banner de confirmación amber ("¿Copiar este plan? Copiar / Cancelar"). Usa `copiarPlanificacion` existente (tema + actividades + observaciones). Dependencia: `@dnd-kit/core` (ya instalada).

### Navegación día/semana en vista semanal
- **FEAT** `src/app/dashboard/planificacion/planificacion-client.tsx`: botones `‹‹` (semana atrás), `‹` (día atrás), `›` (día adelante), `››` (semana adelante). Display central: rango de semana + día seleccionado en azul. Clic en header del grid cambia el día seleccionado. Columna del día activo resaltada en azul tenue. Al cruzar límite de semana con `‹`/`›`, avanza/retrocede la semana automáticamente. Botón "Hoy" resetea semana y día seleccionado.

### Eliminar plan (ambas vistas)
- **FEAT** `src/app/dashboard/planificacion/planificacion-client.tsx`: botón `🗑` por celda → confirmación inline "¿Eliminar? Sí/No"; advertencia extra para cumplidos.
- **FEAT** `src/components/agenda/PlanificacionExtensiva.tsx`: mismo patrón por card.
- **MOD** `src/lib/actions/bitacora.ts` — `eliminarPlanificacion`: removida restricción `.neq('estado', 'cumplido')`; ahora permite borrar planes cumplidos.

### Ensamblador de evidencias PDF (`/student/evidencias`)
- **FEAT** `src/app/student/evidencias/page.tsx` (nuevo): RSC que obtiene nombre estudiante, asignatura y profesor.
- **FEAT** `src/components/student/EnsamblarEvidencias.tsx` (nuevo): dos zonas Grupales (Exposiciones en clase, Hojas grupales) e Individuales (Brisk, Perusall, Ensayos). Drag-and-drop de archivos, reordenar con ↑↓, eliminar, añadir categorías personalizadas. Acepta: PDF, JPEG, PNG, WebP, HEIC, TIFF.
- **FEAT** `src/app/api/student/ensamblar-evidencias/route.ts` (nuevo): `pdf-lib` genera portada oscura con metadatos + páginas divisoras por categoría + footer en cada página. `sharp` convierte imágenes no-JPEG/PNG a JPEG antes de embeber. Responde con PDF descargable (no se almacena en servidor).
- **MOD** `src/app/student/page.tsx`: card "Armar Evidencias PDF" (col-span-2) como acceso rápido.
- **Dependencias añadidas**: `pdf-lib`, `sharp`.

### Horas de tutoría por curso/semana
- **FEAT** Nueva tabla `tutor_horas_semana(profesor_id, curso_id, fecha_semana, horas, UNIQUE(profesor_id,curso_id,fecha_semana))` con RLS para profesor y estudiante
- **FEAT** `limpiarHorariosVencidos` (ejecutada en cada carga del dashboard): registra la semana actual en `tutor_horas_semana` para cada slot disponible × cada curso activo con fecha dentro del rango. Solo cuenta semanas ya transcurridas. Luego expira slots con `disponible_hasta` vencido.
- **FEAT** Portal estudiante: muestra "X h de tutoría ofrecidas en N semanas del curso" en la tarjeta de cada curso (query a `tutor_horas_semana`)
- **MIGRACIÓN** `20260501_add_horas_tutoria_ofrecidas.sql` y `20260501_add_tutor_horas_semana.sql` aplicadas en producción
- **Lógica clave**: las horas solo se acumulan cuando `semana_actual >= curso.fecha_inicio`. Si el profesor activa un slot antes de que empiece el curso, esas semanas previas no cuentan para ese curso.

### Fixes sesión 14 (continuación)
- **FIX** `agenda-client.tsx`: clases fuera de `fecha_inicio`/`fecha_fin` del curso → `return null` (completamente ocultas en el calendario)
- **FIX** `editar-curso-panel.tsx`, `nuevo/page.tsx`, `cursos.ts`: parciales ahora incluyen opción **1 parcial** (antes mínimo era 2). Schema Zod actualizado a `min(1)`.
- **FIX** Participación masiva en modo clase: botón "★ Abrir participación de todos" abre los paneles individuales de TODOS los estudiantes simultáneamente (no asigna el mismo nivel a todos — cada estudiante sigue teniendo sus propios controles)
- **FIX** Asistencia en modo clase: arranca en **Presente** (verde) por defecto para todos

---

## Features recientes (2026-04-26 — sesión 10)

### Sistema de Grupos en Clases

#### DB — supabase/migrations/
- **FEAT** `20260426_grupos_clase.sql`: tablas `grupo_categorias` (presets: Países, Colores, Planetas, Animales, Personalizado), `grupos_clase`, `grupo_integrantes` (trigger unicidad por sesión), `grupo_participacion` (auxiliar, sin uso activo desde frontend). RLS completo para profesor y estudiante.
- **FEAT** `20260426_grupos_student_rls.sql`: política `todos_ven_integrantes_grupos_abiertos` — estudiantes ven conteos de grupos abiertos de tipo afinidad.

#### Server Actions — src/lib/actions/
- **FEAT** `grupos.ts` (nuevo): `crearGrupos`, `crearGruposConIntegrantes` (crea grupos + asigna integrantes en un paso), `asignarEstudianteAGrupo`, `moverEstudiante`, `publicarAfinidad`, `cerrarAfinidad`, `unirseAGrupo`, `salirDeGrupo`, `getGruposAbiertosParaEstudiante`, `getGruposDeSesion`, `getCategorias`.
- **FEAT** `asistencia.ts`: campo `observacion_participacion` añadido a `RegistroAsistenciaInput`; nueva action `registrarParticipacion(cursoId, fecha, datos[])` — upsert en tabla `participacion` con `nivel` (1-5) y `observacion`.

#### UI — Herramientas
- **FEAT** `src/components/herramientas/ExclusionPanel.tsx` (nuevo): panel de exclusión reutilizable (checkboxes, "Incluir todos"/"Excluir todos"). Retirados auto-excluidos por defecto.
- **REWRITE** `src/components/herramientas/Agrupacion.tsx`: 3 tabs [Aleatoria | Manual | Por afinidad]. Selector enlazado N grupos <-> Max/grupo recalculados mutuamente. Categorías cargadas desde `grupo_categorias` en BD. DnD con `@dnd-kit/core`. Tab Aleatoria: "Generar" + "Guardar grupos" via `crearGruposConIntegrantes`. Tab Manual: DnD drag-to-assign + guardar con integrantes. Tab Por afinidad: crea grupos vacíos en BD + polling 10s.
- **MOD** `src/app/dashboard/herramientas/page.tsx`: carga `grupo_categorias` y `estado` de estudiantes como RSC.
- **MOD** `src/app/dashboard/herramientas/herramientas-client.tsx`: pasa `cursoId` y `categorias` a `Agrupacion`.

#### UI — Portal Estudiante
- **FEAT** `src/components/student/MisGrupos.tsx` (nuevo): sección "Grupos de clase". Muestra grupos abiertos de tipo afinidad, conteo de miembros, botones "Unirme"/"Salir". Polling 15s para actualizar cupos.
- **MOD** `src/app/student/page.tsx`: integra `MisGrupos` cuando hay grupos abiertos del curso del estudiante.

#### UI — Modo Clase
- **MOD** `src/app/dashboard/modo-clase/[bitacoraId]/page.tsx`: carga `getGruposDeSesion` y `getCategorias`; pasa `grupos` y `categorias` al cliente.
- **MOD** `src/app/dashboard/modo-clase/[bitacoraId]/modo-clase-client.tsx`:
  - Tab "Grupos" en columna derecha (desktop) y como 3er tab en barra móvil.
  - `RuletaGrupos`: slot-machine que sortea entre grupos. Auto-excluir ganador marcado por defecto (desmarcable). Chips clickables para excluir/incluir grupos.
  - `VistaGrupo`: vista de foco por grupo. P/A/F por estudiante + nivel de participacion 1-5 + observación libre. Guarda en tabla `participacion` via `registrarParticipacion`. Botón activo solo si hay estudiantes marcados.
  - Botón "Crear grupos" en columna de actividades abre `Agrupacion` inline. Tras guardar llama `refreshGrupos()` al cambiar al tab Grupos.

#### Dependencias añadidas
- `@dnd-kit/core` ^6.3.1 y `@dnd-kit/utilities` ^3.2.2 en `package.json`.

### Convenciones clave (sesión 10)
- **`crearGruposConIntegrantes`** es la action principal para modos Aleatoria y Manual. `crearGrupos` solo para Por afinidad.
- **Participación de grupos** va a tabla `participacion` existente (nivel 1-5, observacion), **NO** a `grupo_participacion`. La tabla `grupo_participacion` existe en BD pero no tiene uso desde el frontend.
- **Migraciones pendientes de aplicar manualmente en Supabase**: `20260426_grupos_clase.sql` y `20260426_grupos_student_rls.sql`.

---

## Features recientes (2026-04-26 — sesión 9)

### Exportación de asistencia para Moodle CSV
- **Utilidad compartida** `src/lib/moodle-csv.ts`: funciones `buildMoodleCSV`, `downloadCSV`, `calcularHorasDesdeHorario` — lógica reutilizable por todos los puntos de descarga.
- **Lógica de expansión por horas**: Presente → P en todas las horas de la sesión; Ausente → A en todas; Atraso → hora 1 = A, horas 2+ = P.
- **Número de horas**: calculado desde `horarios_clases.hora_inicio/hora_fin` del día de la sesión mediante `calcularHorasDesdeHorario`.
- **Identificador Moodle**: `estudiantes.email` (campo añadido a las queries que cargan la lista).
- **Formato CSV**: 2 columnas `username,status`; un archivo por hora de clase (ej: "Asistencia_Hora1_2026-04-26.csv").

### Puntos de descarga Moodle
- **Finalizar clase** (`modo-clase-client.tsx`): overlay post-finalización muestra chip "Moodle CSV" + N botones de descarga (uno por hora). Prop `horasClase` + `estadoClase` pasados desde el RSC.
- **Ver resumen** (clase cumplida): panel fijo al pie de la columna de asistencia cuando `estadoClase === 'cumplido'`.
- **Reporte de asistencia** (`/cursos/[cursoId]/asistencia`): botón "Exportar para Moodle" → `<select>` de sesiones ordenado más reciente primero → al elegir fecha aparecen los N botones de hora.

### UX del selector de plataforma
- Chip `[Moodle CSV]` identifica la plataforma. Diseño extensible para agregar Classroom, Blackboard u otras en el futuro añadiendo chips adicionales.

### Reporte de asistencia paginado — `AsistenciaGridClient`
- **Nuevo componente**: `src/components/cursos/asistencia-grid-client.tsx` — sustituye la tabla estática anterior.
- **Ventana deslizante**: 3 columnas en mobile (< 640px) / 5 en tablet (< 1024px) / 6 en desktop.
- **Orden por defecto**: arranca mostrando las fechas más recientes.
- **Navegación**: botones `‹ ›` para desplazarse entre ventanas de fechas. Label de rango visible ("12 Abr – 30 Abr") + indicador de página (2/4).
- **Porcentaje de asistencia**: siempre calculado sobre TODAS las sesiones (no solo las visibles en la ventana actual).

### Archivos modificados
- `src/app/dashboard/modo-clase/[bitacoraId]/page.tsx`: añade `email` a la query de estudiantes, calcula `horasClase` desde `horarios_clases`, pasa `estadoClase` al cliente.
- `src/app/dashboard/modo-clase/[bitacoraId]/modo-clase-client.tsx`: nuevos props `estadoClase` y `horasClase`, integra utilidad compartida.
- `src/app/dashboard/cursos/[cursoId]/asistencia/page.tsx`: RSC simplificado que delega toda la tabla al `AsistenciaGridClient`.

---

## Features recientes (2026-04-26 — sesión 8)

### Ruleta mejorada (`src/components/herramientas/Ruleta.tsx`)
- **Texto horizontal** en los segmentos — eliminada la rotación del `<text>` SVG; nombres aparecen rectos, posicionados al 76% del radio (pegados al borde exterior).
- **Ticker animado** encima de la ruleta — caja fija que cicla nombres aleatoriamente mientras gira (inicia ~50ms/nombre, desacelera gradualmente hasta ~300ms, efecto slot machine). Al parar muestra el ganador en la misma caja.
- **Formato de nombre ecuatoriano** (`formatStudentName`): 4 palabras → `Nombre1 Apellido1` (words[0]+words[2]); 3 palabras → words[0]+words[1]; 1-2 palabras → words[0].
- **Panel de exclusión** — lista lateral con checkbox por estudiante para incluir/excluir de la rueda. Botones "Incluir todos" / "Excluir todos". El ganador aparece marcado ★.
- **Excluir ganador automáticamente** — checkbox opcional; cada ganador se excluye solo para la próxima tirada.
- **Modo Lista libre** — tab que muestra un `<textarea>` (un elemento por línea) en lugar de estudiantes. Permite escribir `Grupo 1`, `Grupo 2`, etc. Si no hay curso seleccionado, arranca directamente en modo libre.
- **Rueda más grande**: 340px (antes 280px). Tamaño de fuente dinámico según cantidad de elementos.

### Tarjetas de cursos simplificadas (`/dashboard/cursos`)
- **Eliminada** la barra decorativa `"Pase de lista → Asistencia → Calificaciones →"` del pie de cada tarjeta — no eran links reales, sólo texto inútil dentro del `<Link>` del card.
- **Grid** cambiado de `md:grid-cols-2` fijo a `md:grid-cols-2 lg:grid-cols-3` — se ven más cursos sin scroll en pantallas grandes.
- **Gap** reducido de `gap-4` a `gap-3` para mayor densidad visual.
- Archivo: `src/app/dashboard/cursos/client.tsx`

---

## Features recientes (2026-04-25 — sesión 8)

### Fusión Planificación + Modo Clase → "Mis Clases"
- **Sidebar**: ítem "Clases" único (href: `/dashboard/planificacion`, matchAlso: `/dashboard/modo-clase`) reemplaza a "Planificación" y "Modo Clase" separados. Campo `matchAlso?: string` añadido a la interfaz `NavItem`.
- **`/dashboard/modo-clase/page.tsx`**: redirige a `/dashboard/planificacion` (página de listado eliminada).
- **`planificacion-client.tsx`**: título cambiado a "Mis Clases". Sección "Hoy" (visible solo cuando `weekOffset===0`) con botones contextuales por estado de bitácora: "+ Planificar" (sin bitácora), "Editar plan" + "▶ Iniciar clase" (planificada), "Continuar clase" (en progreso), "Ver resumen" (cumplida).
- **Celdas del grid semanal**: celdas "Planificado" son `<div>` con dos zonas — clic en info abre `PlanificarModal`, botón "▶ Iniciar clase" enlaza directo a `/dashboard/modo-clase/[entry.id]`. Celdas "Cumplido" tienen link "Ver resumen".
- **Tabla de detalle expandida**: columna Acciones con "▶ Iniciar clase" (azul) para planificadas y "Ver resumen" para cumplidas.
- **Herramientas al pie**: dos botones visibles "Ruleta de estudiantes" y "Agrupación aleatoria" → `/dashboard/herramientas`.
- **`BitacoraEntry`**: campo `hora_inicio_real: string | null` añadido al tipo local y a la query.

### Mejoras en `modo-clase-client.tsx`
- **Botón "← Salir"**: navega a `/dashboard/planificacion` sin modificar estado en BD (clase queda en progreso).
- **Botón "⏸ Pausar / ▶ Reanudar"**: pausa/reanuda el cronómetro local. Al reanudar, ajusta hora de inicio virtual para continuar desde donde pausó. No persiste en BD.
- **Botón "Detener" (naranja)**: con confirmación, llama `detenerClase()` → limpia `hora_inicio_real` en BD → clase vuelve a estado "planificado". Redirige a `/dashboard/planificacion`.
- **Mobile responsive**: tabs "Actividades" / "Asistencia" en móvil (`md:hidden`), dos columnas en desktop. Estado `mobileTab` controla panel activo. Header simplificado en móvil.

### Nueva server action: `detenerClase`
- **Archivo**: `src/lib/actions/bitacora.ts`
- **Firma**: `export async function detenerClase(bitacoraId: string): Promise<{ error?: string }>`
- **Lógica**: UPDATE `bitacora_clase` SET `hora_inicio_real = NULL` + `revalidatePath('/dashboard/planificacion')`

### Limpieza sidebar/mobile-nav
- Ítems "Nuevo Curso" y "Administración" del footer de `sidebar.tsx` eliminados (redundantes).
- Prop `esAdmin` eliminada de `mobile-nav.tsx`.

---

## Features recientes (2026-04-25 — sesión 7)

### Consolidación de navegación — sidebar simplificado
- **"Nuevo Curso"** eliminado del footer del sidebar → botón `+ Nuevo Curso` integrado en el header de `/dashboard/cursos`
- **"Perfil"** eliminado del sidebar → renombrado a **"Administración"** (único ítem del footer)
- **"Administración"** (link separado para admins) eliminado → fusionado en `/dashboard/config`
- **`/dashboard/config`** es ahora la página "Administración":
  - Todos los usuarios: formulario de perfil
  - Rol admin: tabs **Perfil** | **Panel Admin** (`?tab=admin`)
- **`/dashboard/admin`** → redirige a `/dashboard/config?tab=admin`
- **`Sidebar` y `MobileNav`** ya no aceptan prop `esAdmin` — eliminada del layout también

---

## Features recientes (2026-04-25 — sesión 5)

### Dashboard unificado (Panel)
- **Sidebar hover** (`sidebar.tsx`, `layout.tsx`): sidebar desktop colapsa a `w-16` (solo iconos) en reposo y expande a `w-[260px]` al hover. CSS puro con clase `group` + `group-hover`. Layout ajustado a `md:ml-16`.
- **Fusión dashboard + agenda**: `/dashboard/page.tsx` ahora incluye `AgendaClient` completo con todos sus controles (tutorías, eventos, planificación, pase de lista). `/dashboard/agenda/page.tsx` redirige a `/dashboard`.
- **Sidebar limpiado**: eliminados "Agenda" y "Tutorías" del nav. "Inicio" renombrado a "Panel". Orden actual: Panel → Planificación → Modo Clase → Mis Cursos → Herramientas. Cambio replicado en `sidebar.tsx` y `mobile-nav.tsx`.

### Nuevos componentes (`src/components/dashboard/`)
- **`SummaryPanel.tsx`**: panel colapsable con 3 stats + lista de cursos + botón Tomar Lista. Estado en `localStorage('summary-panel-open')`.
- **`TodayPanel.tsx`**: panel "Hoy" con flechas `< >` para navegar por días. Filtra clases normales, tutorías con reservas y eventos del día seleccionado. Clases `tutoria_curso` solo aparecen si hay confirmaciones ("Asistiré"). Toggle "Ver todos" muestra ítems sin actividad en opacidad reducida. Estado colapsable en `localStorage('today-panel-open')`.
- **`AgendaSection.tsx`**: wrapper colapsable sobre `AgendaClient`. Estado en `localStorage('agenda-section-open')`.

## Features recientes (2026-04-25 — sesión 6)

### Encuesta del grupo — expansión completa
- **Nuevas secciones**: dispositivo móvil (distribución Android/iOS/Ambos), elección de carrera (`carrera_inicio_deseada` vs `carrera_actual_deseada` con flecha de tendencia ↑↓), lectura (`libros_anio` promedio + `gusto_escritura` Likert 1-5).
- **`EncuestaTablaCliente`** (`src/components/cursos/encuesta-tabla-cliente.tsx`): filtro por nombre, columnas nuevas (dispositivo, carrera_actual, escritura), botón "✕ Limpiar entrada" por estudiante, fila expandible ▼ para agregar nota del profesor.
- **Nota del profesor** (`nota_incidencia TEXT` en tabla `estudiantes`): el profesor puede escribir/editar una nota de incidencia por estudiante. Se muestra en azul 📝 en la tabla.
- **`clearProblemas`** (`src/lib/actions/encuesta-actions.ts`): usa RPC SECURITY DEFINER `clear_problemas_estudiante` — NO usa admin client (ver convención abajo).
- **`saveNotaIncidencia`**: actualiza `estudiantes.nota_incidencia` con cliente normal (RLS del profesor).

### Bug fix — onboarding estudiantil
- `dispositivo_movil` y `libros_anio` eran inputs sin estado controlado en el form multi-step. Al cambiar de paso desaparecen del DOM → `new FormData()` no los capturaba → llegaban `null` a la BD. Fix: ambos campos agregados a `FormState` y con `fd.set()` en `handleSubmit`.

### SQL aplicado en Supabase (sesión 6)
```sql
ALTER TABLE public.estudiantes ADD COLUMN IF NOT EXISTS nota_incidencia TEXT;

CREATE OR REPLACE FUNCTION clear_problemas_estudiante(p_auth_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.estudiantes
    WHERE auth_user_id = p_auth_user_id AND profesor_id = auth.uid())
  THEN RAISE EXCEPTION 'Sin permiso'; END IF;
  UPDATE public.encuesta_estudiante SET problemas_reportados = NULL
  WHERE auth_user_id = p_auth_user_id;
END; $$;
```

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

## Features próximas sesiones

### PDF de evidencias estudiantil — enriquecer con datos del curso
Al inicio del PDF generado por el estudiante, incluir:
- Porcentaje de asistencia y registro por semana
- Actividades calificadas
- Asistencia a tutorías reservadas (asistió/faltó)
- **Ranking de participación disimulado**: frases predefinidas por rango (nivel 4-5 → "Tu participación refleja compromiso activo"; nivel 1-2 → "Se identifican oportunidades para fortalecer la participación"). El profesor reconoce el nivel, el estudiante no lo ve como calificación.

### Reporte PDF del profesor
Generar PDF por estudiante/curso con: notas de participación, observaciones, asistencia, si faltó a tutoría agendada.

### Acceso a reemplazante
Usuario externo (identificado por email) que cubre al profesor por período específico. Acceso restringido a: planificación, pase de lista, novedades. Prohibido: editar curso, descargar Moodle CSV. Requiere tabla `reemplazantes(profesor_id, email_reemplazante, fecha_inicio, fecha_fin)` + middleware de rol.

### ~~Seguimiento avanzado de citaciones a tutoría~~ ✅ IMPLEMENTADO
~~Nueva tabla `citaciones_tutoria`, ciclo de vida pendiente → agendada → asistida → cumplida, vista mensual.~~

### ~~Edición de curso — completar campos faltantes~~ ✅ IMPLEMENTADO
### ~~Nota de participación y observación en asistencia — modo clase~~ ✅ IMPLEMENTADO
### ~~Pase de lista — todos en Presente por defecto~~ ✅ IMPLEMENTADO
### ~~Modo extensivo — drag entre cursos~~ ✅ IMPLEMENTADO
### ~~Planificación semanal — navegación por día sin mover semana~~ ✅ IMPLEMENTADO
### ~~Panel "Hoy" — ocultable en planificación~~ ✅ IMPLEMENTADO
### ~~Planificación — respetar fechas del curso~~ ✅ IMPLEMENTADO
### ~~Ensamblador de evidencias (portal estudiante)~~ ✅ IMPLEMENTADO
### ~~Email automático al citar a tutoría~~ ✅ IMPLEMENTADO (via `enviarEmailCitacion` en `citaciones.ts`)
### ~~ChatBot estudiantil con datos reales~~ ✅ IMPLEMENTADO (`/api/student/chat` + `ChatBot.tsx` con Groq + FAQ local)
### ~~Corrección ortográfica IA en planificación~~ ✅ IMPLEMENTADO (`corregirPlan` en `generar-contenido.ts` + botones en `PlanificarModal.tsx`)
### ~~Contexto histórico en guías semanales~~ ✅ IMPLEMENTADO (`fetchHistorialClases` + param `cursoId` en `generarHtmlSemanal`/`generarGuiaSemanal`)
### ~~Detección de riesgo + citación masiva~~ ✅ IMPLEMENTADO (`RiesgoPanel.tsx` + detalle de curso)
### ~~Perfil pedagógico del grupo con IA~~ ✅ IMPLEMENTADO (`PerfilPedagogicoPanel.tsx` + encuesta RSC)
### ~~Autodiagnóstico estudiantil~~ ✅ IMPLEMENTADO (`AutodiagnosticoWidget.tsx` + `/student/page.tsx`)
### ~~Prep para tutoría tras reserva~~ ✅ IMPLEMENTADO (`generarPrepTutoria` + panel índigo en `tutorias-booking.tsx`)

## Bugs pendientes y deuda técnica

- **`database.types.ts` desactualizado**: tablas `actividades_inbox`, `citaciones_tutoria`, `logros_aprendizaje` y columnas nuevas de `reservas` (`modalidad`, `link_zoom`, `profesor_id`, `origen`, `curso_id`) y `horarios_clases.obligatoria` no tienen tipos — se usa `as any`. Actualizar antes de que se acumule más deuda.
- **Datos de participación pre-2026-05-14 pueden estar corruptos**: el `UNIQUE INDEX` que habilita el upsert no existía antes de esa fecha. Registros de ese período pueden ser incompletos. Auditar con: `SELECT curso_id, estudiante_id, fecha, COUNT(*) FROM participacion GROUP BY 1,2,3 HAVING COUNT(*) > 1`
- **`mobile-nav.tsx` requiere verificación**: "Tutorías" fue re-agregado al sidebar el 2026-05-21 — confirmar que `mobile-nav.tsx` también lo incluye en la misma posición.
- **Groq en producción**: `GROQ_API_KEY` requerida en Vercel para: `GeneradorPanel`, `PerfilPedagogicoPanel`, `AutodiagnosticoWidget`, `generarPrepTutoria` y `/api/student/chat`. Sin ella todos caen a fallback amigable. También `RESEND_API_KEY` y `RESEND_FROM_EMAIL` para `enviarEmailCitacion`.
- **`horario_id` nullable en `reservas`**: la migración `20260514_historial_tutorias.sql` hace `horario_id` nullable. Verificar que queries en `tutorias-manager.tsx` y `tutorias-page-client.tsx` no asumen NOT NULL.

## Convenciones críticas

### Supabase — proyecto de producción
El proyecto de producción (Vercel) es **`hxsnyrutyyavvljxwgku`**. El proyecto local (`.env.local`) apunta a **`vylkasmcveazzaspwgcr`**. **NUNCA** ejecutar migraciones o SQL críticos en el proyecto equivocado. Verificar siempre el project_id antes de usar el MCP.

### Creación de usuarios auth — CRÍTICO
**Nunca** insertar directamente en `auth.users` via SQL. GoTrue requiere que columnas como `email_change`, `confirmation_token`, `recovery_token`, `reauthentication_token` sean `''` (string vacío), no `NULL`. Un INSERT directo deja estas columnas en NULL y el login falla con "Database error querying schema".
- **Registro individual**: `supabase.auth.signUp()` desde la app ✓
- **Carga masiva**: `importarEstudiantesMasivo(cursoId, lista, passwordInicial)` → usa `auth.admin.createUser()` ✓
- **Emergencia**: `auth.admin.updateUserById()` desde código, nunca SQL directo

## Convenciones críticas

### Navegación — CRÍTICO
**`sidebar.tsx` y `mobile-nav.tsx` tienen arrays `navItems` completamente independientes.**
Al agregar, eliminar o reordenar un ítem en uno → replicarlo en el otro. Sin esto, los ítems sólo aparecen en desktop o sólo en móvil.

**Orden actual (sesión 15+, 2026-05-21):**
- `navItems` (main): **Panel → Clases → Tutorías → Mis Cursos → Herramientas**
- Footer / bottom del nav: **Administración** → `/dashboard/config`

`Sidebar` y `MobileNav` ya **no reciben `esAdmin`** como prop (eliminado en sesión 7). El rol admin lo maneja la propia página `/dashboard/config` leyendo la BD.

**Sidebar desktop hover**: `w-16` en reposo → `w-[260px]` al hover. Labels con `opacity-0 group-hover:opacity-100`. El layout usa `md:ml-16`, no `md:ml-[260px]`.

### Supabase
- `getUser()` en servidor, **nunca** `getSession()`
- Inserts siempre incluyen `profesor_id: user.id` (nunca del formData)
- RLS activo — no filtrar manualmente por `profesor_id` en SELECTs del profesor
- `encuesta_estudiante` tiene RLS desde 2026-04-25 con política para profesor y estudiante

### SECURITY DEFINER RPC > createAdminClient — CRÍTICO
Cuando el profesor necesita **escribir/actualizar** datos de una tabla que pertenece al estudiante (ej: `encuesta_estudiante`), usar una función PostgreSQL `SECURITY DEFINER` en vez de `createAdminClient()`:
- `createAdminClient()` requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel → da "Invalid API Key" si falla
- SECURITY DEFINER corre en el servidor PostgreSQL con privilegios elevados, sin depender de env vars
- La función valida la propiedad internamente (`profesor_id = auth.uid()`) antes de escribir
- Llamar con `db.rpc('nombre_funcion', { param: valor })`

Ejemplo aplicado: `clear_problemas_estudiante(p_auth_user_id UUID)` — borra `problemas_reportados` en `encuesta_estudiante` validando que el estudiante pertenece al profesor.

### Formularios multi-step (onboarding estudiantil)
Inputs en pasos no activos desaparecen del DOM → `new FormData()` no los captura al enviar.
**Regla**: todo campo que deba persistir entre pasos debe estar en `FormState` y ser inyectado con `fd.set()` en `handleSubmit`. Aplica especialmente a `<select>` e `<input type="number">` opcionales.

### Calificaciones y asistencia
- Calificaciones: upsert por `(estudiante_id, curso_id)`, nunca insert duplicado
- `estado` en asistencia: mayúscula inicial (`'Presente'`, `'Ausente'`, `'Atraso'`)
- Editar asistencias pasadas: ir a Bitácora y Lista → cambiar la fecha en el date picker

### Datos
- `centro_computo` es columna booleana en `horarios_clase`, no un enum de tipo de aula
- Portal estudiante usa RPC `get_occupied_slots` para bypassear RLS donde es necesario
