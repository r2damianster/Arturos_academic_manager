---
name: registrar-tutoria
description: Registra y sincroniza automáticamente las sesiones de tutoría académica (asistencia a tutoría individual o grupal) para los estudiantes de los cursos del Gestor Universitario del Prof. Arturo Rodríguez DIRECTAMENTE en Supabase Producción. Identifica estudiantes por nombre/apellido mediante fuzzy matching, vincula el curso correspondiente, registra en la tabla `reservas` (origen 'manual', estado 'completada', asistio true) y notifica el resultado. Compatible con Antigravity y Claude Code.
---

# Registrador y Gestor de Tutorías Académicas

Este skill define la guía estándar, automatizada y de **ejecución directa** para identificar estudiantes a partir de solicitudes o listas informales de tutoría (nombres/apellidos con errores tipográficos o nombres parciales), procesar la asistencia y tema tratado en la sesión de tutoría (individual o grupal) para una fecha dada, y registrar los datos en **Supabase Producción** (`hxsnyrutyyavvljxwgku`).

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

## 📊 Reglas de Estructura de Datos en Supabase (`tabla: reservas`)

Para registrar una tutoría efectuada (manual/no agendada previamente por el estudiante), la IA inserta o actualiza registros directamente en la tabla `public.reservas` con la siguiente estructura de campos:

| Campo | Valor Predeterminado / Regla | Ejemplo |
|---|---|---|
| `profesor_id` | `6d3391b6-68da-4127-a424-aa8a88b2a785` | `6d3391b6-68da-4127-a424-aa8a88b2a785` |
| `curso_id` | `curso_id` correspondiente a la asignatura indicada | `3409c0a6-d716-490b-a6ca-3b437be3494e` |
| `auth_user_id` | ID del profesor (`6d3391b6...`) o UUID del usuario auth si aplica | `6d3391b6-68da-4127-a424-aa8a88b2a785` |
| `estudiante_nombre` | Nombre completo del estudiante obtenido por fuzzy matching | `Nombre Apellido Apellido` |
| `estudiante_carrera` | Carrera asignada o `Educación` / `Idiomas` según curso | `Educación` |
| `email` | Correo institucional del estudiante si está disponible o `''` | `e131...@live.uleam.edu.ec` |
| `fecha` | Fecha de la tutoría en formato `YYYY-MM-DD` (si no se especifica, usa hoy) | `2026-09-21` |
| `hora_inicio_manual` | Hora de inicio especificada o por defecto `'14:00'` | `14:00` |
| `hora_fin_manual` | Hora de fin especificada o por defecto `'15:00'` | `15:00` |
| `origen` | `'manual'` | `'manual'` |
| `estado` | `'completada'` | `'completada'` |
| `asistio` | `true` (si asistió) / `false` (si fue inasistencia registrada) | `true` |
| `inasistencia_reconocida` | `true` | `true` |
| `notas` | Descripción del tema o razón de la tutoría | `Refuerzo sobre epistemología y pensamiento crítico` |

---

## 🚫 Regla de Estudiantes RETIRADOS (`estado = 'retirado'`)

1. **Filtro Inicial**: Consultar el campo `estado` en la tabla `estudiantes`.
2. **Exclusión o Advertencia**: Si un estudiante provisto tiene `estado = 'retirado'`, la IA notifica al profesor que el estudiante figura como retirado antes de registrar la tutoría.

---

## 🔍 Algoritmo de Identificación e Historial Fuzzy de Estudiantes

Cuando el usuario suministre una lista de estudiantes en texto plano (ej: *"anthony ortegga, inmNOL, nicollw lucas"*), la IA aplica un algoritmo de normalización y emparejamiento fuzzy (distancia Levenshtein + coincidencia de tokens).

### Resolución de estudiantes
Leer el roster vigente y hacer el fuzzy match contra ese resultado:

```sql
select id, nombre, email, estado from estudiantes
where curso_id = '<curso_id>' and estado <> 'retirado';
```

No guardar nombres ni IDs de estudiantes en este archivo (datos personales; ver docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md § 1).

---

## 🤖 Flujo de Trabajo (Pasos de Ejecución)

### Paso 1: Parsear la Solicitud
1. **Asignatura**: Identificar la materia (ej: Filosofía -> `fese262a`, `3409c0a6-d716-490b-a6ca-3b437be3494e`).
2. **Fecha**: Extraer fecha o asumir la fecha actual (`YYYY-MM-DD`).
3. **Hora**: Extraer hora o usar `'14:00'` – `'15:00'`.
4. **Tema / Notas**: Tema tratado en la tutoría (ej. "Tutoría académica sobre la unidad 1").
5. **Lista de Estudiantes**: Lista informal proporcionada por el usuario.

### Paso 2: Fuzzy Matching de Estudiantes
1. Normalizar nombres (quitar acentos, convertir a minúsculas).
2. Emparejar cada nombre informal con la base de datos de estudiantes del curso.
3. Si la coincidencia es ambigua, pedir confirmación rápida al usuario.

### Paso 3: Inserción en Supabase Producción (MCP `execute_sql`, proyecto `hxsnyrutyyavvljxwgku`)

Mostrar primero el plan y esperar confirmación. Una fila por estudiante:

```sql
insert into reservas (profesor_id, curso_id, auth_user_id, estudiante_nombre, estudiante_carrera, email, telefono,
                      fecha, hora_inicio_manual, hora_fin_manual, origen, estado, asistio, inasistencia_reconocida, notas)
values ('<profesor_id>', '<curso_id>', '<profesor_id>', '<nombre completo>', '<carrera o vacío>', '<email o vacío>', '',
        '<fecha>', '14:00', '15:00', 'manual', 'completada', true, true, '<tema de la tutoría>');
```

### Paso 4: Notificación Final al Usuario
Generar un informe compacto que incluya:
- 📅 **Fecha y Hora**: `YYYY-MM-DD` (`HH:MM` - `HH:MM`)
- 📚 **Asignatura**: Nombre del Curso
- 📝 **Tema/Nota**: Observaciones de la tutoría
- 👥 **Estudiantes Registrados**: Tabla con Nombre Informal ➡️ Nombre Completo en BD ➡️ Estado (`[REGISTRADO EN SUPABASE]`).

---

## 🔐 Reglas de seguridad y vigencia (obligatorio)
- **Nunca** escribir la `service_role` ni otras llaves en scripts, SQL o este skill: usar `scripts/_supabase-env.js` (lee `.env.local`) o el MCP de Supabase.
- Los IDs de curso de este skill corresponden al periodo 2026-2 y **caducan**: antes de operar, confirmar con `select id, asignatura, estado from cursos where estado='activo'`.
- Verificar el `project_id` de producción (`hxsnyrutyyavvljxwgku`) antes de escribir; no commitear archivos `.xlsx`, logs ni scripts ad hoc.
- Ver `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`.
