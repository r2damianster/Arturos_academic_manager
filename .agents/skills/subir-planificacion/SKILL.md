---
name: subir-planificacion
description: Extrae, estructura e inserta automáticamente una planificación académica completa (sílabo, lista de temas, ejercicios, talleres, recursos y calendarios) DIRECTAMENTE en Supabase Producción para los cursos del Gestor Universitario del Prof. Arturo Rodríguez. Usar cuando el usuario pida "subir planificación", "importar silabo", "cargar agenda de clases", o proporcione un plan de asignatura con unidades/ejercicios/recursos. Compatible con Antigravity y Claude Code.
---

# Cargar Planificación Académica Completa (Sílabo / Plan de Asignatura)

Este skill define la guía estándar, automatizable y de **ejecución directa** para procesar e insertar un **plan de estudio completo** (temas, ejercicios, actividades prácticas, recursos, talleres y evaluaciones) en la base de datos de **Supabase Producción** (`hxsnyrutyyavvljxwgku`) del **Gestor Universitario**.

---

## 📌 Contexto de Producción y Caché Dinámica de IDs

### 👤 Profesor Predeterminado
- **Profesor**: Arturo Damián Rodríguez Zambrano
- **Email**: `arturo.rodriguez@uleam.edu.ec`
- **ID (`profesor_id`)**: `6d3391b6-68da-4127-a424-aa8a88b2a785`
- **Institución Principal**: ULEAM

### 📚 Cursos Activos Registrados (`periodo: 2026-2`)
El skill mantiene esta lista en caché activa. Si el usuario solicita un plan para una de estas materias, la IA reutiliza directamente su `curso_id`:

| Asignatura | Código | ID de Curso (`curso_id`) | Periodo | Estado |
|---|---|---|---|---|
| **FILOSOFÍA, EPISTEMOLOGÍA Y SOCIOLOGÍA DE LA EDUCACIÓN** | `fese262a` | `3409c0a6-d716-490b-a6ca-3b437be3494e` | 2026-2 | `activo` |
| **Academic Reading and Writing II** | `arwi262` | `25d55e69-c5eb-4e20-871c-eeeb26aed643` | 2026-2 | `activo` |
| **METODOLOGÍA DE INVESTIGACIÓN II** | `1212364` | `c7464bad-ddaa-42d1-b964-f83ad60dcd14` | 2026-2 | `activo` |

> 🔄 **Mecanismo de Auto-retroalimentación**: Si la IA busca o crea un nuevo curso activo en Supabase Producción que no esté en esta tabla, **DEBE actualizar automáticamente este archivo SKILL.md** añadiendo la nueva fila con su `curso_id`, `codigo` y `asignatura` para que esté disponible de forma persistente en futuras sesiones.

---

## 🤖 Regla de Ejecución Directa por la IA

La IA (Antigravity o Claude Code) **NO debe pedirle al usuario que ejecute scripts ni SQLs a mano**. 
La IA ejecutará la inserción **directamente en Supabase Producción** mediante un script en Node.js/TypeScript usando `@supabase/supabase-js` con la **Service Role Key** o la **Management API Token** (`SUPABASE_ACCESS_TOKEN`) disponible en el proyecto.

---

## Flujo de Trabajo Completo (Pasos de Ejecución)

### Paso 1 — Validación del Curso y Horarios
1. Identificar el `curso_id` correspondiente en la tabla de cursos activos.
2. Si el curso no está en el listado, consultar Supabase Producción:
   ```sql
   SELECT id, codigo, asignatura, periodo, fecha_inicio, fecha_fin 
   FROM cursos 
   WHERE profesor_id = '6d3391b6-68da-4127-a424-aa8a88b2a785' AND estado = 'activo';
   ```
3. Consultar la tabla `horarios_clases` para conocer los días exactos de impartición (ej. Lunes=1, Jueves=4) y ajustar las fechas de cada sesión estrictamente a los días de clase de esa semana.

---

### Paso 2 — Estructuración y Parsing del Plan (JSONB)
Transformar el contenido suministrado por el usuario en el siguiente formato estructurado:

1. **Logro(s) de Aprendizaje** (`logros_aprendizaje`):
   - Extraer y limpiar los objetivos o resultados de aprendizaje indicados.

2. **Bitácoras de Clase** (`bitacora_clase`):
   Cada sesión debe contener:
   - `fecha`: YYYY-MM-DD (ajustada al día real de clase).
   - `tema`: Título unívoco de la unidad/tema.
   - `actividades_json`: Arreglo de actividades desglosadas individualmente:
     ```json
     [
       {
         "actividad": "1. Control de lectura individual con doble ruleta",
         "recurso": "Herramienta Ruleta Digital"
       },
       {
         "actividad": "2. Debate con r2-argumentum",
         "recurso": "Plataforma Argumentum Host (https://r2-argumentum.vercel.app/host.html)"
       }
     ]
     ```
   - `materiales`: Enlaces a slides/presentaciones (ej. Google Slides), herramientas o lecturas.
   - `observaciones`: Tareas autónomas inter-sesión o indicaciones de visionado/lectura.

---

### Paso 3 — Presentación de Vista Previa y Confirmación
Presentar al usuario la tabla resumen con las fechas exactas, temas, desglose de actividades y recursos para obtener la confirmación final.

---

### Paso 4 — Inserción Directa e Infallible en Supabase Producción

La IA ejecutará un script TS usando la conexión a Producción:

1. **Reemplazo de Logros**:
   ```ts
   await supabase.from('logros_aprendizaje').delete().eq('curso_id', cursoId)
   await supabase.from('logros_aprendizaje').insert({ curso_id: cursoId, descripcion: logroTexto, orden: 1 })
   ```

2. **Búsqueda e Inserción/Actualización Segura de Bitácora (evita errores de ON CONFLICT)**:
   ```ts
   const { data: existing } = await supabase
     .from('bitacora_clase')
     .select('id')
     .eq('curso_id', cursoId)
     .eq('fecha', fecha)
     .maybeSingle()

   if (existing) {
     await supabase.from('bitacora_clase').update({
       tema, actividades_json: actividades, materiales, observaciones, estado: 'planificado', sin_planificacion: false
     }).eq('id', existing.id)
   } else {
     await supabase.from('bitacora_clase').insert({
       profesor_id: profesorId, curso_id: cursoId, fecha, semana: 'Semana N', tema, actividades_json: actividades, materiales, observaciones, estado: 'planificado', sin_planificacion: false
     })
   }
   ```

---

### Paso 5 — Notificación y Actualización de SKILL.md
1. Informar al usuario que la carga ha finalizado exitosamente en producción.
2. Si se descubrió o creó un nuevo curso activo durante el proceso, **actualizar el listado en la sección "Cursos Activos Registrados" de este SKILL.md** y realizar git commit.

---

## 🔐 Reglas de seguridad y vigencia (obligatorio)
- **Nunca** escribir la `service_role` ni otras llaves en scripts, SQL o este skill: usar `scripts/_supabase-env.js` (lee `.env.local`) o el MCP de Supabase.
- Los IDs de curso de este skill corresponden al periodo 2026-2 y **caducan**: antes de operar, confirmar con `select id, asignatura, estado from cursos where estado='activo'`.
- Verificar el `project_id` de producción (`hxsnyrutyyavvljxwgku`) antes de escribir; no commitear archivos `.xlsx`, logs ni scripts ad hoc.
- Ver `docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md`.
