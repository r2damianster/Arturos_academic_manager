# Testing — Sesión 24-25 (2026-05-27)

> Estado: [ ] Pendiente  [~] En pruebas  [x] Confirmado  [!] Bug encontrado
>
> Actualizado por cron de seguimiento. Editar directamente o dejar que el agente lo actualice.

---

## Batch 1 — Panel de riesgo y exportación

### F1 — Riesgo multivariable
- **Ruta:** `/dashboard/cursos/[id]`
- **Qué probar:** panel "En riesgo" muestra badges por factor (asistencia, participación, notas en curso, trabajos acumulados). Borde rojo cuando ≥3 factores. Header dinámico (no fijo "asistencia < 75%").
- **Estado:** [ ]
- **Notas:**

### F2 — Export dataset investigación
- **Ruta:** `/dashboard/cursos/[id]` → botón "Exportar dataset"
- **Qué probar:** descarga CSV con columnas `id_anonimizado, asistencia_pct, participacion_avg, trabajos_completados, trabajos_activos, notas_en_curso_pct, autopercepcion_aprendizaje, esfuerzo_dedicado, comprension_temas_propia, preparacion_evaluacion, cumplimiento_entregas`. IDs en primeros 8 chars del UUID.
- **Estado:** [ ]
- **Notas:**

### F3 — Comparativa autopercepción (KEYHOLE)
- **Ruta:** `/dashboard/cursos/[id]/encuesta-parcial`
- **Qué probar:** nueva tabla "Autopercepción Lingüística — Evolución" entre Comparativa IA y Distribución dificultades. 5 dimensiones con delta (↑↓=). Si no hay encuesta inicial → subtítulo "Sin datos de encuesta inicial para comparar".
- **Estado:** [ ]
- **Notas:**

### F4 — Notificaciones proactivas
- **Ruta:** `/dashboard` (panel principal)
- **Qué probar:** panel de notificaciones al tope de la página. Detecta: estudiantes en riesgo, encuesta parcial pendiente, cursos sin bitácora esta semana, reservas sin confirmar. Botón X cierra la notificación (sessionStorage, reaparece al reabrir el browser).
- **Estado:** [ ]
- **Notas:**

---

## Batch 2 — Trayectoria y portal estudiante

### F5 — Trayectoria del estudiante
- **Ruta:** cualquier página con FichaEstudianteDrawer (pase de lista, modo clase, asistencia) → abrir drawer → tab "Trayectoria"
- **Qué probar:** tabla semanal (Semana / Asistencia% / P/A counts / Participación avg) con colores semáforo. 2 cards de tendencia al pie (↑↓= para asistencia y participación). Si no hay datos suficientes → muestra estado vacío.
- **Estado:** [ ]
- **Notas:**

### F6 — Mi Progreso (portal estudiante)
- **Ruta:** `/student` → tarjeta de cada curso
- **Qué probar:** widget "Mi Progreso" con barra ponderada (40% asistencia / 30% participación / 30% trabajos). Barras individuales por métrica. Chips de tutorías (asistidas/faltadas).
- **Estado:** [ ]
- **Notas:**

### F7 — Retroalimentación formativa IA
- **Ruta:** `/student` → botón "Ver retroalimentación" por curso (requiere GROQ_API_KEY activa en Vercel)
- **Qué probar:** estado idle → loading → 3 párrafos (Fortalezas / Oportunidades / Estrategias). Fallback amigable si GROQ_API_KEY falta. Esquema violeta.
- **Estado:** [ ]
- **Notas:**

---

## Batch 3 — Cierre de parcial y reemplazantes

### F8 — Cierre de Parciales
- **Ruta:** `/dashboard/cursos/[id]` → panel "Cierre de Parciales" (colapsable, debajo del panel de riesgo)
- **Qué probar:**
  1. Expandir panel → muestra "Parcial 1 pendiente"
  2. Click "Cerrar Parcial 1" → confirmación → guardar → snapshot aparece en la lista
  3. Expandir snapshot → métricas globales + tabla por estudiante
  4. Botón eliminar snapshot → confirmación inline → desaparece
  5. No permite cerrar el mismo parcial dos veces (error claro)
- **Estado:** [ ]
- **Notas:**
- **Migración aplicada:** `20260527_snapshot_parcial` ✓

### F9 — Acceso de Reemplazante Temporal
- **Ruta:** `/dashboard/config` → panel "Reemplazantes temporales" (al pie del tab Perfil)
- **Qué probar (gestión):**
  1. Expandir panel → ver explicación de cómo funciona
  2. "Agregar reemplazante" → nombre + email + fechas → guardar
  3. Toggle activo/inactivo
  4. Eliminar con confirmación
- **Qué probar (acceso como reemplazante) — requiere cuenta externa:**
  1. Registrar cuenta con el email del reemplazante en `/auth/login`
  2. Iniciar sesión → debe ver banner ámbar "Modo Reemplazante"
  3. Intentar ir a `/dashboard/cursos/[id]/editar` → redirige al dashboard
  4. Intentar `/dashboard/config` → redirige al dashboard
  5. `/dashboard/planificacion` y `/dashboard/cursos/[id]/pase-lista` → accesibles
- **Estado:** [ ]
- **Notas:**
- **Migración aplicada:** `20260527_reemplazantes` ✓

---

## Bugs encontrados

<!-- Registrar bugs aquí con fecha y descripción -->

---

## Refactors sesión (verificar regresiones)

- [ ] Nav sidebar/mobile sincronizado via `nav-items.tsx` — verificar que los 5 ítems aparecen en móvil y desktop
- [ ] `confirmarCumplido` reemplaza `finalizarClase` — verificar que botón "Finalizar clase" en modo clase funciona
- [ ] `/calificaciones/config` redirige a `/editar?tab=evaluacion` — verificar que no hay loop
