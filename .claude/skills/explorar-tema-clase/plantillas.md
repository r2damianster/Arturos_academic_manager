# Plantillas del skill `explorar-tema-clase`

Rellenar los `[CORCHETES]` con el tema. Estas plantillas se **muestran**; el profesor las copia y las
ejecuta en NotebookLM o Gemini.

## 1. Banco de actividades (con tiempos típicos)

| Actividad | Qué es | Min |
|---|---|---|
| Apertura y reglas | Propósito y reglas (p. ej. celulares guardados) | 5 |
| **Control de lectura con ruleta** | Ruleta simple (`/dashboard/herramientas`). Quien sale explica con sus palabras lo dicho por el compañero anterior y la idea que manifiesta, y aporta la suya. Solo apuntes escritos o texto impreso. Registrar con `evaluar-participacion` | 30 (≈20 estudiantes) |
| **Gancho cotidiano** | Escena "Vas por la calle y de pronto… ¿qué pasaría si…?" antes de cada autor o concepto | 1 por autor |
| Exposición docente | Slides con idea central, ejemplo y consigna corta por autor | 15–35 |
| Discusión | Pregunta abierta; parejas 3 min y plenaria | 5–10 |
| Implicaciones en educación | Qué cambia en el aula, la evaluación, el uso de IA | 5 |
| Taller individual o grupal | Producir algo (escritura, guion, mapa) con retroalimentación en pares | 40–85 |
| Producción pública | Podcast, microclase o debate, con rúbrica corta | 60–120 |
| Recursos opcionales | Película, charla, consulta con IA; pasar a trabajo autónomo si falta tiempo | 14 |
| Cierre | Puente al siguiente tema y consigna de trabajo autónomo | 5–15 |

Patrones que funcionaron: revisión de proyectos y tutorías **en paralelo** a la escritura individual;
guía de lectura entregada en la sesión previa y evaluada con control de lectura; producción oral de
1 minuto con rúbrica de 4 criterios (1 punto cada uno).

## 2. Prompts de NotebookLM

### 2.1 Búsqueda de fuentes (Añadir fuentes → Descubrir)

```
Busca fuentes académicas y de divulgación, preferiblemente en español y de acceso abierto, sobre
[TEMA] en [DISCIPLINA] y su relación con la educación. Quiero acceder a los textos o a resúmenes
fiables de estos autores y obras:
- [AUTOR 1] ([OBRA]: [concepto])
- [AUTOR 2] ([OBRA]: [concepto])
Prioriza: capítulos o fragmentos originales, artículos de revistas indexadas (Scielo, Redalyc,
Dialnet), enciclopedias (Stanford Encyclopedia of Philosophy, Enciclopedia Herder) y material
universitario. Incluye 2 fuentes que conecten el tema con la práctica docente. Excluye blogs sin
autoría y resúmenes de estudiantes.
```
Después de importar: comprobar que haya fuentes reales de cada autor (a veces solo trae resúmenes).

### 2.2 Guía de lectura previa (Studio → Informes → Personalizar)

```
Redacta una GUÍA DE LECTURA PREVIA para estudiantes universitarios de [CARRERA], sin formación en
[DISCIPLINA], sobre [TEMA]. Es la lectura que harán antes de la clase. Extensión: 6 a 8 páginas.
Tono claro, cercano y académico; frases cortas; sin jerga sin explicar. Usa SOLO las fuentes
cargadas; si algo no está en ellas, dilo en lugar de inventarlo.
Estructura:
1. Para qué leer esto (3-4 líneas) y 3 preguntas guía.
2. Idea central del tema en un párrafo.
3. Autores y conceptos clave, uno por sección: quién fue (2 líneas), obra principal, concepto
   central con palabras simples, ejemplo cotidiano y cita breve textual solo si aparece en las fuentes.
4. Otros aportes relacionados.
5. Implicaciones para la educación (4-5 ideas con ejemplos).
6. Mapa de conceptos: tabla autor | concepto | ejemplo | implicación educativa.
7. Glosario de 10 términos.
8. Actividad de pre-lectura conectada con la tarea de la clase (3 preguntas).
9. Referencias en APA 7, solo de las fuentes realmente usadas, en orden alfabético.
Cita en el texto en formato APA (Autor, año). No agregues referencias que no estén en las fuentes.
Marca con [verificar] cualquier dato que no puedas respaldar con ellas.
```
Después: revisar citas textuales contra las fuentes y las referencias APA (traductor, año de reedición).

### 2.3 Ideas opcionales del Studio
Audio overview como calentamiento; mapa mental del tema; cuestionario o tarjetas para el control de
lectura; preguntas de chat tipo "Compara a [A], [B] y [C] en una tabla: idea central, ejemplo
cotidiano, implicación en el aula".

## 3. Brief para Gemini (esqueleto de slides)

```
Crea una presentación de [N] diapositivas, 16:9, en español, sobre [TEMA] para estudiantes de
[CARRERA]. Reglas: usa el texto literal que te doy; no inventes citas ni datos; máximo 35
palabras por diapositiva salvo consignas; notas del orador en el panel de notas; ilustraciones
estilizadas, no fotos. Sistema visual: [paleta hex], títulos [tipografía], cuerpo [tipografía]
mínimo 24 pt, animación solo fade con clic. Tipos de diapositiva: GANCHO (fondo oscuro, escena
cotidiana + pregunta enorme, etiqueta "¿Qué pasaría si…?"); AUTOR (ilustración 35 %, nombre y obra,
idea central en una frase, "en una imagen", consigna); RECURSO/TALLER (tarjetas numeradas).
Estructura: 1 portada · 2 gancho general · 3 ruta · 4 punto de partida · [gancho + autor] por cada
autor · discusión · implicaciones en educación · recursos opcionales · taller y consigna · cierre ·
referencias.
```
La arquitectura detallada (texto literal, layout, visual, animación, notas y minutos por
diapositiva) se produce solo si el profesor la pide.

## 4. Promoción (solo propuesta)

- Texto del afiche entre comillas con ortografía exacta; sin logos oficiales ni letreros no pedidos.
- Formatos: 16:9 horizontal para la diapositiva final; 4:5 vertical para WhatsApp; 9:16 para Estados.
- Mensaje de WhatsApp: título en negritas con asteriscos, una línea de gancho, fecha, hora, medio y
  enlace, cierre con invitación; 5–8 emojis como máximo.
