---
name: evaluar-participacion
description: Registra, evalúa y sincroniza automáticamente las notas de participación, control de lectura y actividades en clase para los cursos del Gestor Universitario del Prof. Arturo Rodríguez DIRECTAMENTE en Supabase Producción. Identifica estudiantes por nombre/apellido mediante fuzzy matching, respeta la asistencia tomada a clase y consulta al usuario qué hacer con estudiantes omitidos de las listas. Compatible con Antigravity y Claude Code.
---

# Evaluador y Registrador de Participación / Control de Lectura Diario

Este skill define la guía estándar, automatizada y de **ejecución directa** para identificar estudiantes a partir de listas informales de clase (nombres/apellidos con errores tipográficos o nombres parciales), evaluar su nivel de participación o cumplimiento en controles de lectura para una fecha específica, y registrar los resultados en **Supabase Producción** (`hxsnyrutyyavvljxwgku`).

---

## 📌 Contexto de Producción y Caché de Cursos y Estudiantes

### 👤 Profesor Predeterminado
- **Profesor**: Arturo Damián Rodríguez Zambrano
- **Email**: `arturo.rodriguez@uleam.edu.ec`
- **ID (`profesor_id`)**: `6d3391b6-68da-4127-a424-aa8a88b2a785`
- **Institución Principal**: ULEAM

### 📚 Cursos Activos Registrados (`periodo: 2026-2`)

| Asignatura | Código | ID de Curso (`curso_id`) | Periodo | Estado |
|---|---|---|---|---|
| **FILOSOFÍA, EPISTEMOLOGÍA Y SOCIOLOGÍA DE LA EDUCACIÓN** | `fese262a` | `3409c0a6-d716-490b-a6ca-3b437be3494e` | 2026-2 | `activo` |
| **Academic Reading and Writing II** | `arwi262` | `25d55e69-c5eb-4e20-871c-eeeb26aed643` | 2026-2 | `activo` |
| **METODOLOGÍA DE INVESTIGACIÓN II** | `1212364` | `c7464bad-ddaa-42d1-b964-f83ad60dcd14` | 2026-2 | `activo` |

---

## 🛑 Regla Fundamental: Autonomía de la Asistencia a Clase (`asistencia`)

1. **La asistencia a clase es independiente del desempeño evaluativo**: Incumplir un control de lectura o tarea NO convierte al estudiante en ausente si asistió a la sesión.
2. **NO modificar arbitrariamente la tabla `asistencia`**:
   - El registro de la asistencia física/virtual (`Presente`, `Ausente`, `Atraso`) tomado en el pase de lista se respeta estrictamente.
   - Las calificaciones de cumplimiento o incumplimiento se registran **exclusivamente** en:
     * Tabla `participacion` (`nivel`: 5 para Cumple Excelente, 1 para Incumple).
     * Tabla `calificaciones_items` (`fuente`: `'en_curso'`, `nota`: 10.0 o 0.0).

---

## 🚫 Regla de Estudiantes RETIRADOS (`estado = 'retirado'`)

1. **Filtro de Estado Inicial**: La IA consulta las columnas `estado` y `retirado_at` en la tabla `estudiantes`.
2. **Exclusión Automática**:
   - Los estudiantes con `estado = 'retirado'` o `retirado_at IS NOT NULL` **NO deben ser evaluados ni listados como faltantes o no calificados**.
   - En los reportes se marcan explícitamente como `[RETIRADO]`.

---

## 🤖 Regla de Ejecución Directa por la IA

La IA (Antigravity o Claude Code) **ejecuta los registros directamente en Supabase Producción** (`hxsnyrutyyavvljxwgku`) con el MCP de Supabase (`execute_sql`). `scripts/_supabase-env.js` apunta a desarrollo; no usarlo para producción.

---

## 🔍 Algoritmo de Identificación e Historial Fuzzy de Estudiantes

Cuando el usuario suministre una lista de estudiantes en texto plano (ej: *"anthony ortegga 0", "inmNOL 0", "nicollw lucas"*), la IA aplica un algoritmo de normalización y emparejamiento fuzzy (distancia Levenshtein + coincidencia parcial de tokens).

### Resolución de estudiantes
Leer el roster vigente y hacer el fuzzy match contra ese resultado:

```sql
select id, nombre, email, estado from estudiantes
where curso_id = '<curso_id>' and estado <> 'retirado';
```

Ante ambigüedad, preguntar. No guardar nombres ni IDs de estudiantes en este archivo (datos personales; ver docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md § 1).

---

## 📊 Reglas de Mapeo de Calificaciones en Supabase

| Categoría | `participacion.nivel` | `calificaciones_items.nota` | `asistencia.estado` | Observación en Participación |
|---|---|---|---|---|
| **CUMPLEN EXCELENTE** | `5` | `10.0` | *(Sin cambios)* | `[Actividad] - Cumple Excelente` |
| **INCUMPLE / REPROBADO** | `1` | `0.0` | *(Sin cambios)* | `[Actividad] - Incumple` |

---

## ⚡ Inserción (SQL vía MCP)

```sql
-- 1. Participación (upsert por el índice único curso_id, estudiante_id, fecha)
insert into participacion (profesor_id, curso_id, estudiante_id, fecha, nivel, observacion)
values ('<profesor_id>', '<curso_id>', '<estudiante_id>', '<fecha>', <5 si cumple | 1 si incumple>, '<Actividad> - <Cumple Excelente|Incumple>')
on conflict (curso_id, estudiante_id, fecha) do update
  set nivel = excluded.nivel, observacion = excluded.observacion;

-- 2. Notas en curso (nunca alimentan riesgo, citaciones ni IA)
insert into calificaciones_items (profesor_id, curso_id, estudiante_id, parcial, nombre_item, tipo, nota, fuente)
values ('<profesor_id>', '<curso_id>', '<estudiante_id>', <parcial>, '<Actividad>', 'tarea', <10 | 0>, 'en_curso')
on conflict (curso_id, estudiante_id, nombre_item, fuente) do update set nota = excluded.nota;
```

Mostrar el plan (estudiantes resueltos, nivel y nota) y esperar confirmación antes de escribir.

---

## 🔐 Reglas de seguridad y vigencia (obligatorio)
- **Nunca** escribir la `service_role` ni otras llaves en scripts, SQL o este skill: usar `scripts/_supabase-env.js` (lee `.env.local`) o el MCP de Supabase.
- Los IDs de curso de este skill corresponden al periodo 2026-2 y **caducan**: antes de operar, confirmar con `select id, asignatura, estado from cursos where estado='activo'`.
- Verificar el `project_id` de producción (`hxsnyrutyyavvljxwgku`) antes de escribir; no commitear archivos `.xlsx`, logs ni scripts ad hoc.
- Ver `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`.
