# Claude Code — gestor-universitario-next

> Instrucciones específicas para Claude Code. Para contexto general ver `AI_AGENTS.md`. **Antigravity y otros agentes: leer `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md` antes de cualquier cambio.**

## Token Optimization (Windows)
El tool `distill` no es compatible con Windows. Para comandos con salida grande, comprimir con Ollama:

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

## Workflow de deploy (en este orden)

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

## Filosofía del aplicativo

Este aplicativo **complementa** plataformas institucionales existentes (Moodle, campus virtual, etc.) — no las replica. El supuesto de diseño es que el profesor ya usa otras herramientas para registros formales (notas finales, entregas evaluadas, certificación de asistencia oficial). Lo que este sistema aporta es:

- **Centralización**: un único lugar para ver al estudiante como persona completa — asistencia, participación, tutorías, perfil socioeconómico, encuestas, grupos, trabajos en proceso.
- **Seguimiento de proceso**: captura datos que las plataformas formales no contemplan (participación en tiempo real de clase, notas "en curso" previas a su registro formal, diagnósticos intermedios, historial de tutorías).
- **Acompañamiento integral**: visibilidad del trayecto del estudiante, no solo sus calificaciones finales. Permite al profesor detectar riesgo, citar a tutoría, generar perfiles y tomar decisiones pedagógicas informadas.

### Principio reflexivo para nuevas funcionalidades

Antes de implementar una nueva función, el rol de la IA es acompañar al creador en esta reflexión — **sin bloquear la decisión**:

> ¿Esta función captura algo que las plataformas existentes no recogen, o facilita presentar/cruzar resultados de manera que aporte al seguimiento integral del estudiante? ¿O estamos duplicando un flujo que ya existe en Moodle/campus y que obligaría al profesor a registrar lo mismo en dos lugares?

El criterio no es "¿existe esto en Moodle?" sino **"¿aporta genuinamente al seguimiento centralizado e integral, o genera doble trabajo?"**. Si la respuesta no es clara, conviene señalarlo.

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
/dashboard/cursos/[cursoId]/tutorados → Tutorados de un curso tipo='tutorados'
/dashboard/estudiantes             → Ficha individual de estudiante
/dashboard/actividades             → Inbox de notas/tareas/recordatorios estilo Google Keep
/dashboard/agenda                  → redirige a /dashboard (agenda integrada en el Panel)
/dashboard/tutorias                → Horarios disponibles + reservas + tabs Historial/Citaciones
/dashboard/tutorados               → Lista global de tutorados (todos los cursos tipo='tutorados')
/dashboard/modo-clase              → redirige a /dashboard/planificacion
/dashboard/modo-clase/[bitacoraId] → Vista de clase en tiempo real (herramientas: ruleta, agrupación, ficha estudiante, tabs móvil)
/dashboard/herramientas            → Ruleta y agrupación de estudiantes
/dashboard/planificacion           → Mis Clases: panel "Hoy" + grid semanal + Generador IA + "▶ Iniciar clase" en celdas
/dashboard/config                  → Página "Administración": perfil del profesor + tabs admin (si rol=admin) + Reemplazantes
/dashboard/config?tab=admin        → Tab "Panel Admin": gestión de usuarios y permisos
/dashboard/admin                   → redirige a /dashboard/config?tab=admin
/student/                          → Portal del estudiante (onboarding, calendario, perfil, grupos)
/student/tutorias                  → Reserva de tutorías con modalidad (presencial/virtual/otro)
/student/evidencias                → Ensamblador de evidencias PDF
/student/encuesta-parcial/[cursoId]   → Formulario de encuesta de progreso del parcial (bloqueante al 50% del curso)
/dashboard/cursos/[cursoId]/encuesta-parcial → Resultados de encuesta de progreso del parcial (profesor)
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
- **docs-updater** — sincroniza CLAUDE.md con el estado real del código; úsalo con "actualiza la documentación"

## Skills disponibles (`.claude/skills/` y `.agents/skills/`)
- **`subir-planificacion`** — Carga masiva y estructurada de planificación/sílabo completo en Supabase
- **`registrar-clase`** — Registro e ingreso individual de sesión, cumplido y asistencia
- **`evaluar-participacion`** — Participación / control de lectura con fuzzy matching; no altera `asistencia`
- **`registrar-tutoria`** — Registra tutorías manuales en `reservas` (origen `manual`)
- **`explorar-tema-clase`** — Solo este proyecto, solo lectura. `/explorar-tema-clase "Tema"` muestra un dossier de propuesta (ubicación en el plan, textos existentes, enfoques alternativos, actividades, prompts de NotebookLM, 3 opciones de estilo visual a elegir y arquitectura slide a slide para Gemini) sin ejecutar ni escribir nada (ejemplo en `.claude/skills/explorar-tema-clase/ejemplo-giro-linguistico.md`)

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
| `GROQ_MODEL` | Modelo Groq (opcional, default `openai/gpt-oss-120b`) |
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
20260524_cursos_encuesta_config      → Columnas encuesta_inicial_habilitada y encuesta_parcial_habilitada BOOLEAN en cursos
20260524_encuesta_parcial            → Tabla encuesta_parcial (~60 columnas: perfil, autopercepción, relevancia profesional, satisfacción docente), UNIQUE(estudiante_id, curso_id, tipo), RLS, RPC get_encuestas_parciales_pendientes
20260525_multi_reservas_tutoria      → Tabla tipos_tutoria (defaults globales + personalizados); horarios.permitir_multiples + buffer_minutos; reservas.tipo_tutoria_id/hora_inicio_reserva/hora_fin_reserva/duracion_minutos; RPC reservar_tutoria v3 (micro-reservas encadenadas) + get_occupied_slots actualizada
20260526_fix_envios_registro_reenviar_policy → Fix RLS envios_registro: WITH CHECK explícito para política de reenvío (USING y WITH CHECK distintos)
20260527_reemplazantes               → Tabla reemplazantes(profesor_id, email_reemplazante, nombre, fecha_inicio, fecha_fin, activo); RLS; RPC get_reemplazante_info(email) SECURITY DEFINER
20260527_snapshot_parcial            → Tabla snapshot_parcial(curso_id, numero_parcial, fecha_cierre, semana_cierre, resumen JSONB); UNIQUE(curso_id, numero_parcial); RLS
20260529_alertas_silenciadas         → Columna cursos.alertas_silenciadas JSONB NOT NULL DEFAULT '{}' — shape: {riesgo, encuesta_parcial, riesgo_excluidos[]}
20260529_encuesta_parcial_forzada    → Columna cursos.encuesta_parcial_forzada BOOLEAN DEFAULT FALSE; RPC get_encuestas_parciales_pendientes actualizada con OR forzada
20260531_modo_tutorados              → Columna cursos.tipo TEXT ('regular'|'tutorados'); tablas tutorado_perfil y tutorado_sesiones con RLS completo
20260531_tutorado_perfil_campos_extra → Columnas fecha_asignacion, num_periodos, fecha_proyectada_fin, numero_oficio en tutorado_perfil
20260531_tutorado_perfil_institucion → Columnas universidad, facultad, carrera_tutorado en tutorado_perfil
20260602_cursos_estado               → Columnas cursos.estado TEXT ('activo'|'finalizado'|'archivado') + cursos.link_publicacion TEXT; auto-finaliza cursos con fecha_fin pasada
20260602_tutorado_estado             → Columnas tutorado_perfil.estado, finalizado_at, resultado ('graduado'|'aprobado'|'abandono'|'otro'), nota_final
20260602_tutorado_nivel_modalidad    → Renombra modalidad_trabajo CHECK → ('pregrado'|'maestria'|'doctorado'|'tecnologia'|'otro'); nueva columna tipo_trabajo TEXT con 6 opciones
20260602_tutorado_publicacion        → Columnas tutorado_perfil.publicado BOOLEAN, fecha_publicacion DATE, referencia_publicacion TEXT
20260603_inasistencia_reconocida     → Columnas reservas.justificacion_inasistencia TEXT + reservas.inasistencia_reconocida BOOLEAN DEFAULT false; índice parcial en (auth_user_id, inasistencia_reconocida, fecha)
20260727_sistema_heartbeat / _status_tracking → (histórico) tablas del keep-alive, eliminadas por 20260924_drop_keep_alive
20260922_enable_rls_all_tables      → (histórico) RLS explícita en tablas sistema_*
20260924_harden_security_definer_functions → REVOKE EXECUTE anon/PUBLIC en RPC SECURITY DEFINER + search_path (aplicada en prod)
20260614_suspender_clases           → Estado 'suspendido' en bitacora_clase_estado_check (feriados, paros)
20261001_estado_en_revision         → Estado 'en_revision' (planes generados con IA pendientes de aprobar)
20261004_estado_borrador            → Estado 'borrador' (autoguardado de PlanificarModal); ciclo borrador → planificado → cumplido
20261005_clases_extra_recuperacion  → bitacora_clase.tipo (regular|recuperacion|continuacion|extra) para clases fuera de horario
20261006_calificacion_rubricas      → Tabla calificacion_rubricas (criterios JSONB); resultados como calificaciones_items fuente='rubrica'
20261006_calificaciones_items_comentario → Columna calificaciones_items.comentario (retroalimentación del profesor por celda)
20261006_calificaciones_items_comentario_auto / _drop_comentario_auto → columna comentario_auto añadida y retirada (comentario automático se calcula al mostrar)
20261006_filosofia_acd1_rubrica / _filosofia_sync_lista_oficial → datos de un curso concreto (rúbrica ACD1; la sincronización de lista se vació por contener datos de estudiantes); no reutilizables
20261008_nombre_preferido_estudiantes → Columna estudiantes.nombre_preferido (solo uso informal en clase)
```

## Tipos TypeScript (`src/types/database.types.ts`)
Archivo mantenido **manualmente** (no regenerar sin revisar — tiene tablas extras no en el schema inicial):
- `horarios`, `reservas`, `encuesta_estudiante` — agregadas manualmente
- `estudiantes.auth_user_id`, `horarios_clases.centro_computo`, `cursos.nombres_tareas/num_parciales`, `asistencia.bitacora_id` — campos agregados via dashboard sin migración previa
- Tablas ya tipadas a mano: `tipos_tutoria`, `logros_aprendizaje`, `citaciones_tutoria`, `actividades_inbox`, `encuesta_parcial`
- **Deuda técnica acumulada** (tablas/columnas no reflejadas en los tipos, usan `as any`):
  - `reemplazantes` — tabla nueva completa
  - `snapshot_parcial` — tabla nueva completa (resumen JSONB)
  - `tutorado_perfil` — tabla nueva completa (~25 columnas)
  - `tutorado_sesiones` — tabla nueva completa
  - `reservas.modalidad`, `reservas.link_zoom`, `reservas.profesor_id`, `reservas.origen`, `reservas.curso_id` — columnas nuevas
  - `reservas.tipo_tutoria_id`, `reservas.hora_inicio_reserva`, `reservas.hora_fin_reserva`, `reservas.duracion_minutos` — columnas nuevas (multi-reservas)
  - `reservas.justificacion_inasistencia`, `reservas.inasistencia_reconocida` — columnas nuevas (reconocimiento de inasistencia)
  - `horarios.permitir_multiples`, `horarios.buffer_minutos` — columnas nuevas
  - `horarios_clases.obligatoria` — columna nueva
  - `cursos.tipo`, `cursos.estado`, `cursos.link_publicacion`, `cursos.alertas_silenciadas`, `cursos.encuesta_parcial_forzada` — columnas nuevas
  - `cursos.encuesta_inicial_habilitada`, `cursos.encuesta_parcial_habilitada` — columnas nuevas
  - `encuesta_estudiante` — campos `uso_ia_*` sin tipado estricto

## Reglas de dominio y estado vigente
Historial detallado por sesión: `docs/HISTORIAL_FEATURES.md`. Cambios por fecha: `CHANGELOG.md`.

### Reglas duras (leer `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`)
- **Nunca** llaves/tokens en código. Scripts usan `scripts/_supabase-env.js` (lee `.env.local`, hoy producción; `scripts/_supabase-prod.js` aborta si no lo es). La `service_role` de prod estuvo expuesta en GitHub (scripts commiteados en `8148356`) → **rotarla**; el repo es público.
- `.gitignore` bloquea `*.xlsx/.xls/.ods`, `r2-*.json`, `*.log`, `tmpcookies.txt`, `temp_query*.sql`, `scratch/` y scripts ad hoc (`inspect_*`, `test_*`, `check_*`, `clean_*`, `restore_*`, `registrar_participacion_*`).
- Nombres, correos e IDs de estudiantes no van al repo (ni en skills, scripts ni migraciones).
- Prohibidos los commits `chore: auto-commit — …`.
- Consultas con join a `cursos` filtran `estado='activo'` en la propia consulta (bug de `/dashboard/planificacion`).

### Reglas de negocio
- La asistencia (`asistencia`) es independiente de participación y notas en curso: registrar participación nunca la modifica.
- Ítems `calificaciones_items.fuente='en_curso'` son datos de proceso: NUNCA alimentan riesgo, citaciones ni funciones IA.
- Estados de `bitacora_clase`: `borrador` → `planificado` → `cumplido`; `en_revision` (planes generados con IA) → `planificado`; `suspendido`. Reescribir un plan conserva `cumplido` y `en_revision` (`bitacora.ts`).
- Encuesta parcial: se activa al 50 % del curso (o con `encuesta_parcial_forzada`) si `encuesta_parcial_habilitada`; bloquea `/student/*` hasta completarla. Orden de bloqueos del portal: onboarding → encuesta parcial → reconocimiento de inasistencia.
- Horas de tutoría ofrecidas: solo se acumulan cuando `semana_actual >= curso.fecha_inicio`.
- Grupos: `crearGrupos` acepta `estudianteIds` por grupo (vacío = afinidad). La participación de grupos va a `participacion`, no a `grupo_participacion` (sin uso).
- Moodle CSV (`src/lib/moodle-csv.ts`): Presente=`P`; Atraso=`FI` en hora 1 y `P` después; Ausente/retirado=`FI`. Se omiten correos `sinregistro.*` y `@pendiente.local` y `avisarOmitidosMoodle()` lo avisa.
- Corrector IA (`corregirPlan`): nunca toca URLs del campo `recurso`.
- El keep-alive cron fue eliminado (2026-09-24); no reintroducir.

### Seguridad DB (prod `hxsnyrutyyavvljxwgku`)
- RPC SECURITY DEFINER: `REVOKE EXECUTE` a PUBLIC/anon y `search_path=public` (`20260924_harden_security_definer_functions`). Siguen abiertas a anon: `check_student_email`, `consume_action_token`, `get_occupied_slots`, `is_admin`.
- Pendiente (advisor): activar *Leaked Password Protection* en Supabase Auth.

### IA (Groq)
- Todas las llamadas pasan por `src/lib/groq.ts` (`callGroq`): reintento ante 429, `reasoning_effort` para modelos `gpt-oss` y una línea `[groq]` con tokens por llamada en los logs.
- Skills para agentes (`.agents/skills/`): sus IDs de curso son de 2026-2 y caducan; re-consultar `cursos where estado='activo'`.

## Features próximas sesiones

### PDF de evidencias estudiantil — enriquecer con datos del curso
Al inicio del PDF generado por el estudiante, incluir:
- Porcentaje de asistencia y registro por semana
- Actividades calificadas
- Asistencia a tutorías reservadas (asistió/faltó)
- **Ranking de participación disimulado**: frases predefinidas por rango (nivel 4-5 → "Tu participación refleja compromiso activo"; nivel 1-2 → "Se identifican oportunidades para fortalecer la participación"). El profesor reconoce el nivel, el estudiante no lo ve como calificación.

### Reporte PDF del profesor
Generar PDF por estudiante/curso con: notas de participación, observaciones, asistencia, si faltó a tutoría agendada.

### Acceso a reemplazante — IMPLEMENTADO
Tabla `reemplazantes` + panel de gestión en `/dashboard/config` + RPC `get_reemplazante_info` están implementados (sesión 25). El middleware ya redirige a `/dashboard?acceso=restringido` las rutas de edición, calificaciones, encuesta parcial, configuración y nuevo curso. **Pendiente (opcional)**: restringir también el export Moodle CSV.

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
### ~~Multi-reservas por slot de tutoría~~ ✅ IMPLEMENTADO (`tipos_tutoria` + `horarios.permitir_multiples` + RPC v3)
### ~~Snapshot/Cierre de Parcial~~ ✅ IMPLEMENTADO (`snapshot_parcial` + `parcial.ts` + `CierreParcialesPanel`)
### ~~Sistema de notificaciones proactivas~~ ✅ IMPLEMENTADO (`NotificacionesPanel` + `notificaciones.ts` + alertas_silenciadas)
### ~~Modo Tutorados (doctorandos/tutorados pregrado)~~ ✅ IMPLEMENTADO (`tutorado_perfil` + `tutorado_sesiones` + sidebar Tutorados)
### ~~Retroalimentación formativa IA para estudiante~~ ✅ IMPLEMENTADO (`RetroalimentacionWidget` + `generarRetroalimentacionFormativa`)
### ~~Export dataset de investigación~~ ✅ IMPLEMENTADO (`exportarDatasetInvestigacion` + `ExportDatasetButton`)

## Bugs pendientes y deuda técnica

- **`database.types.ts` desactualizado**: faltan las tablas `reemplazantes`, `snapshot_parcial`, `tutorado_perfil`, `tutorado_sesiones` y ~15 columnas nuevas. Ver sección "Tipos TypeScript" para lista completa. Priorizar antes de añadir más features.
- **Datos de participación pre-2026-05-14 pueden estar corruptos**: el `UNIQUE INDEX` que habilita el upsert no existía antes de esa fecha. Registros de ese período pueden ser incompletos. Auditar con: `SELECT curso_id, estudiante_id, fecha, COUNT(*) FROM participacion GROUP BY 1,2,3 HAVING COUNT(*) > 1`
- **Groq en producción**: `GROQ_API_KEY` requerida en Vercel para: `GeneradorPanel`, `PerfilPedagogicoPanel`, `AutodiagnosticoWidget`, `generarPrepTutoria`, `/api/student/chat`, `RetroalimentacionWidget`. Sin ella todos caen a fallback amigable. También `RESEND_API_KEY` + `RESEND_FROM_EMAIL` para `enviarEmailCitacion`.
- **`horario_id` nullable en `reservas`**: la migración `20260514_historial_tutorias.sql` hace `horario_id` nullable. Verificar que queries en `tutorias-manager.tsx` y `tutorias-page-client.tsx` no asumen NOT NULL.
- **`tutorado_perfil.asignatura_tutorado`**: columna referenciada en el Schema Zod de `tutorados.ts` pero NO existe en las migraciones (no fue añadida). Si se intenta guardar → error de BD silencioso. Pendiente: migración `ADD COLUMN IF NOT EXISTS asignatura_tutorado TEXT`.

## Convenciones críticas

### Supabase — proyecto de producción
El proyecto de producción (Vercel) es **`hxsnyrutyyavvljxwgku`**. En esta máquina `.env.local` apunta a producción y `.env` a desarrollo **`vylkasmcveazzaspwgcr`** (confirmar siempre la URL que imprime el script). **NUNCA** ejecutar migraciones o SQL críticos en el proyecto equivocado. Verificar siempre el project_id antes de usar el MCP.

### Creación de usuarios auth — CRÍTICO
**Nunca** insertar directamente en `auth.users` via SQL. GoTrue requiere que columnas como `email_change`, `confirmation_token`, `recovery_token`, `reauthentication_token` sean `''` (string vacío), no `NULL`. Un INSERT directo deja estas columnas en NULL y el login falla con "Database error querying schema".
- **Registro individual**: `supabase.auth.signUp()` desde la app ✓
- **Carga masiva**: `importarEstudiantesMasivo(cursoId, lista, passwordInicial)` → usa `auth.admin.createUser()` ✓
- **Emergencia**: `auth.admin.updateUserById()` desde código, nunca SQL directo

### Navegación — CRÍTICO
**A partir de sesión 27, los items del nav están centralizados en `src/components/layout/nav-items.tsx`.**
`sidebar.tsx` y `mobile-nav.tsx` importan `NAV_ITEMS` y `FOOTER_ITEMS` desde ahí. Al agregar/reordenar un ítem → editar SOLO `nav-items.tsx`. No replicar.

**Orden actual (sesión 27+, 2026-06-01):**
- `NAV_ITEMS`: **Panel → Clases → Tutorías → Tutorados → Mis Cursos → Herramientas**
- `FOOTER_ITEMS`: **Administración** → `/dashboard/config`

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
- `centro_computo` es columna booleana en `horarios_clases`, no un enum de tipo de aula
- Portal estudiante usa RPC `get_occupied_slots` para bypassear RLS donde es necesario
