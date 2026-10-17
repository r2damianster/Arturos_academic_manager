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
| Mención de bibliografía | Presentar los textos base y que cada estudiante elija uno para explorar | 5 |
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
lectura; pregunta de chat tipo "Compara a [A], [B] y [C] en una tabla: idea central, ejemplo
cotidiano, implicación en el aula".

## 3. Catálogo de estilos visuales (el profesor ELIGE; cada mazo es distinto)

Regla: **no usar un estilo por defecto**. Antes de la arquitectura, ofrecer **3 estilos distintos
entre sí** y distintos de los últimos mazos del curso (revisar `ejemplo-*.md` y dossiers previos;
el mazo del giro lingüístico usó marino + ámbar + crema, con Playfair Display e Inter). El profesor
puede mezclar, cambiar colores o pedir otro. Validar contraste de texto ≥ 4,5:1 antes de entregar.

| Estilo | Fondo | Texto | Acento 1 | Acento 2 | Títulos / cuerpo | Motivo y tratamiento | Cuándo |
|---|---|---|---|---|---|---|---|
| **Laboratorio vivo** | `#F7F5F0` | `#1F2933` | `#0E8F6B` | `#FF6B4A` | Space Grotesk / Inter | Diagramas de líneas, nodos y ondas; ilustración vectorial plana | Temas científicos, cognitivos, de procesos |
| **Editorial kraft** | `#E9DCC3` | `#2B2118` | `#B3262D` | `#1D3557` | DM Serif Display / Source Sans 3 | Collage de recortes, sellos, tipografía enorme; ilustración en duotono | Ensayo, crítica, historia de ideas |
| **Bloques lúdicos** | `#FFC93C` | `#111111` | `#1B4DFF` | `#FFFFFF` | Fredoka / Nunito | Formas geométricas tipo bloques, iconos gruesos; ilustración plana con contorno | Infancia, aprendizaje, talleres dinámicos |
| **Pizarra** | `#1F3D36` | `#F2F2EA` | `#F4D35E` | `#8ED1B2` | Patrick Hand / Nunito | Trazos de tiza, flechas dibujadas a mano; ilustración lineal | Clases explicativas, pasos, fundamentos |
| **Minimal suizo** | `#FFFFFF` | `#111111` | `#E10600` | `#9AA0A6` | Inter Tight / Inter | Grilla rígida, mucho aire, una sola imagen; ilustración monocroma | Temas analíticos, definiciones, datos |
| **Cálido humano** | `#3A1F1A` | `#FFE9DA` | `#FFB38A` | `#2EC4B6` | Fraunces / Work Sans | Texturas suaves, retratos en grabado; ilustración en acuarela digital | Ética, sociología, emociones, comunicación |

Cada propuesta de estilo se presenta con: nombre, los 4 colores en hex, tipografías (Google Fonts),
motivo, tratamiento de ilustraciones, cómo se ve un GANCHO frente a un AUTOR, y un riesgo
(p. ej. "el amarillo cansa en proyector con luz").

## 4. Arquitectura de slides para Gemini (slide a slide)

### 4.1 Encabezado del brief

```
Crea una presentación de [N] diapositivas, 16:9, en español, sobre [TEMA] para estudiantes de
[CARRERA]. Usa el texto en pantalla EXACTAMENTE como te lo doy. No inventes citas, datos ni
referencias. Máximo 35 palabras por diapositiva salvo consignas, taller y referencias. Las notas
del orador van en el panel de notas. Ilustraciones estilizadas, no fotos reales de personas.

ESTILO ELEGIDO: [nombre]
- Colores: fondo [#], texto [#], acento 1 [#], acento 2 [#]
- Títulos: [fuente] 40-48 pt · Cuerpo: [fuente] mínimo 24 pt
- Motivo gráfico: [motivo] · Tratamiento de ilustraciones: [tratamiento]
- GANCHO: fondo [color inverso o acento], una escena y una pregunta enorme, sin viñetas
- AUTOR: ilustración 35 % a la izquierda; a la derecha nombre y obra, idea central en una frase,
  "En una imagen" y consigna en caja de acento
- TALLER/RECURSO: tarjetas numeradas sobre fondo base
- Animación: solo aparición suave (fade) con clic
```

### 4.2 Ficha por diapositiva (repetir para cada una)

```
Diapositiva [n] — [nombre]
- Tipo: GANCHO | AUTOR | RECURSO | TALLER | CIERRE | REFERENCIAS
- Tiempo: [min]
- Layout: [zonas con porcentajes, qué va arriba/izquierda/derecha/abajo]
- Texto en pantalla (literal):
    Etiqueta: "..."
    Título: "..."
    Cuerpo: "..." (viñetas solo si hace falta)
    Pie: "..."
- Visual: [qué ilustrar, composición, qué NO dibujar]
- Color y énfasis: [qué usa acento 1 / acento 2]
- Animación: [orden de aparición por clic]
- Notas del orador: [3-5 líneas en lenguaje simple, con qué respuesta esperar]
- Consigna al estudiante: "..." (si la hay)
```

### 4.3 Reglas de contenido

- **Gancho antes de cada autor o concepto:** escena cotidiana + "¿Qué pasaría si…?" + pregunta
  que dispare la idea ("Vas por la calle y de pronto alguien… ¿mismas palabras, mismo significado?").
- **Autor:** idea central en UNA frase; ejemplo cotidiano; consigna de 30 segundos.
- **Citas:** solo las que el profesor provea o marcadas "verificar en tu edición".
- **Recursos sin enlace:** marco de video vacío con "Insertar [recurso] aquí" y la consigna lista;
  alternativa sin video (consulta con IA) cuando convenga.
- **Referencias:** copiar tal cual en dos columnas al final; advertir "verificar".
- **Cierre del documento:** tabla resumen de bloques con minutos y cuáles son opcionales.

## 5. Promoción (solo propuesta)

- Texto del afiche entre comillas con ortografía exacta; sin logos oficiales ni letreros no pedidos.
- Estilo del afiche: el mismo estilo elegido para el mazo.
- Formatos: 16:9 horizontal para la diapositiva final; 4:5 vertical para WhatsApp; 9:16 para Estados.
- Mensaje de WhatsApp: título en negritas con asteriscos, una línea de gancho, fecha, hora, medio y
  enlace, cierre con invitación; 5–8 emojis como máximo.
