---
name: html-uleam-moodle
description: Genera directamente por semanas el HTML educativo para Moodle de la ULEAM (solo ULEAM; para UTE usar html-ute-moodle). Lee la planificación de la semana en Supabase (bitacora_clase) y entrega un bloque HTML por semana, listo para pegar en el editor de código de Moodle, con CSS inline, paleta pastel variada, Reading Capsule APA 7, tarjetas de contexto y presentaciones/videos embebidos en iframe. Úsalo cuando el profesor diga "html ULEAM", "gema ULEAM", "html de la semana N", "genera las semanas 3 a 5", "recursos de la semana para Moodle ULEAM".
---

# html ULEAM para Moodle (solo ULEAM)

> Alcance: proyecto gestor-universitario-next. Solo lectura en la base de datos.
> Origen: Gema de Gemini del profesor, convertida en skill. Los iframes SÍ se permiten en Moodle ULEAM (en UTE no).

## Entrada y generación por semanas

`/html-uleam-moodle <curso> semana N` · `semanas N-M` · `todas`. Si falta el curso, buscar el activo que calce; si hay duda, preguntar una sola vez.

**Una semana = un bloque HTML completo.** Con varias semanas, un bloque ```html``` por semana, en orden.

### Obtener los datos de la semana (SELECT, nunca escribir)
```sql
select id, asignatura, periodo, fecha_inicio from cursos
where estado='activo' and asignatura ilike '%<palabra>%';

select fecha, semana, estado, tema, actividades_json, observaciones, materiales
from bitacora_clase where curso_id='<curso>' and semana = <N> order by fecha;
```
(`cursos` filtra siempre `estado='activo'`.) De `tema`, `actividades_json` y `materiales` salen:
título/subtítulo, enlaces de presentaciones, videos, carpetas y la lectura. Si la base no está accesible, pedir al profesor que pegue el plan de la semana.

- **Nunca inventar** autores, años, editoriales, DOI ni URLs. Lo que falte se deja como comentario HTML `<!-- FALTA: ... -->` dentro del bloque.
- **Sin repetir recursos entre semanas**: cada recurso va en la semana donde la planificación lo programa; si otra semana lo menciona, una línea sin repetir enlace.
- No incluir nombres, correos ni IDs de estudiantes.

## Regla de oro de entrega

Responder **única y exclusivamente** con bloque(s) de código ```html ... ```. Sin saludo, sin explicación antes ni después, sin texto entre bloques. Los avisos (datos APA faltantes, enlaces dudosos) van como comentarios HTML dentro del bloque.

## 1. Estándares de código

- CSS **estrictamente inline** (`style="..."`). Prohibido `<style>`, `<script>`, `<html>`, `<head>`, `<body>`.
- Un único `<div>` contenedor: `max-width:900px; margin:0 auto; font-family:'Segoe UI', Arial, sans-serif;`.
- iFrame: `width:100%; height:500px; border:none; allowfullscreen`, dentro de contenedor con `border-radius:12px; box-shadow:0 5px 15px rgba(0,0,0,0.05); overflow:hidden`.
- Formato "lectura larga": un solo contenedor vertical. Síntesis extrema: máximo 1-2 oraciones breves por descripción.

## 2. Paleta visual (pastel variada, nunca púrpura dominante)

- Mezclar pasteles: azul pastel, verde menta, turquesa suave, amarillo crema, naranja melocotón, rosa pastel, coral suave, lavanda, lila, celeste. No usar todos en una página; cada tarjeta/bloque puede llevar uno distinto.
- Variar la elección entre semanas/páginas para que no sean copias; no repetir la combinación de la semana anterior.
- Bordes en un tono algo más intenso que el fondo. Botones: versión más intensa del pastel con texto blanco o negro de contraste suficiente.
- Texto principal oscuro neutro (`#2c3e50` o similar). Nada fluorescente ni saturado en exceso. Estética académica, editorial, limpia.

## 3. Secuencia exacta de componentes

1. **`<header>`**: `<h1>` de 28px + `<p>` subtítulo conciso; fondo pastel/acento propio.
2. **Reading Capsule**: fondo pastel suave, borde izquierdo destacado de color complementario, referencia **APA 7 completa** con el título en negrita, enlace directo «Access Reading Capsule →».
3. **`<section>` Contexto/Conceptos**: párrafo ultra sintético (máx. 2 líneas) + flex (`gap:20px; flex-wrap:wrap`) con 2-3 tarjetas de fondos pastel variados, borde algo más intenso, `border-radius:12px`.
4. **`<section>` por cada recurso multimedia/presentación**: emoji, tipo de recurso, `<h2>` de 22px, descripción de 1 oración, botón-pastilla centrado (`target="_blank"`), contenedor del `<iframe>` (500px, 100%, sin borde, `allowfullscreen`). Cada bloque puede llevar su color.
5. **`<footer>` Key Takeaway**: fondo pastel suave, borde izquierdo de 6px de acento contrastante, `border-radius:12px`, «💡 Key Takeaway:» con síntesis de máx. 2 líneas; color distinto a los demás componentes.

## 4. Decisión por tipo de URL

| URL | Acción |
|---|---|
| Presentación individual | **Iframe + botón** externo (el botón no sustituye al iframe) |
| Video individual | **Iframe + botón** externo |
| Carpeta compartida | **Solo botón/enlace** externo; jamás iframe ni convertirla en URL de presentación |
| Varias presentaciones | Un bloque completo **por cada una**; nunca fusionar, resumir ni omitir una válida |
| Mezcla presentaciones + carpetas | Embeber todas las presentaciones; las carpetas solo como enlace |

Para embeber usar la URL de incrustación del servicio (p. ej. Google Slides `.../embed`, YouTube `/embed/ID`) derivada de la URL directa dada; si no se puede derivar con certeza, dejar el botón y un `<!-- FALTA: URL de embebido -->`.
