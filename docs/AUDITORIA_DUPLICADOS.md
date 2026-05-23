# Auditoría de funciones duplicadas — gestor-universitario-next

**Fecha:** 2026-05-22  
**Alcance:** `src/lib/actions/` · `src/app/` · `src/components/`  
**Inventario aproximado:** ~90 actions · ~40 rutas · ~55 componentes

---

## Convenciones de veredicto

| Emoji | Etiqueta | Significado |
|---|---|---|
| 🔴 | **UNIFICAR** | Duplicación real sin justificación. Candidato a colapsar en una sola función/componente. |
| 🟡 | **REFACTOR** | Solape parcial. Extraer helper o subcomponente compartido; mantener los entry points actuales hasta migrar callers. |
| 🟢 | **MANTENER** | Diferencia justificada: distinto rol, distinta UX, distinto ciclo de vida o distinto scope de datos. |
| ⚪ | **LEGACY** | Código obsoleto sin callers reales o redirect de un sola línea. Candidato a eliminar. |

---

## Índice

1. [Server Actions](#1-server-actions)
   - [1.1 Inventario por archivo](#11-inventario-por-archivo)
   - [1.2 Clusters de duplicación](#12-clusters-de-duplicación)
   - [1.3 Resumen numérico](#13-resumen-numérico)
2. [Rutas y Páginas](#2-rutas-y-páginas)
   - [2.1 Inventario completo](#21-inventario-completo)
   - [2.2 Clusters de solapamiento](#22-clusters-de-solapamiento)
3. [Componentes UI](#3-componentes-ui)
   - [3.1 Inventario por carpeta](#31-inventario-por-carpeta)
   - [3.2 Clusters de duplicación](#32-clusters-de-duplicación)
4. [Resumen ejecutivo](#4-resumen-ejecutivo)

---

## 1. Server Actions

### 1.1 Inventario por archivo

#### `actividades.ts`

| Función | Propósito | Callers conocidos |
|---|---|---|
| `crearActividad(input)` | Insert en `actividades_inbox` | `QuickAddModal`, `EditarActividadPanel` |
| `actualizarActividad(id, patch)` | Update genérico — base interna | Wrappers abajo |
| `eliminarActividad(id)` | Delete por id | `ActividadCard`, `FloatingNotesPanel` |
| `togglePin(id, currentValue)` | Wrapper → `actualizarActividad` | `ActividadCard`, `MiniNotaCard` |
| `setColor(id, color)` | Wrapper → `actualizarActividad` | `ColorPicker` |
| `toggleArchivada(id, currentValue)` | Wrapper → `actualizarActividad` | `ActividadCard` |
| `marcarCompletada(id)` | Wrapper → `actualizarActividad` | `ActividadCard` |
| `desmarcarCompletada(id)` | Wrapper → `actualizarActividad` | `ActividadCard` |
| `addChecklistItem(id, texto)` | Insert item en `checklist_items` JSONB | `ChecklistEditor` |
| `toggleChecklistItem(id, itemId)` | Toggle completado del item | `ChecklistEditor` |
| `removeChecklistItem(id, itemId)` | Remove item del array JSONB | `ChecklistEditor` |
| `saveChecklistItems(id, items)` | Replace-all del array — wrapper | `ChecklistEditor` |
| `getActividades(filtros)` | Lectura con filtros compuestos | `actividades-client.tsx` |
| `getCounts()` | Conteos por tipo/estado | `actividades-client.tsx` |
| `getActividadesParaHoy()` | Filtro por fecha=hoy y pendientes | `TodayPanel` (probablemente) |
| `getUltimasNotas(n=8)` | Últimas N notas sin archivar | `FloatingNotesPanel` |
| `convertirAEvento(id, opts)` | Lee actividad → insert evento | `ConvertirEventoModal` |
| `convertirVariasAEvento(ids[], opts)` | Insert evento + flag conversión en array | `FloatingNotesPanel` |

#### `admin.ts`

| Función | Propósito |
|---|---|
| `cambiarRolProfesor(profesorId, nuevoRol)` | Update rol; requiere auth.uid() como admin |

#### `asistencia.ts`

| Función | Propósito |
|---|---|
| `registrarAsistenciaMasiva(cursoId, fecha, registros[], bitacoraId?)` | Upsert asistencia + participación + observaciones_trabajo en batch |
| `registrarParticipacion(cursoId, fecha, datos[])` | Upsert solo en tabla `participacion` (nivel + observacion) |

#### `bitacora.ts`

| Función | Propósito |
|---|---|
| `guardarBitacoraData(cursoId, data)` | Upsert `bitacora_clase` por objeto — base canónica |
| `guardarBitacora(cursoId, formData)` | Upsert desde FormData + `redirect()` — legacy |
| `guardarPlanificacion(cursoId, fecha, data)` | Upsert con `actividades_json` + estado=`planificado` |
| `confirmarCumplido(bitacoraId, data?)` | Marca estado=`cumplido`; acepta data parcial (tema, actividades, obs) |
| `finalizarClase(bitacoraId, obs?)` | Marca estado=`cumplido` + solo observaciones; revalida `/dashboard/modo-clase` |
| `iniciarClase(bitacoraId)` | Set `hora_inicio_real` en BD |
| `detenerClase(bitacoraId)` | Limpia `hora_inicio_real` → clase vuelve a planificado |
| `actualizarActividadesEnVivo(bitacoraId, json)` | Escribe `actividades_json` sin revalidate (en vivo) |
| `replanificarClase({cursoId, origenFecha, destinoFecha, modo})` | Merge o shift en cascada dentro del mismo curso |
| `copiarPlanificacion({source, dest})` | Copia plan a otro curso/fecha (usa `guardarPlanificacion` internamente) |
| `moverPlanificacion(...)` | `copiarPlanificacion` + delete origen |
| `fusionarPlanificacion({source, dest, deleteSource})` | Concatena actividades dst+src; `deleteSource` opcional |
| `gestionarDragPlanificacion(sourceId, targetCursoId, targetFecha, accion, colision, payload)` | Dispatcher DnD: orquesta los helpers de mover/copiar/fusionar/cascada |
| `eliminarPlanificacion({cursoId, fecha})` | Delete `bitacora_clase`; permite borrar cumplidas |
| `trasladarActividades(sourceId, indices[], targetId, mode)` | Mueve/copia ítems específicos entre dos planes |
| `getClasesFuturas(bitacoraId)` | Lectura de clases futuras del mismo curso |

#### `calificaciones.ts`

| Función | Propósito |
|---|---|
| `upsertCalificaciones(cursoId, estudianteId, data)` | Upsert fila de calificaciones de un estudiante |

#### `citaciones.ts`

| Función | Propósito |
|---|---|
| `citarEstudiante(input)` | Insert en `citaciones_tutoria` + flag `estudiantes.tutoria` |
| `actualizarEstadoCitacion(citacionId, nuevoEstado, cursoId)` | Update estado + limpia flag tutoria si corresponde |
| `obtenerCitacionesPendientesEstudiante()` | Lecturas: citaciones pendientes del estudiante autenticado |
| `getCitacionesPorCurso(cursoId, mes?)` | Lecturas: citaciones del curso filtradas por mes |
| `enviarEmailCitacion(citacionId)` | Email via Resend al estudiante |
| `agendarCitacion({citacionId, cursoId, horarioId, fecha, estudianteId})` | Crea reserva confirmada + marca citación `agendada` |

#### `cursos.ts`

| Función | Propósito | Callers |
|---|---|---|
| `crearCursoBase(formData)` | Insert mínimo para wizard; retorna `cursoId` | Nuevo curso — paso 1 |
| `crearCursoAction(formData)` | Insert legacy full + horarios + `redirect()` | **0 callers en src/** ← ⚪ |
| `actualizarCurso(cursoId, formData)` | Update parcial canónico (todos los tabs de editar) | `editar-client.tsx`, `config/page.tsx` |
| `limpiarNotasParciales(cursoId, desde, hasta)` | Nulea columnas acd/ta/pe/ex por rango de parciales | Tab Evaluación en editar |
| `actualizarHorariosCurso(cursoId, horarios[])` | Replace-all de `horarios_clases` | `HorariosEditor` |
| `eliminarCurso(cursoId)` | Delete + `redirect()` | Tab Zona peligrosa |

#### `encuesta-actions.ts`

| Función | Propósito |
|---|---|
| `clearProblemas(authUserId, cursoId)` | RPC SECURITY DEFINER `clear_problemas_estudiante` |
| `saveNotaIncidencia(estudianteId, nota, cursoId)` | Update `estudiantes.nota_incidencia` |

#### `estudiantes.ts`

| Función | Propósito | Callers |
|---|---|---|
| `setTutoria(estudianteId, activar)` | Flip flag `tutoria` en tabla estudiantes | `tutoria-toggle.tsx` |
| `importarEstudiantesMasivo(cursoId, lista[], passwordInicial?)` | Import masivo + cuentas auth via admin | `importar-form.tsx` |
| `setEstadoEstudiante(estudianteId, estado, cursoId)` | Set activo/retirado | `estado-estudiante-button.tsx` |
| `eliminarEstudiante(estudianteId, cursoId)` | Wrapper → `setEstadoEstudiante('retirado')` | **0 callers en src/** ← ⚪ |

#### `eventos.ts`

| Función | Propósito |
|---|---|
| `crearEvento(data)` | Insert en `eventos_profesor` |
| `actualizarEvento(id, data)` | Update evento |
| `eliminarEvento(id)` | Delete evento |

#### `ficha-estudiante.ts`

| Función | Propósito |
|---|---|
| `getFichaEstudiante(estudianteId, cursoId, bitacoraId?)` | Agrega encuesta + asistencia + participación + trabajos + citaciones + grupoActual |

#### `generar-contenido.ts`

| Función | Propósito |
|---|---|
| `generarHtmlSemanal({bitacoraIds, asignatura, semanaNum, instruccionAdicional?})` | Groq → HTML estilo Moodle LMS |
| `generarGuiaSemanal({bitacoraIds, asignatura, semanaNum, nivel, ..., logroDescripcion?})` | Groq → texto plano con rúbrica y logros |
| `mejorarContenido({tipo, contenidoActual, solicitud})` | Chat de refinamiento: reusa Groq según `tipo` |

#### `grupos.ts`

| Función | Propósito |
|---|---|
| `crearGrupos(bitacoraId\|null, grupos[], tipo, categoria, cursoId)` | Crea grupos vacíos en BD |
| `crearGruposConIntegrantes(bitacoraId\|null, grupos[con estudianteIds], tipo, categoria, cursoId)` | Crea grupos + asigna integrantes en un paso |
| `asignarEstudianteAGrupo(grupoId, estudianteId)` | Mueve estudiante al grupo (deriva bitacoraId del grupo) |
| `moverEstudiante(estudianteId, grupoIdDestino, bitacoraId)` | Mueve estudiante; requiere bitacoraId explícito |
| `publicarAfinidad(bitacoraId)` | Abre grupos para que estudiantes se unan |
| `cerrarAfinidad(bitacoraId)` | Cierra grupos de afinidad |
| `unirseAGrupo(grupoId)` | Perspectiva estudiante — valida cupo máximo |
| `salirDeGrupo(grupoId)` | Perspectiva estudiante |
| `guardarParticipacion(bitacoraId, notas[])` | Upsert en `grupo_participacion` (tabla auxiliar) |
| `getGruposAbiertosParaEstudiante(cursoIds[])` | Lectura: grupos abiertos de tipo afinidad del estudiante |
| `getGruposDeSesion(bitacoraId, cursoId?)` | Lectura: grupos de una sesión |
| `getCategorias()` | Lectura: categorías predefinidas |
| `getUltimaSesionConGrupos(cursoId, excludeBitacoraId)` | Lectura: sesión anterior con grupos para plantilla |
| `copiarGruposASesion(grupos, bitacoraId, cursoId)` | Copia grupos+integrantes a la sesión actual |
| `getPlantillasGrupos()` | Lectura: grupos marcados como plantilla |
| `guardarComoPlantilla(nombre, bitacoraId, cursoId)` | Marca grupos de la sesión como `es_plantilla=true` |

#### `logros.ts`

| Función | Propósito |
|---|---|
| `getLogros(cursoId)` | Lectura ordenada de logros del curso |
| `addLogro(cursoId, descripcion)` | Insert con orden al final |
| `updateLogro(id, descripcion)` | Update texto |
| `deleteLogro(id)` | Delete |
| `reorderLogros(cursoId, orderedIds[])` | Batch update de campo `orden` |

#### `trabajos.ts`

| Función | Propósito |
|---|---|
| `asignarTrabajo(cursoId, estudianteId, formData)` | Insert trabajo individual desde FormData |
| `asignarTrabajoMasivo(cursoId, estudianteIds[], data)` | Insert N trabajos en batch (objeto) |
| `actualizarEstadoTrabajo(trabajoId, estudianteId, estado, cursoId?)` | Atajo para cambiar solo el estado |
| `agregarObservacionTrabajo(trabajoId, estudianteId, observacion, cursoId?)` | Append observación |
| `actualizarTrabajo(trabajoId, cursoId, data)` | Update completo del trabajo |
| `eliminarTrabajo(trabajoId, cursoId)` | Delete |

#### `tutorias.ts`

| Función | Propósito |
|---|---|
| `activarHorario(horarioId, duracion)` | Activa slot semanal en tabla `horarios` |
| `desactivarHorario(horarioId)` | Desactiva slot |
| `limpiarHorariosVencidos()` | Expira reservas/slots; acumula `tutor_horas_semana` |
| `asignarTutoriaDirecta({horarioId, fecha, authUserId, estudianteNombre, ...})` | Crea reserva confirmada + envía email Resend |
| `anunciarAsistenciaTutoria({horarioClaseId, estudianteId, fecha})` | Estudiante anuncia asistencia a clase de tutoría |
| `cancelarAnuncioTutoria(...)` | Cancela anuncio anterior |
| `eliminarReserva(reservaId)` | Delete reserva |
| `marcarAsistenciaReserva(reservaId, asistio)` | Marca asistió/no-asistió manualmente |
| `registrarTutoriaManual({estudianteNombre, cursoId, fecha, ...})` | Reserva sin slot (`horario_id=null`, `origen='manual'`) |
| `getHistorialTutorias()` | Agrega reservas + cursos + citaciones para historial |

---

### 1.2 Clusters de duplicación

---

#### Cluster A — Guardar bitácora (3 funciones, mismo destino) 🔴 / 🟡

Todas escriben la tabla `bitacora_clase` para la misma `(curso_id, fecha)`.

| Función | Entrada | Diferencia clave | Veredicto |
|---|---|---|---|
| `guardarBitacoraData` | objeto | Upsert puro, sin redirect | 🟢 Base canónica — mantener |
| `guardarBitacora` | FormData | Hace lo mismo + `redirect()` | 🔴 UNIFICAR — 0 callers directos visibles; migrar a wrapper delgado de `guardarBitacoraData` |
| `guardarPlanificacion` | objeto | Escribe `actividades_json` + fuerza estado=`planificado` | 🟡 REFACTOR — puede invocar `guardarBitacoraData` internamente; solo agrega el campo `actividades_json` y el estado |

**Riesgo:** tres rutas distintas escriben el mismo row; si una omite un campo, silenciosamente lo sobreescribe.  
**Recomendación:** colapsar en `guardarBitacoraData` con campos opcionales (`actividades_json?`, `estado?`). `guardarBitacora` y `guardarPlanificacion` se convierten en adapters de 5 líneas.

---

#### Cluster B — Mover / copiar / fusionar plan (4 caminos + dispatcher) 🟡

| Función | Caso de uso real |
|---|---|
| `replanificarClase` | Mismo curso — merge o shift cascada |
| `copiarPlanificacion` | Otro curso o fecha — sin borrar origen |
| `moverPlanificacion` | Wrapper de `copiarPlanificacion` + delete origen |
| `fusionarPlanificacion` | Concatena actividades de dos planes; `deleteSource` opcional |
| `gestionarDragPlanificacion` | **Dispatcher DnD** — orquesta los anteriores según `accion` + `colision` |

**Veredicto:** `gestionarDragPlanificacion` es el único entry point público justificado. Las otras cuatro son helpers internos que ya se usan a través del dispatcher.  
**Problema:** `copiarPlanificacion`, `moverPlanificacion` y `fusionarPlanificacion` siguen siendo **exports públicos** y algunos componentes no-DnD los llaman directamente (ej. drag en `PlanificacionExtensiva`), creando dos caminos divergentes al mismo resultado.  
**Recomendación 🟡:** marcar los tres helpers como `function` (no `export`) dentro de `bitacora.ts`. Callers externos que los usen directamente deben migrar a `gestionarDragPlanificacion`.

---

#### Cluster C — Finalizar clase / confirmar cumplido 🔴

| Función | Qué hace | Diferencia |
|---|---|---|
| `finalizarClase(bitacoraId, obs?)` | Estado=`cumplido` + observaciones + revalida `/dashboard/modo-clase` | Revalidate path distinto |
| `confirmarCumplido(bitacoraId, data?)` | Estado=`cumplido` + tema + actividades + obs (data parcial) | Más expresiva, admite más campos |

Ambas setean `estado='cumplido'` en `bitacora_clase`. La única diferencia justificada es el `revalidatePath`.  
**Recomendación 🔴:** colapsar en `confirmarCumplido` añadiéndole el `revalidatePath` correcto por contexto. `finalizarClase` queda como wrapper de 3 líneas o se elimina.

---

#### Cluster D — Crear grupos (2 versiones casi idénticas) 🔴

| Función | Diferencia |
|---|---|
| `crearGrupos(bitacoraId, grupos[], tipo, categoria, cursoId)` | Crea grupos vacíos; no hay integrantes |
| `crearGruposConIntegrantes(bitacoraId, grupos[con estudianteIds[]], tipo, categoria, cursoId)` | Misma firma + `estudianteIds[]` por grupo |

La segunda función reimplementa todo lo de la primera y agrega un loop de insert en `grupo_integrantes`.  
**Recomendación 🔴:** un único `crearGrupos(..., grupos[{nombre, color, estudianteIds?}][])`. Si `estudianteIds` está vacío → grupo vacío (modo afinidad). Eliminar `crearGruposConIntegrantes`.

---

#### Cluster E — Mover estudiante entre grupos (clones lado profesor) 🔴

| Función | Diferencia |
|---|---|
| `asignarEstudianteAGrupo(grupoId, estudianteId)` | Deriva `bitacoraId` desde el `grupoId` internamente |
| `moverEstudiante(estudianteId, grupoIdDestino, bitacoraId)` | Recibe `bitacoraId` explícito |

Ambas hacen: buscar grupo actual del estudiante en la sesión → delete de `grupo_integrantes` → insert en nuevo grupo.  
**Recomendación 🔴:** colapsar en `moverEstudiante`. `asignarEstudianteAGrupo` se convierte en wrapper que deriva `bitacoraId` y llama a `moverEstudiante`, o se elimina directamente si sus callers son los mismos que los de `moverEstudiante`.

---

#### Cluster F — Insertar reserva confirmada de tutoría (2 caminos) 🟡

| Función | Archivo | Diferencia |
|---|---|---|
| `agendarCitacion({citacionId, cursoId, horarioId, fecha, estudianteId})` | `citaciones.ts` | Inserta reserva + marca citación como `agendada`; no envía email |
| `asignarTutoriaDirecta({horarioId, fecha, authUserId, estudianteNombre, ...})` | `tutorias.ts` | Inserta reserva + envía email Resend; sin citación asociada |

Las diferencias son justificadas: uno viene de citación previa (ya hay email enviado antes), el otro es una asignación directa del profesor.  
**Recomendación 🟡:** extraer `_insertarReservaConfirmada({horarioId, fecha, estudianteId, profesorId, modalidad?})` como helper privado compartido. Elimina el insert duplicado de `reservas` en las dos funciones.

---

#### Cluster G — Convertir actividad a evento (singular / plural) 🟡

| Función | Diferencia |
|---|---|
| `convertirAEvento(id, opts)` | Lee título/descripción de la actividad; crea 1 evento; actualiza 1 fila |
| `convertirVariasAEvento(ids[], opts)` | Toma título explícito; crea 1 evento; actualiza N filas; insert evento no pasa por `crearEvento` |

Ambas duplican el insert en `eventos_profesor`. Ninguna reutiliza `crearEvento`.  
**Recomendación 🟡:** colapsar en `convertirVariasAEvento(ids[], opts)`. La versión singular pasa array de 1. Internamente llamar a `crearEvento` para el insert.

---

#### Cluster H — Crear curso: wizard vs legacy 🔴 ⚪

| Función | Estado |
|---|---|
| `crearCursoBase(formData)` | Activo — usado por el wizard de 4 pasos |
| `crearCursoAction(formData)` | **0 callers en `src/`** — código muerto |

**Recomendación ⚪:** borrar `crearCursoAction`. Verificar primero con búsqueda en `app/` y `components/` (ya verificado: 0 matches).

---

#### Cluster I — Estado de estudiante: wrapper sin callers 🔴 ⚪

| Función | Estado |
|---|---|
| `setEstadoEstudiante(estudianteId, estado, cursoId)` | Activo — usado por `estado-estudiante-button.tsx` |
| `eliminarEstudiante(estudianteId, cursoId)` | **0 callers en `src/`** — wrapper que llama `setEstadoEstudiante('retirado')` |

**Recomendación ⚪:** borrar `eliminarEstudiante`. Si se necesita, los callers usan `setEstadoEstudiante(id, 'retirado', cursoId)` directamente.

---

#### Cluster J — Flag `estudiantes.tutoria` escrito desde 3 archivos 🟡

| Lugar | Cómo escribe el flag |
|---|---|
| `setTutoria` (`estudiantes.ts`) | Vía única oficial; toggle explícito |
| `citarEstudiante` (`citaciones.ts`) | Set `tutoria=true` inline dentro de la citación |
| `actualizarEstadoCitacion` (`citaciones.ts`) | Limpia `tutoria=false` condicionalmente |

Tres archivos distintos escriben el mismo campo. Si la lógica del flag cambia, hay 3 lugares que actualizar.  
**Recomendación 🟡:** que `citarEstudiante` y `actualizarEstadoCitacion` llamen a `setTutoria` en lugar de escribir el campo directamente.

---

#### Cluster K — Email Resend duplicado (2 implementaciones inline) 🟡

| Lugar | Template | Desencadenante |
|---|---|---|
| `enviarEmailCitacion` (`citaciones.ts`) | Email de citación a tutoría | Profesor cita a estudiante |
| Inline en `asignarTutoriaDirecta` (`tutorias.ts`) | Email de confirmación de reserva | Profesor asigna tutoría directa |

Dos `fetch('https://api.resend.com/emails')` con plantillas HTML distintas, sin módulo compartido.  
**Recomendación 🟡:** crear `src/lib/email.ts` con `enviarEmail({template: string, to: string, subject: string, html: string})`. Ambas funciones convergen en ese helper. Los templates HTML siguen siendo distintos — eso es correcto.

---

#### Cluster L — Generador IA (Groq): 3 entry points 🟢

| Función | Sistema prompt |
|---|---|
| `generarHtmlSemanal` | HTML estilo Moodle LMS |
| `generarGuiaSemanal` | Texto plano + rúbrica 4 niveles + logros |
| `mejorarContenido` | Chat de refinamiento; tipo determina el sistema |

Los tres comparten `callGroq` (ya extraído como helper). Los system prompts son sustancialmente distintos.  
**Veredicto 🟢 MANTENER** — la separación en 3 funciones es correcta. El plumbing está unificado.

---

#### Cluster M — Trabajos: crear y actualizar (singular / masivo / atajo) 🟢

| Par | Diferencia | Veredicto |
|---|---|---|
| `asignarTrabajo` vs `asignarTrabajoMasivo` | FormData vs objeto; 1 vs N inserts | 🟢 MANTENER — input diferente, semántica diferente |
| `actualizarEstadoTrabajo` vs `actualizarTrabajo` | Atajo solo-estado vs update completo | 🟢 MANTENER — el atajo hace 1 campo; el full update hace todo el row |

---

#### Cluster N — Participación en dos tablas distintas 🟡

| Función | Tabla destino |
|---|---|
| Dentro de `registrarAsistenciaMasiva` (`asistencia.ts`) | `participacion` (nivel + observacion) |
| `registrarParticipacion` (`asistencia.ts`) | `participacion` (nivel + observacion) |
| `guardarParticipacion` (`grupos.ts`) | `grupo_participacion` (auxiliar) |

Las dos primeras escriben la **misma tabla** con el mismo `onConflict (curso_id, estudiante_id, fecha)`. Si un componente llama ambas en la misma fecha, la segunda sobrescribe a la primera.  
**Recomendación 🟡:** `registrarAsistenciaMasiva` no debería escribir `participacion` directamente — debería llamar a `registrarParticipacion` internamente para el batch. Así hay un único punto de escritura.

---

### 1.3 Resumen numérico

| Veredicto | Clusters | Acciones |
|---|---|---|
| 🔴 UNIFICAR | A (parcial), C, D, E, H, I | `guardarBitacora`, `finalizarClase`, `crearGruposConIntegrantes`, `eliminarEstudiante`, `crearCursoAction` |
| 🟡 REFACTOR | A (parcial), B, F, G, J, K, N | 7 helpers a extraer |
| 🟢 MANTENER | L, M, y resto de functions | La mayoría de la codebase |
| ⚪ LEGACY | H, I | 2 funciones sin callers: `crearCursoAction`, `eliminarEstudiante` |

---

## 2. Rutas y Páginas

### 2.1 Inventario completo

#### Auth

| URL | Archivo | Propósito |
|---|---|---|
| `/auth/login` | `auth/login/page.tsx` | Login con tabs profesor / estudiante |
| `/auth/reset` | `auth/reset/page.tsx` | Solicitud de reset de contraseña |
| `/auth/new-password` | `auth/new-password/page.tsx` | Set nueva contraseña (token de email) |
| `/auth/setup` | `auth/setup/page.tsx` | Primera vez — setup de perfil |
| `/auth/callback` | `auth/callback/route.ts` | Handler OAuth/PKCE |
| `/tutoria-action/[token]` | `tutoria-action/[token]/page.tsx` | Acción por link de email (asistió / canceló) |

#### Dashboard — general

| URL | Archivo | Propósito |
|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Panel unificado: SummaryPanel + TodayPanel + AgendaSection + TutoriasPendientes |
| `/dashboard/agenda` | `dashboard/agenda/page.tsx` | **Redirect → `/dashboard`** ⚪ |
| `/dashboard/agenda/imprimir` | `agenda/imprimir/page.tsx` | Vista imprimible del día/semana |
| `/dashboard/actividades` | `dashboard/actividades/page.tsx` | Inbox completo de notas/tareas/recordatorios |
| `/dashboard/config` | `dashboard/config/page.tsx` | Perfil del profesor + (si admin) Panel Admin |
| `/dashboard/admin` | `dashboard/admin/page.tsx` | **Redirect → `/dashboard/config?tab=admin`** ⚪ |

#### Dashboard — cursos

| URL | Archivo | Propósito |
|---|---|---|
| `/dashboard/cursos` | `cursos/page.tsx` + `client.tsx` | Lista de cursos |
| `/dashboard/cursos/nuevo` | `cursos/nuevo/page.tsx` | Wizard 4 pasos (Información / Calendario / Horarios / Evaluación) |
| `/dashboard/cursos/[cursoId]` | `[cursoId]/page.tsx` | Detalle: métricas + grid 7 módulos + tabla estudiantes |
| `/dashboard/cursos/[cursoId]/editar` | `editar/page.tsx` + `editar-client.tsx` | Edición tabbed: Info / Calendario / Horarios / Evaluación / Logros / Zona peligrosa |
| `/dashboard/cursos/[cursoId]/asistencia` | `asistencia/page.tsx` | Reporte grid (estudiantes × fechas) paginado |
| `/dashboard/cursos/[cursoId]/pase-lista` | `pase-lista/page.tsx` | Tomar/editar asistencia con perfiles por estudiante |
| `/dashboard/cursos/[cursoId]/calificaciones` | `calificaciones/page.tsx` | Tabs: notas / participación / resumen / trabajos |
| `/dashboard/cursos/[cursoId]/calificaciones/config` | `calificaciones/config/page.tsx` | Configura `num_parciales` y `nombres_tareas` — **mini-duplicado** ⚠️ |
| `/dashboard/cursos/[cursoId]/trabajos` | `trabajos/page.tsx` | Listado y seguimiento de trabajos |
| `/dashboard/cursos/[cursoId]/trabajos/nuevo` | `trabajos/nuevo/page.tsx` | Form de asignación (acepta `?estudianteId=`) |
| `/dashboard/cursos/[cursoId]/encuesta` | `encuesta/page.tsx` | Dashboard agregado del grupo: distribuciones + tabla individual |
| `/dashboard/cursos/[cursoId]/citaciones` | `citaciones/page.tsx` + `citaciones-client.tsx` | Historial de citaciones del curso filtrado por mes |
| `/dashboard/cursos/[cursoId]/bitacora` | `bitacora/page.tsx` | Historial de entradas de bitácora legado (texto libre) ⚠️ |
| `/dashboard/cursos/[cursoId]/bitacora/nueva` | `bitacora/nueva/page.tsx` | Form texto libre para nueva bitácora ⚠️ |
| `/dashboard/cursos/[cursoId]/estudiantes/importar` | `estudiantes/importar/page.tsx` | Carga masiva CSV/paste |
| `/dashboard/pase-lista` | `pase-lista/page.tsx` | **Redirect → `/dashboard/cursos`** ⚪ |

#### Dashboard — planificación / clase

| URL | Archivo | Propósito |
|---|---|---|
| `/dashboard/planificacion` | `planificacion/page.tsx` + `planificacion-client.tsx` | "Mis Clases": grid semanal + tabla semestral + `PlanificacionExtensiva` |
| `/dashboard/modo-clase` | `modo-clase/page.tsx` | **Redirect → `/dashboard/planificacion`** ⚪ |
| `/dashboard/modo-clase/[bitacoraId]` | `[bitacoraId]/page.tsx` + `modo-clase-client.tsx` | Consola de clase en vivo: actividades + asistencia + grupos + Ruleta |
| `/dashboard/herramientas` | `herramientas/page.tsx` + `herramientas-client.tsx` | Ruleta + Agrupación standalone |

#### Dashboard — tutorías

| URL | Archivo | Propósito |
|---|---|---|
| `/dashboard/tutorias` | `tutorias/page.tsx` + `tutorias-page-client.tsx` | Tabs: Horarios / Historial / Citaciones |

#### Dashboard — estudiante individual

| URL | Archivo | Propósito |
|---|---|---|
| `/dashboard/estudiantes/[estudianteId]` | `estudiantes/[estudianteId]/page.tsx` | Ficha completa: stats + encuesta + asistencia + participación + trabajos + tutorías |

#### Student portal

| URL | Archivo | Propósito |
|---|---|---|
| `/student` | `student/page.tsx` | Home: cursos + trabajos + tutoría status + grupos + acceso rápido |
| `/student/onboarding` | `student/onboarding/page.tsx` | Encuesta inicial 5 pasos |
| `/student/perfil` | `student/perfil/page.tsx` | Editar email, teléfono, género, institución |
| `/student/tutorias` | `student/tutorias/page.tsx` + `tutorias-booking.tsx` | Booking de slots + citaciones pendientes |
| `/student/evidencias` | `student/evidencias/page.tsx` | Ensamblar PDF de evidencias |

#### API

| URL | Archivo | Propósito |
|---|---|---|
| `/api/asistencia/registro` | `api/asistencia/registro/route.ts` | Endpoint REST de registro de asistencia |
| `/api/generar-docx` | `api/generar-docx/route.ts` | Texto → DOCX descargable |
| `/api/generar-pdf` | `api/generar-pdf/route.ts` | Texto → PDF descargable |
| `/api/student/ensamblar-evidencias` | `api/student/ensamblar-evidencias/route.ts` | Merge PDFs + imágenes del estudiante |

---

### 2.2 Clusters de solapamiento

---

#### Ruta A — Detalle vs Editar de curso 🟢

- `/dashboard/cursos/[cursoId]` — solo lectura (métricas, módulos, tabla estudiantes).
- `/dashboard/cursos/[cursoId]/editar` — edición tabbed.
- El redirect `?edit=true` → `/editar` ya está limpio.  
**Veredicto 🟢 MANTENER** — read vs write; separación correcta.

---

#### Ruta B — Calificaciones/config: mini-duplicado real 🔴

`/dashboard/cursos/[cursoId]/calificaciones/config` edita exclusivamente `num_parciales` y `nombres_tareas`. Esos mismos campos están en:
- `/cursos/nuevo` paso 3 (Evaluación)
- `/cursos/[cursoId]/editar?tab=evaluacion`

Los tres llaman `actualizarCurso`. El `/config` es un shortcut de conveniencia creado en algún momento que hoy duplica funcionalidad ya accesible.  
**Veredicto 🔴 UNIFICAR** — redirect `/calificaciones/config` → `/editar?tab=evaluacion`. Eliminar la página config o convertirla en redirect.

---

#### Ruta C — Tutorías: 4 superficies del profesor sobre los mismos datos 🟡

| Superficie | Qué muestra de `reservas` |
|---|---|
| `AgendaClient` (`agenda-client.tsx`) | Slots del día en el grid semanal + confirmaciones |
| `TutoriasPendientesPanel` | Reservas vencidas sin marcar asistencia |
| `TodayPanel` | Reservas del día seleccionado (con toggle asistió/no-asistió) |
| `HistorialTab` (dentro de `/dashboard/tutorias`) | Todas las reservas históricas con filtros avanzados |

Cada una hace su propia query a `reservas`. `TodayPanel` y `TutoriasPendientesPanel` duplican la llamada a `marcarAsistenciaReserva`.  
**Veredicto 🟡 REFACTOR** — extraer hook `useReservasProfesor(filtros)` con SWR/React Query. Cada panel pasa filtros distintos al mismo hook. Elimina queries duplicadas.  
**Diferencia justificada:** cada panel tiene contexto de presentación distinto (summary / hoy / historial profundo).

---

#### Ruta D — Tutorías: profesor vs estudiante 🟢

`/dashboard/tutorias` (profesor) vs `/student/tutorias` (estudiante).  
**Veredicto 🟢 MANTENER** — distinto rol, distintos RLS, distintos flujos de acción.

---

#### Ruta E — Asistencia: 4 superficies de registro 🟡

| Superficie | Contexto |
|---|---|
| `PasarListaModal` (desde agenda/dashboard) | Modal rápida; 2 pasos: confirmar bitácora + asistencia |
| `/cursos/[cursoId]/pase-lista` | Página 3 pasos: bitácora → lista → resumen; con perfiles |
| `modo-clase-client.tsx` (panel asistencia) | Panel en vivo durante la clase |
| `/api/asistencia/registro` | Endpoint REST — base de todas las anteriores |

Todas llaman `registrarAsistenciaMasiva`. Las 3 UI reimplementan su propio grid de checkboxes Presente/Ausente/Atraso.  
**Veredicto 🟡 REFACTOR** — extraer `<AsistenciaGrid estudiantes[] onChange />` compartido. Las 3 superficies pasan sus estudiantes y reciben un callback; el submit cada una lo maneja a su manera.

---

#### Ruta F — Calificaciones-tab de trabajos vs página dedicada 🟢

- Tab "Trabajos" dentro de `/calificaciones` → vista derivada (estado + observación).
- `/cursos/[cursoId]/trabajos` → autoría y seguimiento completo.  
**Veredicto 🟢 MANTENER** — la tab es read-mostly; la página es write.

---

#### Ruta G — Ficha estudiante: drawer vs página completa 🟡

| Superficie | Scope |
|---|---|
| `FichaEstudianteDrawer` | Drawer lateral, tabs limitados (resumen / trabajos / participación / encuesta) |
| `/dashboard/estudiantes/[estudianteId]` | Página completa con todas las secciones expandidas |

Ambas muestran el mismo dominio (asistencia, participación, trabajos, encuesta, tutorías) pero con diferente nivel de detalle y UX.  
**Veredicto 🟡 REFACTOR** — extraer sub-componentes de display (`<FichaResumen>`, `<FichaAsistenciaCard>`, `<FichaTrabajosList>`, `<FichaEncuesta>`) que ambas superficies usen. Hoy la lógica de visualización está duplicada en los dos archivos.

---

#### Ruta H — Actividades: inbox vs floating panel 🟢

`/dashboard/actividades` (full inbox) vs `FloatingNotesPanel` (global en el layout, oculto en `/actividades`).  
**Veredicto 🟢 MANTENER** — vistas complementarias: flotante para quick-capture, inbox para gestión completa.

---

#### Ruta I — Encuesta: curso vs estudiante individual 🟢

`/cursos/[cursoId]/encuesta` (agregado del grupo) vs encuesta en `FichaEstudianteDrawer` y `/estudiantes/[id]` (por estudiante).  
**Veredicto 🟢 MANTENER** — distinto nivel de agregación.

---

#### Ruta J — Herramientas: standalone vs in-class 🟢

`/dashboard/herramientas` (fuera de clase, cualquier curso) vs dentro de `modo-clase-client.tsx` (in-class, same session).  
Los **componentes** `Ruleta` y `Agrupacion` ya son los mismos en ambos contextos.  
**Veredicto 🟢 MANTENER** — contextos distintos. El reuso de componentes ya está bien hecho.

---

#### Ruta K — Bitácora legacy texto libre vs bitácora estructurada 🟡 (deuda técnica)

| Superficie | Shape en BD |
|---|---|
| `/cursos/[cursoId]/bitacora` + `/bitacora/nueva` | Campos texto libre (`notas`, `materiales`) en `bitacora_clase` |
| `modo-clase-client.tsx` | `actividades_json` estructurado en `bitacora_clase` |

Misma tabla, shapes distintos. Las rutas legacy preceden al modo-clase estructurado.  
**Veredicto 🟡 EVOLUCIÓN EN CURSO** — no es duplicado estricto, pero sí acumulación de deuda. Decisión de producto pendiente: ¿migrar `/bitacora` a vista read-only del historial antiguo, o depreciar completamente?

---

#### Ruta L — Redirects legacy (borrar cuando no haya tráfico) ⚪

| Ruta | Destino | Acción |
|---|---|---|
| `/dashboard/agenda` | `/dashboard` | ⚪ borrar tras 1-2 sesiones |
| `/dashboard/modo-clase` | `/dashboard/planificacion` | ⚪ borrar tras 1-2 sesiones |
| `/dashboard/admin` | `/dashboard/config?tab=admin` | ⚪ borrar tras 1-2 sesiones |
| `/dashboard/pase-lista` | `/dashboard/cursos` | ⚪ borrar tras 1-2 sesiones |

---

## 3. Componentes UI

### 3.1 Inventario por carpeta

#### `src/components/agenda/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `PlanificarModal.tsx` | Modal | Crear / editar plan completo (tema, actividades, obs) — con sortable interno |
| `PasarListaModal.tsx` | Modal | 2 pasos: confirmar bitácora → asistencia masiva + participación |
| `ReplanificarModal.tsx` | Modal | Mover/merge plan a otra fecha via date picker |
| `DragDropConfirmModal.tsx` | Modal | Confirmación post-drag (Mover / Copiar / Cascada / Reemplazar / Combinar) |
| `PlanificacionExtensiva.tsx` | Panel / DnD | Timeline multi-semana con drag entre días (tiene su propio `DndContext`) |

#### `src/components/actividades/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `ActividadCard.tsx` | Card | Tarjeta completa: pin, color, archivar, checklist, convertir a evento |
| `MiniNotaCard.tsx` | Card | Tarjeta compacta para `FloatingNotesPanel`: solo pin y delete |
| `QuickAddModal.tsx` | Modal | Crear actividad rápida (título + tipo + color + curso) |
| `EditarActividadPanel.tsx` | Panel | Editar actividad completa: descripción, checklist, etiquetas, prioridad |
| `ConvertirEventoModal.tsx` | Modal | Convierte actividad(es) a evento de agenda |
| `FloatingNotesPanel.tsx` | Panel | Panel flotante global con `MiniNotaCard` + acciones rápidas |
| `ColorPicker.tsx` | Form | Selector de color reutilizable |
| `ChecklistEditor.tsx` | Form | Editor de checklist + `InlineChecklist` |

#### `src/components/cursos/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `tutoria-toggle.tsx` | Form | Toggle activa/desactiva flag de tutoría del estudiante |
| `estado-estudiante-button.tsx` | Form | Dropdown activo/retirado |
| `encuesta-tabla-cliente.tsx` | Table | Tabla de encuesta del grupo + `NotaEditor` inline |
| `asistencia-grid.tsx` | Table | Grid read-only asistencia × sesión (sin export) |
| `asistencia-grid-client.tsx` | Table | Grid paginado con export Moodle CSV (estudiantes × fechas) |
| `estudiantes-metrics-table.tsx` | Table | Tabla con métricas por estudiante (asistencia%, trabajos, encuesta) |
| `importar-form.tsx` | Form | Form de importación masiva CSV/paste |
| `citar-tutoria-button.tsx` | Form/Modal | Botón + modal inline para citar a tutoría |
| `horarios-editor.tsx` | Panel | Toggle vista/edición de horarios — envuelve `horarios-form-fields` |
| `horarios-form-fields.tsx` | Form | Fields puros de horarios de clase |

#### `src/components/tutorias/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `CitacionesTab.tsx` | Tab | Listado de citaciones activas con transiciones de estado inline |
| `HistorialTab.tsx` | Tab | Historial de reservas con filtros + form de registro manual |

#### `src/components/dashboard/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `SummaryPanel.tsx` | Panel colapsable | Stats globales + lista de cursos + botón Tomar Lista |
| `TodayPanel.tsx` | Panel colapsable | Clases/eventos/reservas del día con nav `< >` |
| `AgendaSection.tsx` | Panel colapsable | Wrapper colapsable sobre `AgendaClient` |
| `TutoriasPendientesPanel.tsx` | Panel colapsable | Reservas vencidas sin marcar asistencia |
| `horario-semana-widget.tsx` | Widget | Widget visual de horario semanal |

#### `src/components/ficha-estudiante/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `FichaEstudianteDrawer.tsx` | Drawer + Tabs | Drawer lateral: resumen / trabajos / participación / encuesta; incluye "Citar a tutoría" |

#### `src/components/herramientas/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `Ruleta.tsx` | Widget | Ruleta SVG animada para estudiantes o modo libre (array de strings) |
| `Agrupacion.tsx` | Panel + Tabs | 3 tabs: Aleatoria / Manual / Por afinidad; DnD con `@dnd-kit/core` |
| `ExclusionPanel.tsx` | Form | Lista de inclusión/exclusión con checkboxes — reusable |

#### `src/components/pase-lista/`

| Archivo | Tipo | Propósito |
|---|---|---|
| `pase-lista-wrapper.tsx` | Panel | Date picker wrapper para selección de fecha |
| `pase-lista-client.tsx` | Form | 3 pasos: bitácora → lista → resumen; con `FichaEstudianteDrawer` |
| `AsistenciaPorEstudiante.tsx` | Panel | UI alternativa uno-por-uno para asistencia |

#### Otras carpetas

| Archivo | Tipo | Propósito |
|---|---|---|
| `student/ChatBot.tsx` | Widget | Chat FAQ flotante del portal estudiante |
| `student/EnsamblarEvidencias.tsx` | Form | Drag-drop de PDFs/imágenes para ensamblar evidencias |
| `student/MisGrupos.tsx` | Panel | Grupos de clase abiertos con botones Unirme/Salir |
| `trabajos/nuevo-trabajo-form.tsx` | Form | Form de nuevo trabajo |
| `trabajos/trabaj os-manager.tsx` | Table | Listado y gestión de trabajos |
| `trabajos/trabajo-edit-panel.tsx` | Panel | Panel edición inline de trabajo |
| `calificaciones/calificaciones-table.tsx` | Table | Tabla de notas con inputs inline |
| `admin/profesores-manager.tsx` | Table | Gestión de usuarios/roles (solo admin) |
| `layout/sidebar.tsx` | Nav | Nav desktop hover-expand |
| `layout/mobile-nav.tsx` | Nav | Nav móvil drawer |
| `layout/header.tsx` | Nav | Header con `ClaseEnProgresoBar` |
| `planificacion/GeneradorPanel.tsx` | Panel | Wizard 3 pasos para generación IA semanal |

---

### 3.2 Clusters de duplicación

---

#### Componente A — Drag de planificación: 2 DndContext independientes 🟡

**Dónde:**
- `planificacion-client.tsx` — DndContext para el grid semanal; llama a `gestionarDragPlanificacion` + abre `DragDropConfirmModal`.
- `PlanificacionExtensiva.tsx` — su propio DndContext para el timeline largo; también llama a `gestionarDragPlanificacion` directamente (sin `DragDropConfirmModal`).

Ambos llaman al mismo server action, pero con lógica de colisión implementada de forma diferente. `PlanificacionExtensiva` no abre el modal de confirmación.  
**Veredicto 🟡 REFACTOR** — extraer `useDragPlanificacion({ onDropConfirmed })` que encapsule el handler `onDragEnd`, la validación de colisión y la apertura del modal. Ambos DndContext lo consumen. Elimina la implementación duplicada de drag.

---

#### Componente B — Modales de mover plan: ReplanificarModal vs DragDropConfirmModal 🟡

| Modal | Cuándo se abre | Resultado |
|---|---|---|
| `ReplanificarModal.tsx` | Botón explícito en la UI (date picker) | Llama `replanificarClase` directamente |
| `DragDropConfirmModal.tsx` | Post-drag | Llama `gestionarDragPlanificacion` |

Ambos confirman "mover un plan a otra fecha" pero con orígenes y acciones distintos.  
**Veredicto 🟡 REFACTOR sugerido** — no es un duplicado estricto, pero `ReplanificarModal` podría delegarse a `gestionarDragPlanificacion` para unificar el dispatching. No urgente.

---

#### Componente C — Asistencia: 3 UI que reimplementan el mismo grid 🟡

| Componente / archivo | Superficie |
|---|---|
| `PasarListaModal.tsx` (en `agenda/`) | Modal desde dashboard/agenda |
| `pase-lista-client.tsx` (en `pase-lista/`) | Página dedicada 3-paso |
| `AsistenciaPorEstudiante.tsx` (en `pase-lista/`) | UI alternativa uno-por-uno |
| Panel asistencia en `modo-clase-client.tsx` | In-class (archivo de página) |

Los tres/cuatro implementan un grid de checkboxes Presente / Ausente / Atraso con la misma lógica de estado local.  
**Veredicto 🟡 REFACTOR** — extraer `<AsistenciaGrid estudiantes[] estadoInicial onChange />`. Cada superficie lo envuelve y maneja el submit por su cuenta. Elimina ~150 líneas de código repetido.

---

#### Componente D — Ruleta: 3 implementaciones de slot-machine 🔴

| Componente | Scope | Implementación |
|---|---|---|
| `herramientas/Ruleta.tsx` | Ruleta SVG completa, acepta `estudiantes` o `items` libres | Archivo propio, usa `ExclusionPanel` |
| `RuletaGrupos` (función local en `modo-clase-client.tsx`) | Ticker de texto para sortear entre grupos | Función inline, ~80 líneas, exclusión propia |
| `sortearExpositor` (función local en `modo-clase-client.tsx`) | Ticker de texto para sortear expositor dentro de grupo | Función inline, ~40 líneas |

`Ruleta.tsx` ya acepta `items: string[]` (modo libre). Las dos funciones inline en `modo-clase-client.tsx` reinventan el mismo efecto slot-machine con un subset de funcionalidades.  
**Veredicto 🔴 UNIFICAR** — convertir `RuletaGrupos` y `sortearExpositor` en wrappers que llamen `<Ruleta items={grupos.map(g => g.nombre)} />`. Eliminar las implementaciones locales. Si el diseño visual difiere (SVG vs ticker de texto), extraer el **ticker** como subcomponente de `Ruleta.tsx` que ambos modos puedan usar.

---

#### Componente E — ExclusionPanel: no reutilizado donde debería 🟡

`ExclusionPanel.tsx` existe y es reusable. Se usa en `Agrupacion.tsx`.  
**No se usa** en `Ruleta.tsx` (que implementa su propia lista lateral de checkboxes) ni en las funciones inline `RuletaGrupos`/`sortearExpositor`.  
**Veredicto 🟡 REFACTOR** — que `Ruleta.tsx` consuma `ExclusionPanel`. Elimina la lista de checkboxes duplicada dentro de `Ruleta`.

---

#### Componente F — Tarjetas de actividad: ActividadCard vs MiniNotaCard 🟡

| Componente | Uso | Duplicación |
|---|---|---|
| `ActividadCard.tsx` | Inbox `/actividades` | Full: pin, color, archivar, completar, checklist, convertir |
| `MiniNotaCard.tsx` | `FloatingNotesPanel` | Mini: pin, delete, color border |

Ambas implementan `getCardStyle(color)` y el handler de pin de forma idéntica.  
**Veredicto 🟡 REFACTOR** — extraer `useActividadCardStyle(color)` hook compartido y `<PinButton actividadId value onChange />` como componente reutilizable.

---

#### Componente G — Paneles del dashboard: 4 implementaciones independientes de "colapsable" 🟡

`SummaryPanel`, `TodayPanel`, `AgendaSection`, `TutoriasPendientesPanel` — cada uno implementa:
```tsx
const [open, setOpen] = useState(() => localStorage.getItem('X-panel-open') !== 'false')
// ... toggle button con ChevronDown/Up ...
```
Código idéntico en los 4 archivos.  
**Veredicto 🟡 REFACTOR** — extraer `<CollapsiblePanel storageKey={string} title={string} defaultOpen={boolean}>`. Reduce ~30 líneas repetidas por panel (120 líneas en total).

---

#### Componente H — Sidebar vs MobileNav: drift de Administración 🔴

| Nav | Administración |
|---|---|
| `sidebar.tsx` | Hardcodeada en sección `<footer>` (líneas 91-107), **fuera** del array `navItems` |
| `mobile-nav.tsx` | Incluida como 6° elemento del array `navItems` (líneas 41-45) |

Los 5 ítems principales son idénticos. "Administración" existe en ambos pero declarada de forma diferente, lo que significa que si alguien agrega un ítem al array de uno sin tocar el otro, el footer del sidebar no se actualiza, y viceversa.  
**Veredicto 🔴 UNIFICAR** — extraer `src/components/layout/nav-items.ts` con:
```ts
export const NAV_ITEMS: NavItem[] = [/* Panel, Clases, Tutorías, MisCursos, Herramientas */]
export const FOOTER_ITEMS: NavItem[] = [/* Administración */]
```
Ambos componentes importan estas constantes. Elimina el drift de raíz.

---

#### Componente I — FichaEstudianteDrawer vs encuesta-tabla-cliente: NotaEditor duplicado 🟡

Ambos archivos importan `saveNotaIncidencia` y `clearProblemas` e implementan un editor inline de nota de incidencia (`NotaEditor`).  
**Veredicto 🟡 REFACTOR** — extraer `<NotaIncidenciaEditor estudianteId cursoId notaActual />` como componente compartido.

---

#### Componente J — Curso editar panel: referencia fantasma en CLAUDE.md ⚪

CLAUDE.md y `.claude/settings.local.json` mencionan `cursos/editar-curso-panel.tsx` como componente activo. **No existe en el código** (0 matches en `src/`). Solo existe `editar-client.tsx` con tabs.  
**Acción ⚪** — actualizar CLAUDE.md eliminando la referencia.

---

#### Componente K — Auth login: un solo archivo con tabs 🟢

`auth/login/page.tsx` maneja tabs `profesor` / `estudiante` en un solo componente.  
**Veredicto 🟢 MANTENER** — no hay duplicación.

---

## 4. Resumen ejecutivo

### Acciones inmediatas (bajo riesgo, alto beneficio)

Las siguientes acciones no rompen nada porque afectan código sin callers externos o componentes aislados:

| # | Acción | Archivo(s) | Prioridad |
|---|---|---|---|
| 1 | **Borrar `crearCursoAction`** — 0 callers en `src/` | `cursos.ts` | Alta |
| 2 | **Borrar `eliminarEstudiante`** — 0 callers en `src/` | `estudiantes.ts` | Alta |
| 3 | **Extraer `NAV_ITEMS` y `FOOTER_ITEMS`** en `nav-items.ts` — elimina drift sidebar/mobile-nav | `sidebar.tsx`, `mobile-nav.tsx`, nuevo `nav-items.ts` | Alta |
| 4 | **Redirect `/calificaciones/config` → `/editar?tab=evaluacion`** — duplicado real | `calificaciones/config/page.tsx` | Alta |
| 5 | **Actualizar CLAUDE.md** — eliminar referencia a `editar-curso-panel.tsx` inexistente | `CLAUDE.md` | Media |

### Refactors estructurales (medio plazo)

Requieren migrar callers pero no rompen la funcionalidad si se hacen con feature flag o por partes:

| # | Acción | Beneficio |
|---|---|---|
| 6 | Unificar `crearGrupos` + `crearGruposConIntegrantes` → 1 función | Elimina 80 líneas clonadas |
| 7 | Unificar `asignarEstudianteAGrupo` + `moverEstudiante` → 1 función | Elimina lógica de mover estudiante duplicada |
| 8 | Unificar `finalizarClase` + `confirmarCumplido` → 1 función | Elimina doble path a estado='cumplido' |
| 9 | Hacer `copiarPlanificacion`/`moverPlanificacion`/`fusionarPlanificacion` privadas (no export) | `gestionarDragPlanificacion` queda como único entry point |
| 10 | Extraer `<AsistenciaGrid>` compartido | 4 superficies de asistencia sin código repetido |
| 11 | Unificar 3 slot-machines (`Ruleta`, `RuletaGrupos`, `sortearExpositor`) | `Ruleta` absorbe las dos funciones inline |
| 12 | Extraer `<CollapsiblePanel storageKey>` | 4 paneles dashboard sin boilerplate repetido |
| 13 | Extraer `_insertarReservaConfirmada` helper privado en `tutorias.ts` | Elimina insert duplicado entre `agendarCitacion` y `asignarTutoriaDirecta` |
| 14 | Extraer `src/lib/email.ts` | Consolida 2 integraciones Resend inline |
| 15 | `registrarAsistenciaMasiva` → invocar `registrarParticipacion` internamente | Un solo punto de escritura a tabla `participacion` |

### Decisiones de producto pendientes

| # | Pregunta | Impacto |
|---|---|---|
| D1 | ¿Depreciar `/cursos/[cursoId]/bitacora` legacy texto-libre? | Afecta datos históricos de bitácoras pre-modo-clase |
| D2 | ¿Migrar `guardarBitacora` (FormData) a wrapper de `guardarBitacoraData`? | Implica identificar todos sus callers (podrían estar en formularios legacy) |
| D3 | ¿Eliminar los 4 redirects legacy en 1-2 sesiones? | Riesgo de romper bookmarks/deep-links guardados por usuarios |

### Convenciones derivadas (añadir a CLAUDE.md)

```md
## Antes de crear una nueva function/componente — checklist

- [ ] Revisar `docs/AUDITORIA_DUPLICADOS.md` §1.1 y §3.1 para ver si ya existe
- [ ] Para mover planes: usar `gestionarDragPlanificacion` (no `copiarPlanificacion` directamente)
- [ ] Para sorteos: usar `<Ruleta items={...} />` (no crear funciones inline)
- [ ] Para ficha de un estudiante en contexto: usar `FichaEstudianteDrawer`
- [ ] Para navegar: modificar `nav-items.ts` (un solo lugar, aplica a sidebar y mobile)
- [ ] Para emails: usar `src/lib/email.ts` (cuando exista)
```

---

*Documento generado el 2026-05-22. Actualizar al cerrar clusters o cambiar el estado de los refactors.*
