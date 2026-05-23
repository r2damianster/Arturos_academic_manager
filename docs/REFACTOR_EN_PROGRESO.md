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

## Cambios pendientes (próximas fases)

Ver `docs/AUDITORIA_DUPLICADOS.md §4` para lista completa. Los más cercanos:

| # | Acción | Archivos afectados |
|---|---|---|
| 5 | Unificar `crearGrupos` + `crearGruposConIntegrantes` | `grupos.ts` |
| 6 | Unificar `asignarEstudianteAGrupo` + `moverEstudiante` | `grupos.ts` |
| 7 | Unificar `finalizarClase` + `confirmarCumplido` | `bitacora.ts` |
| 8 | Hacer privadas `copiarPlanificacion`, `moverPlanificacion`, `fusionarPlanificacion` | `bitacora.ts` |
| 9 | Extraer `<AsistenciaGrid>` compartido | `pase-lista-client.tsx`, `PasarListaModal.tsx`, `modo-clase-client.tsx` |
| 10 | Unificar 3 slot-machines en `Ruleta.tsx` | `modo-clase-client.tsx` |

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
