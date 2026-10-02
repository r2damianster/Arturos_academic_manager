---
name: dinamicas-juegos
description: Repositorio de dinámicas y juegos de aula (rompehielos, conocimiento del grupo, activación, cierre) reutilizables en cualquier asignatura. Referenciado por el skill subir-planificacion.
---

# 🎲 Repositorio de Dinámicas y Juegos
*Prof. Arturo Rodríguez — Gestor Universitario*

Catálogo de dinámicas y juegos presenciales de bajo costo (sin tecnología) para usar como **ACD** (actividad en aula). A diferencia de `recursos-investigacion.md`, estas dinámicas **no dependen del tema** del sílabo: se eligen por **propósito** (conocerse, activar, repasar, cerrar) y por **momento** de la sesión.

---

## 📋 Instrucciones de uso

- **Al planificar**: consultar este archivo según el propósito de la sesión (ver «Cuándo usar»). Ejemplo: primera sesión de un curso → dinámica de conocimiento del grupo.
- **Dónde va**: en `actividades_json` como una ACD. Formato: `ACD: Dinámica «<Nombre>» (<duración>) — <propósito en una línea>.` con `recurso` = `Repositorio de dinámicas: D##`.
- **Nunca** en `materiales` (no son slides) ni en `observaciones` (no son trabajo autónomo).
- **No sustituye** actividades del sílabo: se **agrega**. Si la sesión ya está llena, ubicarla al inicio (rompehielos) o al final (cierre) y avisar al profesor.
- **Nuevas dinámicas**: agregar con el siguiente `D##`. Si la propone la IA, dejar en **⬜ Pendientes de Revisión**; solo el profesor las aprueba.
- Nunca eliminar entradas aprobadas; si queda obsoleta, marcar `[OBSOLETA]`.

### Cuándo usar (propósito)

| Propósito | Momento | Dinámicas |
|---|---|---|
| 🤝 Conocimiento del grupo | Primera sesión de cualquier curso | D01 |

---

## ✅ Dinámicas Aprobadas

### D01 — La fiesta 🎉

| Campo | Detalle |
|---|---|
| **Propósito** | Conocerse: aprender los nombres de los compañeros y memorizarlos con apoyo de un objeto asociado a la inicial. |
| **Cuándo usar** | Primera sesión del curso (rompehielos). |
| **Tamaño de grupo** | 10–40 estudiantes (en grupos grandes, hacerlo por filas/subgrupos de ~12). |
| **Duración** | 10–20 min (según tamaño). |
| **Materiales** | Ninguno. Opcional: pizarra para anotar la lista. |
| **Tipo** | Memoria acumulativa / conocimiento del grupo. |

**Consigna:** «Vamos a una fiesta y cada uno debe traer algo.»

**Pasos:**
1. El grupo se ubica en círculo (o en fila) y se define el orden de intervención.
2. La primera persona dice su nombre y qué trae a la fiesta; **lo que trae debe empezar con la misma inicial de su nombre**. Ej.: «Me llamo *Ana* y traigo *aguacates*.»
3. La segunda persona **repite** lo de la primera y agrega lo suyo. Ej.: «Ella es *Ana* y trae *aguacates*; yo soy *Marco* y traigo *mangos*.»
4. Cada integrante nuevo repite **todos** los nombres y objetos anteriores, en orden, y añade el suyo.
5. La ronda termina con la última persona (o el profesor) repitiendo la lista completa.

**Reglas:**
- El objeto debe empezar con la inicial del **nombre** de pila de quien lo trae.
- No se pueden repetir objetos.
- Si alguien olvida un nombre/objeto, el grupo ayuda (el clima es de apoyo, no de eliminación).

**Variantes:**
- *Nivel fácil:* permitir apuntes o pista del grupo.
- *Nivel difícil:* agregar un adjetivo con la misma inicial («Ana trae aguacates apetitosos») o prohibir ayudas.
- *Cursos en inglés (ARW, ERD…):* hacerla en inglés — «I'm *Anna* and I bring *apples*» (práctica de vocabulario).
- *Temática:* en vez de «fiesta», usar un viaje, un picnic o «traigo algo de mi carrera» (vincula con el área profesional).

**Cierre sugerido (2 min):** preguntar «¿cómo ayudó la inicial a recordar?» → conectar con técnicas de memoria y con la importancia de conocer al grupo para el trabajo colaborativo durante el semestre.

**Usado en:** GAS Ses.1–2 · ODO Ses.1–2 · MED Ses.1–2 (2026-2).

---

## ⬜ Pendientes de Revisión

> Dinámicas propuestas por la IA. **Requieren aprobación del profesor** antes de pasar a Aprobados.

| # | Nombre tentativo | Propósito | Descripción breve | Fecha |
|---|------------------|-----------|-------------------|-------|

---

## 📌 Formato para agregar una dinámica

```
### D## — Nombre
| Campo | Detalle |
| Propósito | … |
| Cuándo usar | … |
| Tamaño de grupo | … |
| Duración | … |
| Materiales | … |
Consigna · Pasos · Reglas · Variantes · Cierre sugerido · Usado en
```
Y añadir su fila en la tabla «Cuándo usar (propósito)».
