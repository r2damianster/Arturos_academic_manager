---
name: explorar-tema-clase
description: Dossier de propuesta para un tema de clase del gestor universitario. Se invoca con el tema (por ejemplo `/explorar-tema-clase "El giro lingüístico"`) y MUESTRA, sin ejecutar nada: dónde cae el tema en el plan del curso, textos y materiales existentes, enfoques alternativos con recomendación, actividades candidatas con tiempos, prompts listos para NotebookLM, opciones de estilo visual para que el profesor elija y la arquitectura detallada slide a slide para Gemini. No planifica, no escribe en la base de datos, no genera imágenes ni diapositivas. Úsalo cuando el profesor diga "no sé cómo enfocar este tema", "qué opciones tengo para X", "muéstrame textos y actividades sobre Y" o "dame propuestas para la clase de Z".
---

# Explorar un tema de clase (dossier de propuesta)

> **Alcance: solo el proyecto gestor-universitario-next.** Usa su esquema de Supabase
> (`cursos`, `bitacora_clase`, `horarios_clases`) y su `CLAUDE.md`. No es un skill global.

## Qué hace y qué NO hace

**Hace:** leer el contexto del curso y devolver **un dossier** para que el profesor decida.
**No hace, salvo orden explícita posterior:**
- No escribe en la base de datos (ni `bitacora_clase` ni nada). Solo `SELECT`.
- No ejecuta los prompts de NotebookLM ni de Gemini: **los muestra** para que el profesor los copie.
- No crea imágenes, afiches, diapositivas, artefactos ni archivos.
- No decide por el profesor: presenta opciones y una recomendación.

Para pasar a la acción el profesor da otra orden (ver "Siguientes pasos"): `registrar-clase` o
`subir-planificacion` para la bitácora, o "arquitectura completa de slides", "genera el afiche", etc.

## Entrada

`/explorar-tema-clase "<Tema>"` con opcionales: curso, fecha o semana, duración. Si falta el curso,
buscar el curso activo cuya asignatura calce con el tema; si hay duda, preguntar una sola vez.

## Procedimiento (todo de solo lectura)

### 1. Ubicar el tema en el plan
Consultar con `SELECT` (nunca escribir). `cursos` usa `asignatura`; `horarios_clases` no tiene `aula`
y cada fila es 1 hora (sumar horas consecutivas).

```sql
select id, codigo, asignatura, periodo, fecha_inicio, fecha_fin, num_parciales, nombres_tareas
from cursos where estado='activo' and asignatura ilike '%<palabra>%';

select fecha, semana, estado, tema, actividades_json, observaciones, materiales
from bitacora_clase where curso_id='<curso>' order by fecha;

select dia_semana, hora_inicio, hora_fin from horarios_clases where curso_id='<curso>' order by 1,2;
select count(*) from estudiantes where curso_id='<curso>' and coalesce(estado,'activo')='activo';
select descripcion from logros_aprendizaje where curso_id='<curso>' order by orden;
```

Producir: **arco del curso** (unidades anteriores, el tema, siguientes), **sesiones disponibles con
duración real** hasta el próximo tema, y la **tabla puente** (qué ya vieron → cómo se conecta el tema).
Marcar sin corregir: temas vacíos, clases pasadas aún `planificado`, duplicados, suspensiones.
Si no hay acceso a la base, pedir al profesor que pegue el plan.

### 2. Textos y materiales existentes
Listar, separando por origen y **sin inventar**:
- **Ya en el plan del profesor**: enlaces y recursos de `actividades_json`/`materiales` relacionados
  con el tema o con unidades vecinas (slides, guías, formularios) que podrían reutilizarse.
- **En el repo**: `grep` en `docs/`, `.claude/skills/*/ejemplo-*.md` y otros dossiers previos.
- **Lecturas candidatas**: 5–8 textos (preferir español y acceso abierto), cada uno con **para qué
  sirve**, nivel (introductorio / intermedio / para el profesor) y la advertencia "verificar edición".
  Si hay una herramienta de búsqueda académica disponible (por ejemplo Scholar Gateway), usarla solo
  para **comprobar que la fuente existe**; si no, marcar todo como "de memoria, verificar".
- **Recursos audiovisuales** (película, charla, documental) con la consigna que permitirían;
  si no hay enlace confirmado, dejar "enlace por confirmar".

### 3. Enfoques alternativos (3 opciones)
Tabla A/B/C con: **eje en una frase**, gancho cotidiano, actividad estrella, conexión con el curso,
esfuerzo (bajo/medio/alto) y riesgo. Cerrar con **una recomendación** y por qué.
Explicar antes el tema en 4 ideas simples: el profesor puede no dominarlo.

### 4. Actividades candidatas
Del banco de `plantillas.md` § 1, elegir 6–10 pertinentes, cada una con minutos, para qué sirve y
en qué sesión encajaría. Incluir el **cálculo de tiempo** de las sesiones reales (por ejemplo,
minutos por estudiante en una producción pública = (duración − apertura − cierre) ÷ N).
Respetar la filosofía del proyecto: ¿aporta al seguimiento que Moodle no recoge, o duplica trabajo?

### 5. Para ejecutar en NotebookLM (solo mostrar)
Rellenar con el tema las plantillas de `plantillas.md` § 2: prompt de **búsqueda de fuentes**,
prompt de **guía de lectura previa** (con referencias APA al final) y, opcionalmente, ideas para
el Studio (audio overview, mapa mental, cuestionario, tarjetas). Indicar qué revisar después
(citas textuales y referencias).

### 6. Para ejecutar en Gemini (solo mostrar): estilo + arquitectura slide a slide

**6.1 Decisión de estilo (la toma el profesor).** Ofrecer **3 estilos distintos entre sí** del
catálogo de `plantillas.md` § 3, cada uno con colores en hex, tipografías, motivo, tratamiento de
ilustraciones, cómo se ve un GANCHO frente a un AUTOR y un riesgo. Cada mazo debe verse distinto:
revisar los estilos de mazos anteriores (`ejemplo-*.md`, dossiers previos) y no repetirlos. Dejar
claro que puede mezclar o pedir otro. Hasta que elija, el encabezado del brief lleva
`ESTILO ELEGIDO: [por definir]`.

**6.2 Arquitectura completa.** Entregar el brief con el encabezado de `plantillas.md` § 4.1 y **una
ficha por cada diapositiva** (§ 4.2): tipo, tiempo, layout con zonas, texto en pantalla literal,
visual, color y énfasis, animación, notas del orador y consigna. Con ganchos antes de cada autor o
concepto (§ 4.3), referencias al final y tabla resumen de tiempos. Debe poder pegarse en Gemini sin
que este tenga que interpretar nada. Si la sesión es larga, marcar qué bloques son opcionales.

### 7. Promoción (solo propuesta)
Si el tema culmina en un evento público, proponer texto del afiche, formatos (horizontal para
diapositiva, vertical 4:5 para WhatsApp) y mensaje corto. No generar la imagen.

### 8. Cierre del dossier
- **Decisiones pendientes** (fecha, formato, tiempos, qué actividades) como preguntas cortas.
  **Siempre incluir la decisión de estilo visual** (colores, tipografías, motivo): elige el profesor.
- **Siguientes pasos** como menú, por ejemplo: "desarrolla la opción B", "arquitectura completa de
  slides", "genera el afiche", "planifica las sesiones", "aplica en la bitácora".

## Formato de la respuesta

Un solo dossier en español, con las secciones 1–8 numeradas, tablas donde ayuden y **sin relleno**.
Referencias, citas y fechas se escriben de memoria y se marcan "verificar". Verificar además el día
de la semana de cada fecha mencionada. Sin datos de estudiantes (solo cantidades). Si la prosa que
se entrega va a estudiantes, sugerir la skill `humanizar-textos` al desarrollarla.

## Ejemplo

Ver `ejemplo-giro-linguistico.md`: caso real de un dossier y de lo que se hizo después.
