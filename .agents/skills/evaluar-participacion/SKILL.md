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

La IA (Antigravity o Claude Code) **ejecuta los registros directamente en Supabase Producción** mediante scripts de Node.js / TypeScript utilizando `@supabase/supabase-js` con la **Service Role Key** o las credenciales de entorno.

---

## 🔍 Algoritmo de Identificación e Historial Fuzzy de Estudiantes

Cuando el usuario suministre una lista de estudiantes en texto plano (ej: *"anthony ortegga 0", "inmNOL 0", "nicollw lucas"*), la IA aplica un algoritmo de normalización y emparejamiento fuzzy (distancia Levenshtein + coincidencia parcial de tokens).

### 📋 Mapeo de Referencia Rápida — Filosofía (`fese262a`)

| Entrada Común / Apodo | Nombre Completo en Supabase | ID de Estudiante (`estudiante_id`) | Estado Académico |
|---|---|---|---|
| `anthony ortegga` | Anthony Sebastian Ortega Hurtado | `e4a470a8-b261-4d9c-9ca7-06e6c4a67959` | `activo` |
| `inmNOL` | Imannol Paolo Hernandez Valencia | `a7213211-e21a-4833-bc1d-eb8699f7e9d7` | `activo` |
| `FATIMA IBARRA` | Fatima Giarelis Ibarra Mora | `93b7201a-ee72-44c3-9ad4-c92342956e0a` | `activo` |
| `YELENA CORNEJO` | Yelena Dayesi Mendoza Cornejo | `a073e4e5-a721-48a9-8ce0-83d7ccfa00ac` | `activo` |
| `MELANY MEJIA` | Melany Juleidy Mejia Macias | `5275db9b-48cc-4a36-b6ed-c7ea406100fd` | `activo` |
| `ARIELKA NAREA` | Arielka Pierina Alarcon Narea | `66143ba1-40dd-4b11-a17d-01256c9c1dbd` | `activo` |
| `ASLEY VERA` | Ashley Paola Vera Chilan | `a48414a8-0eab-4beb-9bae-4dfc9b433e2c` | `activo` |
| `jonathan vera` | Jonnathan Steven Vera Flores | `1317cced-6283-493e-a79e-191c825da9a9` | `activo` |
| `brithany mero` | Brithany Elizabeth Mero Chila | `c689c67b-7ee6-4fcc-89f1-af7b7df0dbf2` | `activo` |
| `yulia zambrnao` | Yulia Gabriela Zambrano Puruncaja | `6af84b91-a84e-49dd-900a-c665952860ab` | `activo` |
| `geovana lascano` | Geovanna Alexandra Lascano Lascano | `9ca4c7e0-08d8-4154-b72f-eec71677bb62` | `activo` |
| `sherlye cheme` | Sherlyn Melina Cheme Mero | `aa127cca-13cd-48d4-8eda-a7f75a6dc493` | `activo` |
| `cristhoper leon` | Cristhopher Josue Macias Leon | `0f689d72-6e38-4685-b77d-19ad015be277` | `activo` |
| `bryen macias` | BRYAN MACIAS | `0fd9a24b-475e-4ad3-b262-abc110a1a9ef` | `activo` |
| `melanie barberan` | Melanie Vanessa Barberan Guerra | `b9a1a302-eef2-4bad-8ede-a23f1d841db0` | `activo` |
| `paola roman` | Devany Paola Roman Macias | `93f7ca69-2d49-463e-aaee-0dfc0f5f1e21` | `activo` |
| `nicollw lucas` | LUCAS MARCILLO GIBELLY NICOLLE | `e5e82c0d-7fe3-430f-a092-826447b6e2c8` | `activo` |
| `steffany artos` | Steffany Ibeth Artos Mendoza | `0f5d0b02-ad0e-4bfb-91e1-92007dde5e58` | `activo` |
| `jasson velez` | Jasson Patricio Velez Cedeño | `04eb65e9-2d39-419f-9b63-f722d42835ce` | `activo` |
| `karime` | Karime Tiare Moreira Cotera | `de17fcf0-4828-4510-a3cd-f87ffa68238d` | `activo` |
| `maria pia carreño` | Maria Carreño (F. Cedula) | `1774b566-6165-4065-a9f9-64b226682fc6` | `activo` |
| `daniela zambrano` | Daniela Michell Zambrano Zambrano | `27e6b384-2b65-4fcc-b335-d8f5fd7b2c00` | `activo` |
| `españo romero` | Irvin Josue España Romero | `99a18df3-fa16-43ba-b6a5-5e18e58e1857` | `activo` |
| `sebastian rodriguez` | Jose Sebastian Rodriguez Muñoz | `d63707d1-6696-4339-918b-3389e57d4a07` | `activo` |
| `daniela alexandra` | Daniela Alexandra Loor Majojo | `fd3eb54e-2c7e-4540-b2f6-c30567ab76e2` | `activo` |
| `alexandra delgado` | Alexandra Monserrate Delgado Pincay | `c3cc9b86-cafe-43c9-a3b3-22b2baa9d120` | `activo` |
| `emily cadena` | Emily Domenica Cadena Fernandez | `6bbde18d-0a74-429b-b206-0f0349a498c8` | `activo` |
| `bravo santana` | Jose Antonio Bravo Santana | `822c77e2-feec-4ed7-993a-45766f6174ed` | `activo` |
| `isamae esavi` | Ismael Esau Pilay Demera | `93a5f48f-f7e6-4a9a-a7ba-9f1f2eeee63c` | `activo` |
| `nathaly mera` | Nathaly Fernanda Mera Lucas | `d98cade5-bc36-414b-889a-5de851dfe4ac` | `activo` |
| `valeska perez` | Valeska Del Valle Perez Quiaro | `6429d957-1939-44b6-8d26-199a5a32d1cc` | `activo` |
| `alisson vera` | Alisson Thayry Vera Vera | `80e8218f-2ad7-4f16-8187-1e815ce4f4ce` | `activo` |
| `valentina lucas` | Maria Valentina Lucas Ponce | `b81710fd-0fb1-42bb-9b62-ee48aa5187e9` | `activo` |
| `alvarez romina` | Romina Mayte Alvarez Pita | `baf23b26-0ab8-4332-9f65-a10166fcc15d` | `activo` |
| `danna vaca` | Danna Deyaneira Vaca Pin | `456fa801-336e-432f-87c1-d6c3e19f7546` | `activo` |
| `gislayne posligua` | Gislayne Stephany Posligua Marin | `687ee55a-99af-4468-8fed-452a2895bb96` | `activo` |
| `daniela maritza` | Maritza Daniela Pavon Laguatagsi | `f7d68dce-11c1-4dd1-ba1a-bb007e19eed5` | `activo` |
| `nohely rodriguez` | Nohely Alejandra Rodriguez Goya | `ab61e285-ee8c-494f-bc39-eec6d372a2d7` | `activo` |
| `malany zambrano` | Melany Anahi Zambrano Molina | `1f0a06ec-b284-421d-a7da-80ea70296011` | `activo` |
| `camelia romero` | Angie Camelia Romero Briones | `29cb9f68-910b-4e5e-a30b-1a7f536a3733` | `activo` |

---

## 📊 Reglas de Mapeo de Calificaciones en Supabase

| Categoría | `participacion.nivel` | `calificaciones_items.nota` | `asistencia.estado` | Observación en Participación |
|---|---|---|---|---|
| **CUMPLEN EXCELENTE** | `5` | `10.0` | *(Sin cambios)* | `[Actividad] - Cumple Excelente` |
| **INCUMPLE / REPROBADO** | `1` | `0.0` | *(Sin cambios)* | `[Actividad] - Incumple` |

---

## ⚡ Script de Inserción Directa (TypeScript / Node.js)

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function registrarEvaluacionDia({
  cursoId,
  fecha,
  actividadNombre,
  evaluaciones // Array<{ estudiante_id, cumple: boolean }>
}) {
  // 1. Inserción/Actualización exclusiva en 'participacion'
  const participaciones = evaluaciones.map(e => ({
    profesor_id: '6d3391b6-68da-4127-a424-aa8a88b2a785',
    curso_id: cursoId,
    estudiante_id: e.estudiante_id,
    fecha,
    nivel: e.cumple ? 5 : 1,
    observacion: `${actividadNombre} - ${e.cumple ? 'Cumple Excelente' : 'Incumple'}`
  }));

  await supabase.from('participacion').upsert(participaciones, {
    onConflict: 'curso_id,estudiante_id,fecha'
  });

  // 2. Inserción/Actualización en 'calificaciones_items' (Notas en curso)
  const calificaciones = evaluaciones.map(e => ({
    profesor_id: '6d3391b6-68da-4127-a424-aa8a88b2a785',
    curso_id: cursoId,
    estudiante_id: e.estudiante_id,
    parcial: 1,
    nombre_item: actividadNombre,
    tipo: 'tarea',
    nota: e.cumple ? 10 : 0,
    fuente: 'en_curso'
  }));

  await supabase.from('calificaciones_items').upsert(calificaciones, {
    onConflict: 'curso_id,estudiante_id,nombre_item,fuente'
  });
}
```
