# Historial de features por sesión

> Movido desde `CLAUDE.md` (2026-10-11). Es un registro histórico: puede describir estados ya superados.
> Lo vigente (reglas, rutas, migraciones, variables de entorno, deuda) vive en `CLAUDE.md`;
> los cambios por fecha, en `CHANGELOG.md`.

## Features recientes (2026-09-14 → 2026-09-24 — sesiones 31-32)

### Reglas duras nuevas (leer `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`)
- **Nunca** llaves/tokens en código. Scripts usan `scripts/_supabase-env.js` (lee `.env.local`). La `service_role` de prod estuvo expuesta en GitHub (scripts commiteados en `8148356`) → **rotarla**.
- `.gitignore` bloquea `*.xlsx/.xls/.ods`, `r2-*.json`, `*.log`, `tmpcookies.txt`, `temp_query*.sql`, `scratch/` y scripts ad hoc (`inspect_*`, `test_*`, `check_*`, `clean_*`, `restore_*`, `registrar_participacion_*`).
- Prohibidos los commits `chore: auto-commit — …`.
- Consultas con join a `cursos` deben filtrar `estado='activo'` en la propia consulta (bug de `/dashboard/planificacion`).

### Planificación — solo cursos activos
- **FIX** `src/app/dashboard/planificacion/page.tsx` filtra `clasesActivas` (`cursos.estado` activo/null) además de `cursosActivos`.
- **FIX** `planificacion-client.tsx`: `courseGroups`, `sinPlanificar` y progreso semanal ignoran cursos no activos y fechas fuera de `fecha_inicio`/`fecha_fin`.

### Seguridad DB (aplicado en prod `hxsnyrutyyavvljxwgku`, 2026-09-24)
- `20260922_enable_rls_all_tables` — RLS explícita en tablas `sistema_*` (luego eliminadas). Todas las demás tablas ya tenían RLS.
- `20260924_harden_security_definer_functions` — REVOKE EXECUTE a PUBLIC/anon en RPC SECURITY DEFINER; trigger/internas (`handle_new_user`, `vincular_estudiante_al_registrarse`, `activar_estudiantes_faltantes`, `increment_horas_tutoria`, `get_unreported_tutorias`) sin acceso por API; `search_path=public` en 8 funciones. Se mantienen abiertas a anon: `check_student_email`, `consume_action_token`, `get_occupied_slots`, `is_admin` (usada por políticas).
- Pendiente (advisor): activar *Leaked Password Protection* en Supabase Auth; `email_action_tokens` sin políticas (intencional).
- `20260924_drop_keep_alive` — DROP de `sistema_heartbeat`/`sistema_status`.

### Keep-alive cron — ELIMINADO (2026-09-24)
- Se borraron `/api/cron/keep-alive`, `/status`, `src/lib/agents/keep-alive.js`, el `crons` de `vercel.json` y las tablas `sistema_heartbeat`/`sistema_status` (migración `20260924_drop_keep_alive`). No reintroducir.

### Modo Clase
- **FEAT** participación y observaciones del día precargadas (`participacionInicial`), retirados excluidos de la vista Lista. Sincronización props→estado con dependencia serializada (no pisa ediciones locales).

### Moodle CSV (`src/lib/moodle-csv.ts`)
- Presente=`P`; Atraso=`FI` hora 1 y `P` después; Ausente/retirado=`FI`. Se **omiten** correos `sinregistro.*` y `@pendiente.local`; al descargar, `avisarOmitidosMoodle()` avisa con la lista de omitidos.

### Skills para agentes (`.agents/skills/`)
- `evaluar-participacion` (+ `scripts/evaluar_participacion.js`): registra participación/control de lectura con fuzzy matching; **no altera `asistencia`**.
- `registrar-tutoria`: registra tutorías en `reservas` (origen `manual`, `asistio true`).
- `subir-planificacion`: carga masiva de sílabo. Los IDs de curso listados en los skills son **de 2026-2 y caducan**: re-consultar `cursos where estado='activo'`.

### Generador IA
- `src/lib/bitacora-legacy.ts` (`actividadesDesdeBitacora`): el generador respeta actividades/recursos en formato legacy. `GROQ_MODEL` actualizado en Vercel (requiere redeploy).

---

## Features recientes (2026-06-03 — sesión 30)

### Reconocimiento de inasistencia a tutoría — portal estudiantil bloqueante

#### Lógica de detección (doble trigger)
- **Por acción del profesor**: cuando el profesor marca `reservas.asistio = false` en el Historial de tutorías.
- **Por tiempo automático**: si `reservas.fecha < hoy - 7 días` y `asistio IS NULL` (sin acción del profesor).
- Solo aplica a reservas con `estado != 'cancelado'` y `inasistencia_reconocida = false`.

#### Bloqueo del portal
- **MOD** `src/app/student/layout.tsx` — tercer bloqueo (orden: onboarding → encuesta_parcial → inasistencia). Redirige a `/student/inasistencia/[id]` con la reserva más antigua sin reconocer. Al haber múltiples, se resuelven una a una.
- El check usa `.or('asistio.eq.false,and(fecha.lt.FECHA,asistio.is.null)')` sobre `reservas` directamente (sin RPC).

#### DB
- **FEAT** `supabase/migrations/20260603_inasistencia_reconocida.sql` — `reservas.justificacion_inasistencia TEXT` + `reservas.inasistencia_reconocida BOOLEAN NOT NULL DEFAULT false` + índice parcial `idx_reservas_inasistencia`. Aplicado en producción.

#### Server Action
- **FEAT** `reconocerInasistencia(reservaId, justificacion)` en `src/lib/actions/tutorias.ts` — update con `.eq('auth_user_id', user.id)` (seguridad por RLS). Acepta texto libre; guarda razón elegida + detalle si aplica.

#### Página bloqueante
- **FEAT** `src/app/student/inasistencia/[reservaId]/page.tsx` — RSC: carga reserva + nombre profesor (via `profesor_id` o `horarios.profesor_id`) + nombre curso.
- **FEAT** `src/app/student/inasistencia/[reservaId]/inasistencia-form.tsx` — client component. Muestra fecha/hora/profesor/asignatura de la sesión no asistida. 5 radios de razón: "Tuve un imprevisto / Se me olvidó / Problema de salud / Problema técnico o de conexión / Otro". Textarea si elige "Otro". Botón "Registrar y continuar" → llama `reconocerInasistencia` → redirect a `/student`. Link secundario "Ver agenda de tutorías" → `/student/tutorias`.

---

## Features recientes (2026-05-25 → 2026-06-02 — sesiones 24-29)

### Multi-reservas por slot de tutoría (sesión 24 — 2026-05-25)
- **FEAT** Tabla `tipos_tutoria(id, profesor_id, nombre, duracion_minutos, descripcion, activo, orden)` — defaults globales (profesor_id=NULL) + personalizados por profesor. RLS: profesor ve suyos + globales; autenticado ve todos activos. Defaults: Duda rápida (10min) → Revisión proyecto titulación (60min).
- **FEAT** `horarios.permitir_multiples BOOLEAN DEFAULT false` + `horarios.buffer_minutos INT DEFAULT 2` — activa modo micro-reservas en un slot.
- **FEAT** `reservas.tipo_tutoria_id`, `hora_inicio_reserva TIME`, `hora_fin_reserva TIME`, `duracion_minutos INT` — encadenamiento de micro-reservas.
- **FEAT** RPC `reservar_tutoria` v3: rama clásica (sin multiples) + rama micro-reservas (calcula `hora_inicio_nueva = MAX(hora_fin anterior) + buffer`, valida que cabe en el slot).
- **FEAT** RPC `get_occupied_slots` actualizada: retorna `reservas_count`, `minutos_usados`, `minutos_totales`, `esta_lleno`, `permite_multiples` por slot.

### Fix RLS envios_registro (sesión 24 — 2026-05-26)
- **FIX** Política `estudiante_reenviar_rechazado` en `envios_registro`: `WITH CHECK` explícito separado del `USING`. Sin esto, PostgreSQL usaba USING como WITH CHECK y bloqueaba el UPDATE porque el row ya no tenía `estado='rechazado'` después del update.

### Reemplazantes (sesión 25 — 2026-05-27)
- **FEAT** Tabla `reemplazantes(profesor_id, email_reemplazante, nombre, fecha_inicio, fecha_fin, activo)` con RLS. RPC `get_reemplazante_info(email)` SECURITY DEFINER — detecta si un usuario autenticado es reemplazante activo.
- **FEAT** `src/lib/actions/reemplazantes.ts` — `getReemplazantes`, `agregarReemplazante`, `desactivarReemplazante`. Validación Zod completa.
- **FEAT** `src/components/config/ReemplazantesPanel.tsx` — formulario + tabla en `/dashboard/config`.
- `middleware.ts` (l.68-94) redirige a `/dashboard?acceso=restringido` las rutas `/editar`, `/calificaciones`, `/encuesta-parcial`, `/dashboard/config` y `/dashboard/cursos/nuevo` cuando `get_reemplazante_info(email)` devuelve fila. No bloquea asistencia ni exportación Moodle CSV.

### Snapshot / Cierre de Parcial (sesión 25 — 2026-05-27)
- **FEAT** Tabla `snapshot_parcial(id, profesor_id, curso_id, numero_parcial, fecha_cierre, semana_cierre, resumen JSONB)` — UNIQUE(curso_id, numero_parcial). RLS.
- **FEAT** `src/lib/actions/parcial.ts` — `cerrarParcial(cursoId, numeroParcial)`: agrega asistencia global, participación global, encuesta respondida/total, trabajos, notas en curso por estudiante; upsert en `snapshot_parcial`. `getSnapshotsParcial(cursoId)`. `eliminarSnapshot(id)`.
- **FEAT** `src/components/cursos/CierreParcialesPanel.tsx` — panel colapsable en detalle de curso: lista de snapshots con métricas globales, expandible por estudiante. Botón "Cerrar Parcial N" con confirmación. Eliminación con confirmación.
- **FEAT** `src/components/cursos/RiesgoHistoricoPanel.tsx` — basado en snapshot: muestra estudiantes con múltiples factores de riesgo (asistencia < 75% + participación < 2.5 + notas en curso < 50%). Botón "Citar a N estudiantes" con citación masiva.

### Sistema de notificaciones proactivas (sesión 26 — 2026-05-29)
- **FEAT** `cursos.alertas_silenciadas JSONB` — shape `{riesgo: boolean, encuesta_parcial: boolean, riesgo_excluidos: string[]}`. Persiste silenciado por curso.
- **FEAT** `src/lib/actions/notificaciones.ts` — `getNotificacionesProactivas()`: detecta (1) estudiantes < 60% asistencia sin citación activa, (2) encuesta activa con < 100% respuestas, (3) citaciones sin respuesta > 3 días, (4) trabajos vencidos. Respeta `alertas_silenciadas`. Tipos: `riesgo_critico | encuesta_pendiente | citacion_sin_respuesta | trabajos_vencidos`. Niveles: `critica | advertencia | info`.
- **FEAT** `src/components/dashboard/NotificacionesPanel.tsx` — panel en dashboard con chips de notificación, botón silenciar por curso. Persiste via `silenciarAlerta/restaurarAlerta` en `cursos.ts`.
- **FEAT** `src/lib/actions/cursos.ts` — nuevas actions: `silenciarAlerta(cursoId, tipo)`, `restaurarAlerta(cursoId, tipo)`, `exportarDatasetInvestigacion(cursoId)`.
- **FEAT** `src/components/cursos/EncuestaBanner.tsx` — banner ámbar en detalle de curso cuando encuesta activa; botón silenciar/restaurar inline.
- **FEAT** `src/components/cursos/ExportDatasetButton.tsx` — botón "Exportar datos (.csv)" en detalle de curso. Exporta CSV de investigación con columnas: id_anonimizado, asistencia_pct, participacion_avg, trabajos_completados/activos, notas_en_curso_pct, 5 dims autopercepción de encuesta_parcial.

### Encuesta parcial forzada (sesión 26 — 2026-05-29)
- **FEAT** `cursos.encuesta_parcial_forzada BOOLEAN DEFAULT FALSE` — activa la encuesta sin esperar al 50% del curso.
- **MOD** RPC `get_encuestas_parciales_pendientes` — condición expandida: `forzada = TRUE OR pct_transcurrido >= 0.50`.

### Portal estudiante — progreso y retroalimentación IA (sesión 26)
- **FEAT** `src/components/student/MiProgreso.tsx` — score general ponderado (asistencia 40% + participación 30% + trabajos 30%), barras semáforo por métrica. Sin datos de API — cómputo puro en componente.
- **FEAT** `src/components/student/RetroalimentacionWidget.tsx` — botón "✦ Ver retroalimentación formativa". Llama `generarRetroalimentacionFormativa` Groq: 3 párrafos (Fortalezas / Oportunidades / Estrategias), ≤180 palabras, prosa sin listas.
- **FEAT** `generarRetroalimentacionFormativa(params)` en `generar-contenido.ts` — Groq, temperatura 0.7, basado en asistencia + trabajos + tutorías.
- **MOD** `src/app/student/page.tsx` — `MiProgreso` + `RetroalimentacionWidget` integrados por tarjeta de curso.

---

### Modo Tutorados — feature completa (sesiones 27-29 — 2026-05-31 → 2026-06-02)

#### Discriminador en cursos
- **FEAT** `cursos.tipo TEXT DEFAULT 'regular'` (regular|tutorados) — discrimina cursos normales de grupos de tutorados doctorales/pregrado.
- **FEAT** `cursos.estado TEXT DEFAULT 'activo'` (activo|finalizado|archivado) + `cursos.link_publicacion TEXT` — ciclo de vida de cursos; auto-finaliza cursos con `fecha_fin < hoy`.

#### DB — tablas
- **FEAT** `tutorado_perfil` — 1 fila por estudiante en curso tipo='tutorados'. Columnas principales:
  - Académico: `modalidad_trabajo` (pregrado|maestria|doctorado|tecnologia|otro), `tipo_trabajo` (articulo_cientifico|sistematizacion_experiencias|creacion_productos|examen_complexivo|proyecto_investigacion|otro), `titulo_trabajo`, `etapa`, `progreso_pct`
  - Institucional: `universidad`, `facultad`, `carrera_tutorado`
  - Gestión: `fecha_asignacion`, `num_periodos`, `fecha_proyectada_fin`, `numero_oficio`
  - Horario: `dia_semana`, `hora_inicio`, `hora_fin`, `modalidad_sesion`, `nota_horario`
  - Publicación: `publicado BOOLEAN`, `fecha_publicacion DATE`, `referencia_publicacion TEXT`
  - Estado: `estado` (activo|finalizado), `finalizado_at`, `resultado` (graduado|aprobado|abandono|otro), `nota_final`
- **FEAT** `tutorado_sesiones` — bitácora por sesión: `fecha`, `modalidad`, `duracion_minutos`, `lo_realizado`, `proximo_paso`. RLS completo.

#### Server Actions
- **FEAT** `src/lib/actions/tutorados.ts` — CRUD completo: `getTutorados(cursoId?)`, `getTutoradoDetalle(estudianteId, cursoId)`, `upsertTutoradoPerfil(cursoId, estudianteId, data)`, `registrarSesion(cursoId, estudianteId, data)`, `getSesiones(estudianteId, cursoId)`, `finalizarTutorado(estudianteId, cursoId, resultado, notaFinal)`.

#### Componentes
- **FEAT** `src/components/tutorados/TutoradosPanel.tsx` — lista de tutorados con estado, progreso, última sesión. Abre EditarPerfilTutorado o RegistrarSesionModal.
- **FEAT** `src/components/tutorados/EditarPerfilTutorado.tsx` — formulario completo de perfil (modal/drawer).
- **FEAT** `src/components/tutorados/RegistrarSesionModal.tsx` — modal para registrar sesión: fecha, modalidad, duración, lo realizado, próximo paso.
- **FEAT** `src/components/tutorados/SesionesTimeline.tsx` — línea de tiempo de sesiones registradas.
- **FEAT** `src/components/tutorados/FinalizarTutoradoModal.tsx` — modal de cierre: resultado + nota final.

#### Páginas
- **FEAT** `src/app/dashboard/tutorados/page.tsx` — lista global de todos los tutorados (todos los cursos tipo='tutorados' del profesor).
- **FEAT** `src/app/dashboard/cursos/[cursoId]/tutorados/page.tsx` — tutorados de un curso específico.

#### Integración agenda
- **MOD** `src/app/dashboard/agenda/agenda-client.tsx` — muestra horarios permanentes de tutorados en el grid semanal (colores por nivel: pregrado=violeta, maestria=índigo, doctorado=azul, tecnologia=teal).
- **MOD** `src/components/dashboard/TodayPanel.tsx` — muestra tutorados con sesión programada hoy. Nombre completo en celda. Color según nivel.

#### Sidebar
- **MOD** `src/components/layout/nav-items.tsx` — **Tutorados** añadido entre Tutorías y Mis Cursos. Array `NAV_ITEMS` centralizado aquí; sidebar y mobile-nav lo importan.

---

## Features recientes (2026-05-23 — sesión 21)

### Integración IA extendida — Groq en toda la app (solo Groq, sin Ollama en producción)

#### Corrección ortográfica con IA en PlanificarModal
- **FEAT** `corregirPlan({ texto })` en `src/lib/actions/generar-contenido.ts` — Groq con prompt estricto de solo corrección ortográfica y conectores lógicos. NUNCA reescribe ni cambia contenido.
- **MOD** `src/components/agenda/PlanificarModal.tsx`:
  - **Un solo botón** `✦ Corregir ortografía` debajo de la sección Actividades → `handleCorregirTodo()`.
  - Corre en paralelo: `tema` + `observaciones` + todos los campos `actividad` + campos `recurso` no-URL (`!esUrl(recurso)`). URLs en `recurso` nunca se tocan.
  - Estado `correcting: 'all' | null` — deshabilita el botón mientras corre.

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

## Features recientes (2026-05-23 — sesión 22)

### "Notas en curso" — integración en pase de lista y modo clase

#### Pase de lista (`/dashboard/cursos/[cursoId]/pase-lista`)
- **MOD** `src/app/dashboard/cursos/[cursoId]/pase-lista/page.tsx` — query `calificaciones_items` con `.eq('fuente', 'en_curso')`, computa `resumenEnCurso: Record<string, { total: number; conNota: number }>` por estudiante, pasa a `PaseListaWrapper`.
- **MOD** `src/components/pase-lista/pase-lista-wrapper.tsx` — prop `resumenEnCurso` threaded hacia `PaseListaClient`.
- **MOD** `src/components/pase-lista/pase-lista-client.tsx` — badge "Notas en curso: X/Y" en stats por estudiante con color semáforo (rojo < 50% / amarillo < 80% / verde ≥ 80%).

#### Modo clase — columna de asistencia (`modo-clase-client.tsx`)
- **MOD** `src/app/dashboard/modo-clase/[bitacoraId]/modo-clase-client.tsx`:
  - Columna derecha ampliada `md:w-80` → `md:w-96`.
  - **Estado a nivel de componente**: `ecAbierto: Set<string>`, `ecEditando`, `ecPending` (useTransition), `ecItems/ecActividades/ecIndex` calculados desde `itemsEnCurso` prop.
  - **Botón 📊 por estudiante**: naranja (`bg-amber-700`) cuando tiene pendientes, gris cuando todo calificado, violeta cuando expandido.
  - **Sección expandible por estudiante (vista Lista)**: tabla de 2 columnas mostrando SOLO ítems sin nota. Edición inline — Enter/✓ guarda, Escape cancela. Llama `upsertItemEnCurso`. Si todas calificadas: texto verde "✓ Todas las actividades calificadas".
  - **Barra de herramientas**: botón ★ toggle participación + botón 📊 toggle "Notas en curso" (abre/cierra todos).
  - **Vista Uno por uno**: sección "Notas en curso" tras Participación — misma tabla de pendientes con edición inline.
  - **VistaGrupo**: props opcionales `ecActividades?`, `ecIndex?`, `ecEditando?`, `setEcEditando?`, `guardarEcNota?`, `ecPending?` — muestra notas pendientes por integrante.
  - **Rename**: "En Curso" → "Notas en curso" en toda la UI del componente.
  - **`toggleTodosParticipacion`**: renombrado desde `expandirTodosParticipacion`, ahora verdadero toggle (cierra si todos están abiertos).

#### Aislamiento IA verificado
- **VERIFICADO** `calificaciones-tabs.tsx` líneas 39-40: `itemsMoodle = items.filter(fuente in ['moodle','manual'])`, `itemsEnCurso = items.filter(fuente === 'en_curso')`. `ItemsTab` solo recibe `itemsMoodle`. ✓
- **VERIFICADO** `RiesgoPanel` + `cursos/[cursoId]/page.tsx`: riesgo calculado solo desde tabla `asistencia` (pct < 75%). Sin acceso a `calificaciones_items`. ✓
- **VERIFICADO** `generar-contenido.ts`: cero referencias a `calificaciones_items` ni `en_curso`. Funciones Groq reciben solo datos de encuesta/asistencia/trabajos. ✓
- **REGLA**: ítems `fuente='en_curso'` son actividades calificadas en tiempo real de clase. NUNCA deben alimentar análisis de riesgo, citaciones, ni funciones IA — son datos de proceso, no evaluativos formales.

---

## Features recientes (2026-05-24 — sesión 23)

### Encuesta de Progreso de Parcial — portal estudiante y dashboard profesor

#### Activación y bloqueo
- **REGLA DE NEGOCIO**: La encuesta se activa cuando el curso alcanza el 50% de su duración y `encuesta_parcial_habilitada = true`. Bloquea el portal del estudiante hasta que sea completada — no puede acceder a ninguna ruta de `/student/` mientras tenga encuestas pendientes.
- **MOD** `src/app/student/layout.tsx` — tras el check de onboarding, llama RPC `get_encuestas_parciales_pendientes(auth_user_id)` y redirige a `/student/encuesta-parcial/[cursoId]` si retorna resultados.

#### DB
- **FEAT** `supabase/migrations/20260524_cursos_encuesta_config.sql` — columnas `encuesta_inicial_habilitada BOOLEAN DEFAULT false` y `encuesta_parcial_habilitada BOOLEAN DEFAULT false` en `cursos`.
- **FEAT** `supabase/migrations/20260524_encuesta_parcial.sql` — tabla `encuesta_parcial` con ~60 columnas: actualizaciones de perfil (trabajo, tech, vivienda, carrera, horas estudio), 9 dimensiones de uso IA (Likert 1-5), autopercepción + checkboxes de dificultad, relevancia profesional, 14 ítems de retroalimentación docente (Likert 1-5) + texto libre. `UNIQUE(estudiante_id, curso_id, tipo)`. RLS para profesor y estudiante. RPC `get_encuestas_parciales_pendientes(p_auth_user_id TEXT)`.

#### Server Actions
- **FEAT** `src/lib/actions/encuesta-parcial.ts` (nuevo) — `getEncuestaParcialExistente`, `guardarEncuestaParcial`, `getResultadosEncuestaParcial`, `getDetalleEncuestaParcial`, `getEncuestaParcialParaDrawer`, `getEstadoEncuestasParciales`.
- **MOD** `src/lib/actions/cursos.ts` — `CursoFullSchema` incluye `encuesta_inicial_habilitada` y `encuesta_parcial_habilitada`; `actualizarCurso` maneja conversión booleana y update.
- **MOD** `src/lib/actions/ficha-estudiante.ts` — `FichaEstudianteData` incluye campo `encuestaParcial`; `getFichaEstudiante` consulta tabla `encuesta_parcial`.

#### Portal estudiante
- **FEAT** `src/app/student/encuesta-parcial/[cursoId]/page.tsx` (nuevo) — RSC que valida acceso, verifica `encuesta_parcial_habilitada`, carga respuesta existente.
- **FEAT** `src/app/student/encuesta-parcial/[cursoId]/encuesta-parcial-form.tsx` (nuevo) — wizard de 5 pasos con guardado de borrador en localStorage. Pasos: 1) trabajo/tech/vivienda/carrera/horas estudio, 2) 9 ítems IA Likert + gusto escritura, 3) autopercepción + checkboxes de dificultad, 4) relevancia profesional, 5) 14 ítems retroalimentación docente Likert + texto libre.
- **MOD** `src/app/student/page.tsx` — badge de estado por curso: verde si completada, ámbar con link si pendiente (rango 50-100% del curso).

#### Dashboard profesor
- **MOD** `src/app/dashboard/cursos/[cursoId]/editar/editar-client.tsx` — checkboxes para habilitar/deshabilitar ambos tipos de encuesta en el tab Información.
- **MOD** `src/app/dashboard/cursos/[cursoId]/page.tsx` — banner de notificación ámbar cuando 50% ≤ pct < 75% y encuesta habilitada — muestra "N de M estudiantes han respondido" con link a resultados.
- **FEAT** `src/app/dashboard/cursos/[cursoId]/encuesta-parcial/page.tsx` (nuevo) — RSC de resultados completos: 4 tarjetas KPI, tablas de promedios por dimensión, comparativa IA con indicadores de cambio, barras de distribución de dificultad.
- **FEAT** `src/app/dashboard/cursos/[cursoId]/encuesta-parcial/encuesta-parcial-detail-client.tsx` (nuevo) — tabla colapsable de respuestas individuales.

#### FichaEstudianteDrawer
- **MOD** `src/components/ficha-estudiante/FichaEstudianteDrawer.tsx` — subsección "Encuesta de progreso" en tab resumen: semana/%, situación laboral, horas estudio, scores de autopercepción con color, chips de dificultad, log cambios_perfil.

#### Impacto pedagógico (EFL / pipeline de datos)
- La encuesta de progreso cierra el ciclo de datos cuantitativos del parcial: asistencia + participación + calificaciones en curso + autopercepción del estudiante quedan registrados simultáneamente. Los scores de autopercepción lingüística (ítem 1-5 por dimensión) son comparables entre parciales y con la encuesta inicial — permiten calcular delta de autopercepción, correlacionable con STT y fluencia en el marco KEYHOLE.

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
- **FEAT** `src/lib/actions/generar-contenido.ts` — Groq API (modelo en `GROQ_MODEL`): `generarHtmlSemanal` (HTML estilo Moodle LMS con restricciones estrictas: no inventar referencias, videos y Google Slides como botón CTA, sin `<iframe>`), `generarGuiaSemanal` (texto plano con competencias blandas, rúbrica 4 niveles, logros institucionales opcionales), `mejorarContenido` (chat de refinamiento con historial).
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
- Orden vigente: ver «Navegación — CRÍTICO» en Convenciones críticas.
- **Tutorias** re-agregado al sidebar (había sido removido en sesión 7). Verificar siempre que `sidebar.tsx` y `mobile-nav.tsx` estén sincronizados.
- **ACTUALIZADO (sesión 27+)**: Sidebar centralizado en `src/components/layout/nav-items.tsx` — array `NAV_ITEMS` + `FOOTER_ITEMS`. Ver convención de navegación actualizada.

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
- **Sidebar limpiado**: eliminados "Agenda" y "Tutorías" del nav. "Inicio" renombrado a "Panel". Cambio replicado en `sidebar.tsx` y `mobile-nav.tsx`.

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
