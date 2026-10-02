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
     .select('id, estado')
     .eq('curso_id', cursoId)
     .eq('fecha', fecha)
     .maybeSingle()

   // Los planes cargados por IA entran como 'en_revision' (el profesor los aprueba → 'planificado').
   // Si ya existe uno 'cumplido' o 'planificado', NO degradar su estado.
   if (existing) {
     await supabase.from('bitacora_clase').update({
       tema, actividades_json: actividades, materiales, observaciones,
       estado: ['cumplido', 'planificado'].includes(existing.estado) ? existing.estado : 'en_revision',
       sin_planificacion: false
     }).eq('id', existing.id)
   } else {
     await supabase.from('bitacora_clase').insert({
       profesor_id: profesorId, curso_id: cursoId, fecha, semana: 'Semana N', tema, actividades_json: actividades, materiales, observaciones, estado: 'en_revision', sin_planificacion: false
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

---

## 🏫 Cursos UTE (`periodo: 2026-2`, institución `UTE`)

| Curso | Código | `curso_id` | Día | Horario |
|---|---|---|---|---|
| GAS — Metodología de Investigación | `GAS-MDI-2026II` | `254d9765-0466-4d53-8b02-9d9bab624f53` | Jueves | 07:00–09:00 |
| ODO — Metodología de Investigación | `ODO-MDI-2026II` | `8d38cfd3-4a7b-4d60-a93f-9491909df306` | Jueves | — |
| MED — Desarrollo del Pensamiento | `MED-DPE-2026II` | `0f88c94d-f5c0-4262-b8c3-1f8b590e67d9` | Miércoles | — |
| NEG — Realidad Nacional y Mundial | `NEG-RNM-2026II` | `53966fa1-1401-43bb-bb4b-fc0c8e2d2ea2` | Miércoles | — |

Calendario: 16 sesiones; la numeración nunca se salta. Suspendidas (vacaciones): jueves 15-oct, 24-dic, 31-dic · miércoles 14-oct, 23-dic, 30-dic. Sesiones fusionadas 07/08-oct = "Sesión 1 y 2" y la siguiente clase = "Sesión 3 — Retomar Sesión 2".

### Reglas de campos (bitácora)
- `tema`: todos los temas y subtemas del sílabo, enumerados (también en sesiones fusionadas).
- `actividades_json`: **solo ACD** (actividades en aula), texto **fiel al sílabo**; una entrada por obra bibliográfica; los recursos (simuladores, videos, talleres) son ACD adicionales; **nunca** incluir RAA.
- **AA / TA / PE** (Actividad Autónoma; TA = Trabajo Autónomo en ULEAM; PE = Práctica Experimental en ambas universidades) son trabajo **fuera del aula**: van en `observaciones`, como texto fiel al sílabo y **sin recursos**. Los recursos solo se usan en ACD.
- Si el sílabo rotula como AA algo que se hace en clase, se pasa a ACD y se deja la nota en `observaciones`: «en el sílabo figura como AA; se aplica como ACD».
- `observaciones` completo: `AA/TA/PE … — EACD/EAA … Criterio: … — Palabras clave: conceptos importantes de la sesión.` Incluir también la línea `Criterio:` del sílabo.
- `materiales`: links a slides. Si falta slide: `[Diapositiva — pendiente de carga]`. Si solo existe una slide indirecta: se agrega el link **y** una actividad `Presentación PPT — Pendiente: <Tema>`. En evaluaciones, vacío.
- `observaciones`: `EACD/EAA: … Criterio: …` separados por ` — `. No inventar AA que el sílabo no tenga. "Experimentación blanda" solo en ODO (últimas semanas).
- **No modificar sesiones con placeholder (`Sesion N`) ni sobrescribir sesiones con contenido sin orden explícita.**
- Ejecutar escrituras contra prod vía MCP Supabase (`hxsnyrutyyavvljxwgku`): el `.env.local` apunta al proyecto de desarrollo.

---

## 📦 Repositorio de Recursos por Temática

Para asignaturas de **Metodología de la Investigación y afines**, existe un repositorio separado con slides, simuladores y plataformas reutilizables:

📄 **Archivo**: `.agents/skills/subir-planificacion/recursos-investigacion.md`

### 🔖 REGLA DE PLANIFICACIÓN — incluir TODO lo disponible (2026-10-02)
Cuando el profesor pida **planificar** (o replanificar) una sesión, incluir **todas** las diapositivas (S##) y **todos** los talleres, simuladores y videos (R##) del catálogo que se relacionen con el tema de la sesión — no solo uno.
- Slides → `materiales` (una por línea: `Título (ES|EN): URL`), usando el idioma del curso (títulos en inglés = slide en inglés; en español = español; si el título es bilingüe, ambos).
- Talleres, simuladores y videos → una ACD por recurso en `actividades_json`.
- Si una slide cubre directamente el tema, **no** dejar `Presentación PPT — Pendiente`; si solo hay slides indirectas, incluirlas y dejar el pendiente.
- Antes de planificar, comprobar que cada URL siga vigente en `recursos-investigacion.md`: las slides eliminadas del repositorio deben quitarse también de los planes en BD.
- Respetar siempre los temas del sílabo de la sesión; agregar actividades/slides está permitido, cambiar el tema no.

### Flujo obligatorio al planificar sesiones de investigación:
1. **LEER** `recursos-investigacion.md` antes de planificar cualquier sesión de investigación.
2. **ASIGNAR** recursos ✅ Aprobados que coincidan con el tema de la sesión.
3. Si se descubre un recurso nuevo en la BD (semestres anteriores) → **AGREGAR** en sección `⬜ Pendientes de Revisión` del archivo con todos los campos.
4. **NUNCA** aprobar automáticamente recursos pendientes — solo el profesor lo hace.
5. Si el profesor aprueba un pendiente en sesión → moverlo a Aprobados en el mismo archivo.
