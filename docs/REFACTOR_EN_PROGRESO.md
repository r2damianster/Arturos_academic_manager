# Refactor en progreso — gestor-universitario-next

> Archivo de seguimiento. Leer ANTES de diagnosticar errores inesperados.
> Generado: 2026-05-22 | Basado en: `docs/AUDITORIA_DUPLICADOS.md`

---

## Guía de verificación en producción

Hacer después de cada deploy que incluya cambios de este refactor.
Orden: del más crítico al más visual. Tiempo estimado: ~10 min.

### ✅ 1. Nav — sidebar y móvil sincronizados (Fase 1 — #3)

**Desktop:**
- Expandir sidebar hover → ver 5 ítems: Panel · Clases · Tutorías · Mis Cursos · Herramientas
- Footer del sidebar → Administración
- Clic en cada ítem → URL correcta + ítem activo resaltado

**Móvil:**
- Abrir menú hamburguesa → ver 6 ítems: los 5 anteriores + Administración al final
- Clic en cualquier ítem → cierra el drawer + navega

**Falla si:** un ítem falta en desktop pero aparece en móvil (o viceversa) → import de `nav-items.tsx` roto en uno de los dos.

---

### ✅ 2. Redirect /calificaciones/config (Fase 1 — #4)

- Ir a `/dashboard/cursos/[cualquier-cursoId]/calificaciones/config`
- **Esperado:** redirect instantáneo a `/dashboard/cursos/[cursoId]/editar?tab=evaluacion` con el tab Evaluación activo
- **Falla si:** redirect loop, 404, o aterriza en tab incorrecto

---

### ✅ 3. Crear grupos con integrantes (Fase 2 — #5)

- Entrar a modo clase (`/dashboard/modo-clase/[bitacoraId]`)
- Tab Grupos → "Crear grupos"
- Tab **Aleatoria**: Generar → "Guardar grupos" → los grupos aparecen con estudiantes asignados
- Tab **Manual**: Arrastrar estudiantes a grupos → "Guardar grupos" → ídem
- Tab **Por afinidad**: "Crear grupos de afinidad" → grupos creados vacíos (sin integrantes)

**Falla si:** grupos se guardan sin integrantes en Aleatoria/Manual → `estudianteIds` no se pasa en la llamada.

---

### ✅ 4. Finalizar clase (Fase 2 — #7)

- Iniciar una clase (`/dashboard/modo-clase/[bitacoraId]`)
- Registrar asistencia de al menos 1 estudiante
- Clic "Finalizar clase" → confirmar

**Verificar:**
- La clase aparece como **Cumplida** en `/dashboard/planificacion`
- La celda del día muestra "Ver resumen" (no "Iniciar clase")
- `ClaseEnProgresoBar` desaparece del header

**Ruta alternativa:** la barra de progreso (`ClaseEnProgresoBar` en el header) → botón "Finalizar" → mismo resultado.

**Falla si:** clase queda en estado "en progreso" o no actualiza la vista de planificación.

---

### ✅ 5. Emails (Fase 3 — #9)

> Requiere `RESEND_API_KEY` y `RESEND_FROM_EMAIL` configurados en Vercel.

**Email de citación:**
- Ir a un curso → Ficha de estudiante (drawer) → "Citar a tutoría" → elegir razón → Guardar
- En `/dashboard/tutorias` tab Citaciones → aparece la citación
- Clic "Enviar email" → el estudiante recibe email con materia, motivo y fecha

**Email de tutoría directa:**
- `/dashboard/tutorias` → tab Horarios → horario activo → "Asignar directamente" → completar datos con email válido
- El estudiante recibe email con fecha y horario confirmados

**Falla silenciosa en tutorias.ts:** el email es non-blocking (try/catch), la reserva se crea igual pero el email no llega → revisar `RESEND_API_KEY` en Vercel.
**Falla explícita en citaciones.ts:** retorna `{ error: 'Email no configurado' }` → aparece toast de error en el UI.

---

### ✅ 6. Paneles colapsables con memoria (Fase 4 — #10)

- En `/dashboard` (Panel principal):
  - Colapsar **Resumen** (clic en el botón) → recargar página → sigue colapsado
  - Colapsar **Panel de hoy** → recargar → sigue colapsado
  - Colapsar **Agenda semanal** → recargar → sigue colapsada
- Expandir cada uno → recargar → siguen abiertos

**Falla si:** los paneles siempre abren en su estado por defecto (Resumen cerrado, Hoy/Agenda abiertos) ignorando la preferencia guardada → `useCollapsible` no lee `localStorage` o el import está roto.

---

### ⚠️ Regresiones a vigilar

Cualquier cambio en estas áreas puede indicar un efecto secundario del refactor:

| Área | Qué observar |
|---|---|
| Modo clase — grupos | Grupos guardados sin integrantes (ver #3) |
| Planificación — DnD "Combinar" | `fusionarPlanificacion` es privada; solo accesible via `gestionarDragPlanificacion` |
| Planificación — Copiar/Mover desde modal | `PlanificarModal` llama directamente `copiarPlanificacion`/`moverPlanificacion` (siguen exportadas) |
| Nav móvil vs desktop | Diferencia en ítems visibles (ver #1) |
| Emails | No llegan tras citar o asignar tutoría directa (ver #5) |

---

## Cambios aplicados

### [2026-05-22] Fase 1 — Acciones inmediatas

#### 1. `crearCursoAction` eliminada (`src/lib/actions/cursos.ts`)
- **Qué era:** función legacy (insert curso completo + horarios + redirect) sin callers activos.
- **Estado:** eliminada. Usar `crearCursoBase` para wizard o `actualizarCurso` para edición.
- **Riesgo si falla:** error `crearCursoAction is not a function` — significa que quedó un caller no detectado.

#### 2. `eliminarEstudiante` eliminada (`src/lib/actions/estudiantes.ts`)
- **Qué era:** wrapper de 1 línea → `setEstadoEstudiante(id, 'retirado', cursoId)` sin callers activos.
- **Estado:** eliminada. Usar `setEstadoEstudiante(id, 'retirado', cursoId)` directamente.
- **Riesgo si falla:** error `eliminarEstudiante is not a function`.

#### 3. NAV_ITEMS extraído a fuente única (`src/components/layout/nav-items.tsx`)
- **Qué cambió:** sidebar y mobile-nav tenían sus propios arrays `navItems` independientes (causa de drift).
- **Estado:** nuevo archivo `nav-items.tsx` con `NAV_ITEMS` (5 ítems) y `FOOTER_ITEMS` (Administración).
  - `sidebar.tsx` → importa `NAV_ITEMS` + `FOOTER_ITEMS` desde `nav-items.tsx`.
  - `mobile-nav.tsx` → importa `[...NAV_ITEMS, ...FOOTER_ITEMS]` desde `nav-items.tsx`.
- **Riesgo si falla:** nav no renderiza ítems → verificar que el import path `./nav-items` resuelve correctamente. El archivo es `.tsx` (no `.ts`) porque contiene JSX.
- **Si necesitas agregar un ítem al nav:** editar solo `nav-items.tsx`. Aplica automáticamente a desktop y móvil.

#### 4. `/calificaciones/config` convertida a redirect
- **Qué era:** página completa con form de `num_parciales` y `nombres_tareas` — duplicado de `/editar?tab=evaluacion`.
- **Estado:** ahora hace `redirect(/editar?tab=evaluacion)`. La página original tenía num_parciales solo con opciones 2/3/4 (no incluía 1). La tab Evaluación de editar sí incluye 1.
- **Riesgo si falla:** redirect loop si `/editar?tab=evaluacion` no existe — verificar que `editar-client.tsx` tiene `tab=evaluacion` definido.

---

---

### [2026-05-22] Fase 2 — Unificación de funciones duplicadas

#### 5. `crearGruposConIntegrantes` eliminada → `crearGrupos` unificada (`src/lib/actions/grupos.ts`)
- **Qué era:** dos funciones casi idénticas para crear grupos con y sin integrantes.
- **Estado:** `crearGrupos` ahora acepta `estudianteIds?: string[]` por grupo. Si vacío → grupos vacíos (modo afinidad). `crearGruposConIntegrantes` eliminada.
- **Callers actualizados:** `Agrupacion.tsx` (2 calls en tabs Aleatoria y Manual).
- **Riesgo si falla:** error `crearGruposConIntegrantes is not exported` — significa que quedó un caller no actualizado. Los grupos no se crean con integrantes si `estudianteIds` está undefined (comportamiento regresivo).

#### 6. `asignarEstudianteAGrupo` eliminada (`src/lib/actions/grupos.ts`)
- **Qué era:** 0 callers externos — función sin usar.
- **Estado:** eliminada. Usar `moverEstudiante(estudianteId, grupoIdDestino, bitacoraId)` si se necesita mover un estudiante entre grupos.
- **Riesgo si falla:** error `asignarEstudianteAGrupo is not exported`.

#### 7. `finalizarClase` eliminada → `confirmarCumplido` canónica (`src/lib/actions/bitacora.ts`)
- **Qué era:** dos funciones que seteaban estado=`cumplido`. `finalizarClase` solo aceptaba `observaciones?: string`. `confirmarCumplido` acepta `Partial<PlanificacionData>` (tema, actividades_json, observaciones).
- **Estado:** `finalizarClase` eliminada. `confirmarCumplido` ahora también revalida `/dashboard/modo-clase`.
- **Callers actualizados:** `modo-clase-client.tsx` (line 769), `ClaseEnProgresoBar.tsx` (line 49).
- **Riesgo si falla:** `finalizarClase is not exported` — caller no actualizado. Botón "Finalizar clase" no funciona.
- **Diferencia de API:** `finalizarClase(bitacoraId, observaciones?)` → `confirmarCumplido(bitacoraId, { observaciones }?)` — si alguien pasa observaciones, ajustar la llamada.

---

---

### [2026-05-22] Fase 3 — Email helper + fusionarPlanificacion privada

#### 8. `fusionarPlanificacion` convertida a función privada (`src/lib/actions/bitacora.ts`)
- **Qué era:** export público sin callers externos. Solo usada internamente por `gestionarDragPlanificacion`.
- **Estado:** removido `export`, función sigue siendo accesible dentro de `bitacora.ts`.
- **`copiarPlanificacion` y `moverPlanificacion` permanecen exportadas** — `PlanificarModal.tsx` las usa legítimamente para Copiar/Mover no-DnD.
- **Riesgo si falla:** error `fusionarPlanificacion is not exported` — si alguien la usaba externamente.

#### 9. `src/lib/email.ts` — helper Resend centralizado
- **Qué era:** dos bloques `fetch('https://api.resend.com/emails', {...})` idénticos en `citaciones.ts` y `tutorias.ts`.
- **Estado:** nuevo `enviarEmail({ to, subject, html })` en `src/lib/email.ts`. Ambas acciones lo importan.
- **Callers actualizados:** `citaciones.ts` (`enviarEmailCitacion`), `tutorias.ts` (`asignarTutoriaDirecta`).
- **Riesgo si falla:** emails no se envían. La función retorna `{ error: 'Email no configurado' }` si falta `RESEND_API_KEY`. En `tutorias.ts` el error es silencioso (try/catch).
- **Comportamiento conservado:** `tutorias.ts` sigue siendo non-blocking (try/catch). `citaciones.ts` retorna el error al caller.

---

---

### [2026-05-22] Fase 4 — useCollapsible hook + email helper

#### 10. `useCollapsible` hook extraído (`src/lib/hooks/use-collapsible.ts`)
- **Qué era:** 9 líneas idénticas de boilerplate (`useState` + `useEffect` localStorage + `toggle`) repetidas en 3 paneles.
- **Estado:** hook `useCollapsible(storageKey, defaultOpen)` creado. Usado en `SummaryPanel` (`false`), `TodayPanel` (`true`), `AgendaSection` (`true`).
- **`TutoriasPendientesPanel`:** no tenía collapse — no afectado.
- **Riesgo si falla:** paneles no recuerdan estado → siempre abren en el valor `defaultOpen`. Verificar que el import `@/lib/hooks/use-collapsible` resuelve correctamente.

---

## Cambios pendientes

Ver `docs/AUDITORIA_DUPLICADOS.md §4` para detalles.

| # | Acción | Complejidad |
|---|---|---|
| Extraer `<AsistenciaGrid>` | Nuevo componente compartido para 3 superficies de asistencia | Alta |
| Unificar slot-machines | Extender `Ruleta.tsx` API + reemplazar RuletaGrupos/sortearExpositor inline | Media |

---

## Guía de correlación de errores

Si ves un error inesperado, verificar si está en esta tabla:

| Error / síntoma | Causa probable del refactor | Solución |
|---|---|---|
| `crearCursoAction is not exported` | Fue eliminada (cambio #1) | Usar `crearCursoBase` |
| `eliminarEstudiante is not exported` | Fue eliminada (cambio #2) | Usar `setEstadoEstudiante(id, 'retirado', cursoId)` |
| Nav desktop no muestra ítems | `nav-items.tsx` no resuelve — path incorrecto o error JSX en `.tsx` | Verificar import en `sidebar.tsx` |
| Nav móvil no muestra ítems | Mismo origen que el anterior | Verificar import en `mobile-nav.tsx` |
| Nav desktop e móvil muestran ítems diferentes | Imposible ahora — ambos usan el mismo `NAV_ITEMS` | Si pasa, el import falló en uno y usa fallback |
| `/calificaciones/config` redirige a lugar incorrecto | Redirect hardcoded a `/editar?tab=evaluacion` | Verificar que tab evaluacion existe en editar-client.tsx |
| Redirect loop en `/calificaciones/config` | Tab evaluacion no reconocida en editar | Verificar `editar-client.tsx` acepta `tab=evaluacion` |
| `crearGruposConIntegrantes is not exported` | Fase 2: función eliminada | Usar `crearGrupos(..., [{..., estudianteIds:[]}], ...)` |
| Grupos creados sin integrantes cuando deberían tenerlos | `estudianteIds` no se pasa en la call | Verificar que el array `estudianteIds` no está undefined en el caller |
| `asignarEstudianteAGrupo is not exported` | Fase 2: función eliminada (0 callers) | Usar `moverEstudiante(estudianteId, grupoId, bitacoraId)` |
| `finalizarClase is not exported` | Fase 2: función eliminada | Usar `confirmarCumplido(bitacoraId)` |
| Botón "Finalizar clase" no funciona / no marca cumplido | Caller aún usa `finalizarClase` | Buscar `finalizarClase` en src/ y migrar a `confirmarCumplido` |
