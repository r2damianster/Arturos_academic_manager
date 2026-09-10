---
name: registrar-clase
description: Planifica una sesión de clase (bitácora), la marca como cumplida y registra la asistencia de los estudiantes a partir de una descripción en lenguaje natural (curso, fecha/semana, tema, actividades, recursos y lista de asistentes). Úsalo cuando el usuario pida planificar, registrar o "cerrar" una clase — pasada o futura — del gestor universitario. Funciona igual con Claude Code, con Antigravity, o con cualquier agente que tenga acceso a la base de datos Supabase del proyecto (vía MCP o vía `supabase` CLI/SQL Editor).
---

# Registrar una clase (planificación + cumplido + asistencia)

Este skill reproduce, de forma repetible, el flujo que normalmente se hace a mano en
`/dashboard/planificacion` → `/dashboard/modo-clase/[bitacoraId]` → pase de lista, pero
partiendo de una descripción libre en texto (lo que el profesor escribe en el chat) en vez
de clics en la UI. Sirve tanto para **registrar clases que ya pasaron** (backfill) como
para **planificar clases futuras** (sin marcar asistencia todavía).

**Regla de oro: nunca escribir en la base de datos sin antes mostrar el plan completo al
usuario y esperar confirmación explícita.** Esto es lo que el usuario llama "planifica
antes de aplicar". Los únicos casos donde se puede saltar la confirmación son ediciones
triviales ya confirmadas en el mismo turno (p. ej. corregir un solo campo tras la
aprobación del plan).

---

## Cuándo usar este skill

- "Planifica la clase del [fecha/semana] con este contenido: ..."
- "Registra la asistencia de la clase de ayer, asistieron: ..."
- "Marca como cumplida la clase del [curso] del [fecha]"
- Cualquier pedido que combine: tema/actividades de una sesión + (opcional) lista de
  asistentes, para un curso ya existente en el sistema.

No usar este skill para: crear el curso desde cero (eso es alta de curso — otro flujo),
ni para calificaciones/trabajos (tablas `calificaciones`, `trabajos_asignados`).

---

## Fase 0 — Elegir cómo se va a ejecutar

Hay dos caminos válidos. Elegir uno según las herramientas disponibles en la sesión:

**A) Vía SQL directo contra Supabase (recomendado para agentes headless — Claude Code,
Antigravity sin navegador, etc.)** — es el camino probado en este proyecto. Requiere
acceso a un MCP de Supabase (`execute_sql`) o al SQL Editor del dashboard, apuntando al
**proyecto correcto**:

| Entorno | project_id / URL |
|---|---|
| Producción (Vercel, estudiantes reales) | `hxsnyrutyyavvljxwgku` |
| Local/dev (`.env.local`) | `vylkasmcveazzaspwgcr` |

**Siempre preguntar al usuario cuál de los dos, si no es obvio por contexto** — escribir
asistencia/bitácora en el proyecto equivocado es difícil de notar y molesto de revertir.

**B) Vía la app real, logueado como el profesor (recomendado si el agente controla un
navegador — Claude in Chrome, Antigravity con browser tool, Playwright, etc.)** — más
lento pero pasa por los Server Actions (`crearOActualizarPlanificacion`,
`confirmarCumplido`, `registrarAsistencia`) y por tanto respeta `revalidatePath`, RLS de
sesión real y cualquier lógica adicional (cierre de grupos de afinidad, etc.) sin que el
agente tenga que reimplementarla. Usar el flujo normal: `/dashboard/planificacion` →
clic en la celda del día → completar modal → `▶ Iniciar clase` o `/dashboard/modo-clase/
[bitacoraId]` → pase de lista → finalizar.

Este documento detalla el camino **A** paso a paso porque es el que no tiene UI que lo
guíe. Si se usa el camino **B**, las fases 1–4 (identificación, fechas, contenido,
asistentes) siguen aplicando igual para armar el plan; solo cambia cómo se aplica (fase 6).

---

## Fase 1 — Identificar profesor y curso

1. Resolver `profesor_id`:
   ```sql
   select id, nombre, email, rol from profesores where email = '<email del usuario>';
   ```
2. Resolver `curso_id` a partir de lo que el usuario mencionó (nombre de asignatura,
   código, paralelo, periodo). Si hay ambigüedad (varios cursos con nombre parecido, o
   varios periodos), **preguntar antes de seguir**:
   ```sql
   select id, codigo, asignatura, periodo, fecha_inicio, fecha_fin, tipo
   from cursos where profesor_id = '<profesor_id>' and asignatura ilike '%<texto>%';
   ```
3. Traer el horario semanal del curso (necesario para calcular horas de la sesión y para
   convertir "primera semana" / nombres de días en fechas concretas):
   ```sql
   select dia_semana, hora_inicio, hora_fin, tipo
   from horarios_clases where curso_id = '<curso_id>' order by dia_semana;
   ```
4. Traer el roster completo del curso (se usa en la Fase 4):
   ```sql
   select id, nombre, email, estado from estudiantes
   where curso_id = '<curso_id>' order by nombre;
   ```

---

## Fase 2 — Resolver fecha(s) de la(s) sesión(es) y la "semana"

- Si el usuario da una fecha exacta, usarla directamente.
- Si el usuario dice algo relativo ("primera semana", "la clase de ayer", "clase del
  viernes pasado"), calcularla a partir de `cursos.fecha_inicio` y `horarios_clases.
  dia_semana`: la semana N cubre desde `lunes_inicio + 7*(N-1)` días. Ojo:
  `fecha_inicio` del curso puede no ser lunes — igual la semana académica se cuenta desde
  el lunes de esa semana (`DATE_TRUNC('week', fecha_inicio)`).
- Si el curso tiene más de un día de clase por semana (p. ej. miércoles y viernes),
  decidir si el contenido descrito corresponde a **una sola sesión** o si conviene
  **repartirlo entre los días de esa semana** (típico: teoría/socialización un día,
  evaluación/actividad práctica el otro). Esto es una decisión pedagógica — **proponerla
  en el plan y dejar que el usuario la confirme o la corrija**, no asumirla en silencio.
- Etiqueta `semana` (columna texto, formato `'Semana N'`). **No usar la función RPC
  `calcular_semana(curso_id)` para clases retroactivas**: esa función calcula la semana
  relativa a `CURRENT_DATE` (hoy), no a la fecha de la sesión que se está registrando —
  da resultados incorrectos al hacer backfill de clases pasadas. Calcularla a mano:
  ```sql
  select 'Semana ' || (floor((date '<fecha_sesion>' - date_trunc('week', c.fecha_inicio)::date) / 7) + 1)::int
  from cursos c where c.id = '<curso_id>';
  ```
- Horas de la sesión = duración del bloque en `horarios_clases` para ese día (ej.
  15:00–17:00 → 2.0 horas). Usar ese número en `asistencia.horas`.

---

## Fase 3 — Armar el contenido de la bitácora

Extraer del texto libre del usuario:

- **tema** (obligatorio, `NOT NULL`): título corto de la sesión.
- **actividades**: qué se hizo/hará (texto plano; hay también `actividades_json` para
  checklists estructuradas usadas por Modo Clase — dejar `[]` si no se usa esa vista).
- **materiales**: links o recursos (diapositivas, documentos). Si el usuario pega un link
  de Google Slides/Docs, va aquí tal cual.
- **observaciones**: notas adicionales, contexto, decisiones metodológicas.

Si el contenido se reparte entre varios días de la semana (ver Fase 2), armar **una fila
de bitácora por fecha**, cada una con su propio tema/actividades — no meter todo en una
sola fila con fecha ambigua.

**Antes de insertar, revisar si ya existe una bitácora para ese `curso_id` + `fecha`**
(no hay constraint UNIQUE en la tabla, así que un INSERT ciego puede duplicar filas que
el pase de lista real sí evita):
```sql
select id, estado from bitacora_clase where curso_id = '<curso_id>' and fecha = '<fecha>';
```
- Si existe y `estado <> 'cumplido'`: UPDATE en vez de INSERT.
- Si existe y `estado = 'cumplido'`: **no sobrescribir sin confirmación explícita** — avisar
  al usuario que esa clase ya está cerrada.
- Si no existe: INSERT.

---

## Fase 4 — Resolver la lista de asistentes contra el roster

El usuario normalmente escribe nombres sueltos, apodos o con errores de tipeo
("maria tubar", "soledispa" sin apellido, "anthony" en vez de "Antony Bazurto"). Hacer
fuzzy-match contra el roster de la Fase 1 punto 4:

1. Para cada nombre mencionado, buscar candidatos en el roster por coincidencia parcial
   (nombre de pila, apellido, o ambos).
2. Si hay **un solo candidato razonable**, asumirlo pero **listarlo en el plan** para que
   el usuario lo vea (puede corregir si está mal).
3. Si hay **ambigüedad real** (dos estudiantes con apellido parecido, o el nombre dado
   podría ser cualquiera de dos personas — como pasó con dos "Soledispa" en el mismo
   curso), **preguntar explícitamente antes de aplicar** (usar una pregunta de selección,
   no asumir).
4. Los estudiantes del roster **no mencionados** se registran como `Ausente` — pero avisar
   cuántos son y quiénes, porque puede que el usuario simplemente se haya olvidado de
   nombrarlos y en realidad sí asistieron.
5. Confirmar con el usuario si la lista de asistencia aplica a **todas** las fechas de esa
   semana (si se repartió en varios días) o solo a una — no asumir que es igual en ambos
   días sin preguntar.

---

## Fase 5 — Presentar el plan y esperar confirmación (checkpoint obligatorio)

Mostrar al usuario, en un mensaje claro (no aplicar todavía):

1. Curso y fecha(s) resueltas + a qué "semana" corresponden.
2. Contenido de cada fila de bitácora (tema / actividades / materiales / observaciones).
3. Lista de presentes (con el nombre completo del roster al lado de lo que el usuario
   escribió, para que note cualquier match incorrecto) y lista de ausentes.
4. Cualquier ambigüedad detectada, como preguntas puntuales (`AskUserQuestion` o
   equivalente) — nombres dudosos, reparto de contenido entre días, si la clase ya pasó
   y por tanto debe quedar `cumplido` vs si es futura y debe quedar `planificado`.

Solo tras la confirmación del usuario pasar a la Fase 6.

---

## Fase 6 — Aplicar (camino SQL directo)

### 6.1 — Bitácora (una fila por fecha)

```sql
insert into bitacora_clase (profesor_id, curso_id, fecha, semana, tema, actividades, materiales, observaciones, estado)
values ('<profesor_id>', '<curso_id>', '<fecha>', '<Semana N>', '<tema>', '<actividades>', '<materiales o null>', '<observaciones o null>', 'planificado')
returning id;
```
(Usar `update ... where id = '<bitacora_id>'` en vez de `insert` si la Fase 3 encontró una
fila existente sin cumplir.)

Guardar el `id` devuelto — se necesita como `bitacora_id` en la asistencia.

### 6.2 — Asistencia (una fila por estudiante × por fecha)

`estado` acepta exactamente `'Presente' | 'Ausente' | 'Atraso'` (mayúscula inicial,
constraint `asistencia_estado_check`). Hay `UNIQUE(curso_id, estudiante_id, fecha)`, así
que usar `ON CONFLICT ... DO UPDATE` en vez de un `insert` simple si existe el riesgo de
volver a correr esto sobre la misma fecha:

```sql
insert into asistencia (profesor_id, curso_id, estudiante_id, fecha, semana, estado, atraso, horas, bitacora_id)
values ('<profesor_id>', '<curso_id>', '<estudiante_id>', '<fecha>', '<Semana N>', '<Presente|Ausente>', false, <horas_sesion>, '<bitacora_id>')
on conflict (curso_id, estudiante_id, fecha) do update
  set estado = excluded.estado, horas = excluded.horas, bitacora_id = excluded.bitacora_id, semana = excluded.semana;
```

Repetir para los 1..N estudiantes del roster (presentes según Fase 4, el resto
`'Ausente'`) y para cada fecha de la semana si el contenido se repartió en varios días.

### 6.3 — Marcar la clase como cumplida (solo si la sesión ya ocurrió)

Si la fecha de la bitácora es `<= CURRENT_DATE` (la clase ya se dio), cerrarla:

```sql
update bitacora_clase set estado = 'cumplido' where id = '<bitacora_id>';
```

**Si la fecha es futura, NO tocar `estado`** — debe quedar `'planificado'` (el valor por
defecto), porque la clase todavía no se dictó. Este paso es el que se pasó por alto la
primera vez que se hizo este flujo a mano — sin él, la UI de `/dashboard/planificacion`
sigue mostrando "▶ Iniciar clase" en vez de "Ver resumen" aunque ya haya asistencia
cargada.

`estado` solo acepta `'planificado' | 'cumplido' | 'suspendido'` (constraint
`bitacora_clase_estado_check`).

---

## Fase 7 — Verificar y reportar

1. Releer lo insertado para confirmar conteos:
   ```sql
   select b.fecha, b.estado, count(a.id) as registros,
          count(*) filter (where a.estado = 'Presente') as presentes,
          count(*) filter (where a.estado = 'Ausente') as ausentes
   from bitacora_clase b
   left join asistencia a on a.bitacora_id = b.id
   where b.curso_id = '<curso_id>' and b.fecha in (<fechas>)
   group by b.fecha, b.estado order by b.fecha;
   ```
2. Reportar al usuario: fechas registradas, estado final de cada una, conteo
   presentes/ausentes, y dónde revisarlo en la app (`/dashboard/cursos/<curso_id>/
   pase-lista`, `/asistencia`, o `/dashboard/planificacion`).
3. **Aviso importante si se usó el camino SQL directo**: al escribir directo en la base
   sin pasar por los Server Actions, Next.js no revalida su caché automáticamente. Si el
   usuario tiene la página abierta, puede necesitar recargarla (F5) para ver el cambio.

---

## Errores ya encontrados al hacer esto a mano (para no repetirlos)

- `dia_semana` en `horarios`/`horarios_clases` exige **tilde**: `'miércoles'`, `'sábado'`
  (el CHECK constraint falla en silencio con un error de Postgres si se manda sin tilde).
- `calcular_semana(curso_id)` (RPC) es relativo a **hoy**, no a la fecha de la sesión —
  no usarlo para backfill de clases pasadas (ver Fase 2).
- Olvidar el paso 6.3 deja la clase "planificada" para siempre aunque ya tenga asistencia
  cargada — la UI no la muestra como finalizada.
- Sin el `ON CONFLICT` en asistencia, volver a correr el mismo registro sobre la misma
  fecha choca contra `asistencia_curso_id_estudiante_id_fecha_key`.
- Confirmar siempre `project_id` de Supabase (producción vs local) antes de escribir —
  ver tabla en Fase 0.
