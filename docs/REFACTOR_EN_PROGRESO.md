# Refactor en progreso — gestor-universitario-next

> Archivo de seguimiento. Leer ANTES de diagnosticar errores inesperados.
> Generado: 2026-05-22 | Basado en: `docs/AUDITORIA_DUPLICADOS.md`

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

## Cambios pendientes (próximas fases)

Ver `docs/AUDITORIA_DUPLICADOS.md §4` para lista completa.

| # | Acción | Archivos afectados | Complejidad |
|---|---|---|---|
| 10 | Extraer `<AsistenciaGrid>` compartido | `pase-lista-client.tsx`, `PasarListaModal.tsx`, `modo-clase-client.tsx` | Alta (nuevo componente) |
| 11 | Unificar slot-machines en `Ruleta.tsx` | `modo-clase-client.tsx`, `Ruleta.tsx` | Media (cambio de API) |
| 12 | Extraer `<CollapsiblePanel storageKey>` | `SummaryPanel`, `TodayPanel`, `AgendaSection`, `TutoriasPendientesPanel` | Media |

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
