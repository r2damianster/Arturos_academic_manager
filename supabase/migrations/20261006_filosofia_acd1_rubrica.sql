-- ACD1 - Portafolio de actividades (Filosofía, Parcial 1): rúbrica de cálculo + notas calculadas.
-- Curso: FESE262A (3409c0a6-d716-490b-a6ca-3b437be3494e). Idempotente: se puede correr más de una vez.
--
-- Criterios (sobre 6; talleres físicos y fichas de lectura se califican en Moodle):
--   1. Participación (2.0): promedio de niveles 10-sep → 5-oct, nivel 1 = 0, nivel 5 = 100 %. No obligatoria.
--   2. Asistencia (2.0): obligatoria, 31-ago → 5-oct, bandas >=100 %:2.0, >=85 %:1.5, >=75 %:1.0, >=60 %:0.5.
--   3. Creatividad y debate (2.0): Anime y Paulo Freire obligatorias, R2 Argumentum no obligatoria (sobre 10 c/u).
-- Ingreso tardío: solo Sherlyn Melina Cheme Mero (sin registros antes del 10-sep) cuenta desde el 14-sep.
--
-- Las notas se calculan aquí con las mismas reglas del motor de la app (src/lib/rubrica-calculo.ts).
-- Para recalcular con el motor de la app basta pulsar ↻ en la columna ACD1.

-- 1) Definición de la rúbrica
INSERT INTO public.calificacion_rubricas (profesor_id, curso_id, parcial, nombre_columna, escala_salida, definicion)
SELECT
  c.profesor_id,
  c.id,
  1,
  'ACD1 - Portafolio de actividades',
  NULL,
  jsonb_build_object(
    'criterios', jsonb_build_array(
      jsonb_build_object(
        'nombre', 'Participación en Clases',
        'puntosMax', 2,
        'modo', 'lineal',
        'fuentes', jsonb_build_array(jsonb_build_object(
          'tipo', 'participacion', 'escalaMax', 5, 'escalaMin', 1, 'obligatoria', false,
          'desde', '2026-09-10', 'hasta', '2026-10-05'))
      ),
      jsonb_build_object(
        'nombre', 'Asistencia y Puntualidad',
        'puntosMax', 2,
        'modo', 'bandas',
        'bandas', jsonb_build_array(
          jsonb_build_object('desde', 1,    'puntos', 2),
          jsonb_build_object('desde', 0.85, 'puntos', 1.5),
          jsonb_build_object('desde', 0.75, 'puntos', 1),
          jsonb_build_object('desde', 0.6,  'puntos', 0.5)),
        'fuentes', jsonb_build_array(jsonb_build_object(
          'tipo', 'asistencia', 'escalaMax', 100, 'obligatoria', true, 'valorAtraso', 1,
          'desde', '2026-08-31', 'hasta', '2026-10-05'))
      ),
      jsonb_build_object(
        'nombre', 'Creatividad Propositiva, Debate y Otros Aportes',
        'puntosMax', 2,
        'modo', 'lineal',
        'fuentes', jsonb_build_array(
          jsonb_build_object('tipo', 'item', 'itemNombre', 'Actividad en clase: Imagen/Documento Anime (10-Sep)',
            'itemParcial', 1, 'escalaMax', 10, 'obligatoria', true),
          jsonb_build_object('tipo', 'item', 'itemNombre', 'Control de lectura: Videos de Paulo Freire',
            'itemParcial', 1, 'escalaMax', 10, 'obligatoria', true),
          jsonb_build_object('tipo', 'item', 'itemNombre', 'R2 Argumentum: ¿Qué hace único al ser humano?',
            'itemParcial', 1, 'escalaMax', 10, 'obligatoria', false))
      )
    ),
    'ingresoTardio', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('estudianteId', e.id, 'desde', '2026-09-14'))
      FROM public.estudiantes e
      WHERE e.curso_id = c.id AND e.nombre = 'Sherlyn Melina Cheme Mero'
    ), '[]'::jsonb)
  )
FROM public.cursos c
WHERE c.id = '3409c0a6-d716-490b-a6ca-3b437be3494e'
ON CONFLICT (curso_id, parcial, nombre_columna)
DO UPDATE SET definicion = EXCLUDED.definicion, escala_salida = EXCLUDED.escala_salida;

-- 2) Notas calculadas por estudiante activo (fuente = 'rubrica'; no toca comentarios existentes)
WITH cur AS (
  SELECT c.id, c.profesor_id FROM public.cursos c WHERE c.id = '3409c0a6-d716-490b-a6ca-3b437be3494e'
),
fechas AS (
  SELECT DISTINCT fecha FROM (
    SELECT a.fecha FROM public.asistencia a, cur WHERE a.curso_id = cur.id
    UNION
    SELECT b.fecha FROM public.bitacora_clase b, cur WHERE b.curso_id = cur.id AND b.estado = 'cumplido'
  ) u WHERE fecha IS NOT NULL
),
est AS (
  SELECT e.id,
         CASE WHEN e.nombre = 'Sherlyn Melina Cheme Mero' THEN DATE '2026-09-14' END AS ingreso
  FROM public.estudiantes e, cur
  WHERE e.curso_id = cur.id AND e.estado = 'activo'
),
asistencia_calc AS (
  SELECT est.id,
    (SELECT count(*) FROM fechas f
      WHERE f.fecha BETWEEN GREATEST(DATE '2026-08-31', COALESCE(est.ingreso, DATE '2026-08-31')) AND DATE '2026-10-05') AS sesiones,
    (SELECT COALESCE(sum(
        COALESCE((SELECT max(CASE a.estado WHEN 'Presente' THEN 1 WHEN 'Atraso' THEN 1 ELSE 0 END)
                  FROM public.asistencia a, cur
                  WHERE a.estudiante_id = est.id AND a.curso_id = cur.id AND a.fecha = f.fecha), 0)), 0)
      FROM fechas f
      WHERE f.fecha BETWEEN GREATEST(DATE '2026-08-31', COALESCE(est.ingreso, DATE '2026-08-31')) AND DATE '2026-10-05') AS suma
  FROM est
),
asistencia_pts AS (
  SELECT id,
    CASE
      WHEN sesiones = 0 THEN 0
      WHEN suma::numeric / sesiones >= 1    THEN 2
      WHEN suma::numeric / sesiones >= 0.85 THEN 1.5
      WHEN suma::numeric / sesiones >= 0.75 THEN 1
      WHEN suma::numeric / sesiones >= 0.6  THEN 0.5
      ELSE 0
    END AS pts
  FROM asistencia_calc
),
participacion_pts AS (
  SELECT est.id,
    COALESCE(round((LEAST(1, GREATEST(0, (
      SELECT avg(p.nivel)::numeric FROM public.participacion p, cur
      WHERE p.estudiante_id = est.id AND p.curso_id = cur.id AND p.nivel IS NOT NULL
        AND p.fecha BETWEEN GREATEST(DATE '2026-09-10', COALESCE(est.ingreso, DATE '2026-08-31')) AND DATE '2026-10-05'
    ) - 1) / 4)) * 2, 2), 0) AS pts
  FROM est
),
items_calc AS (
  SELECT est.id,
    COALESCE((SELECT nota FROM public.calificaciones_items i, cur WHERE i.estudiante_id = est.id AND i.curso_id = cur.id
              AND i.parcial = 1 AND i.nombre_item = 'Actividad en clase: Imagen/Documento Anime (10-Sep)'), 0) AS anime,
    COALESCE((SELECT nota FROM public.calificaciones_items i, cur WHERE i.estudiante_id = est.id AND i.curso_id = cur.id
              AND i.parcial = 1 AND i.nombre_item = 'Control de lectura: Videos de Paulo Freire'), 0) AS freire,
    (SELECT nota FROM public.calificaciones_items i, cur WHERE i.estudiante_id = est.id AND i.curso_id = cur.id
              AND i.parcial = 1 AND i.nombre_item = 'R2 Argumentum: ¿Qué hace único al ser humano?') AS r2
  FROM est
),
creatividad_pts AS (
  SELECT id,
    round(((LEAST(1, GREATEST(0, anime / 10.0)) + LEAST(1, GREATEST(0, freire / 10.0))
            + COALESCE(LEAST(1, GREATEST(0, r2 / 10.0)), 0))
           / (2 + CASE WHEN r2 IS NULL THEN 0 ELSE 1 END)) * 2, 2) AS pts
  FROM items_calc
)
INSERT INTO public.calificaciones_items
  (profesor_id, curso_id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, fuente, import_id, updated_at)
SELECT cur.profesor_id, cur.id, est.id, 1, NULL, 'ACD1 - Portafolio de actividades', 'tarea',
       round(a.pts + p.pts + c.pts, 2), 'rubrica', NULL, NOW()
FROM cur, est
JOIN asistencia_pts a     ON a.id = est.id
JOIN participacion_pts p  ON p.id = est.id
JOIN creatividad_pts c    ON c.id = est.id
ON CONFLICT (curso_id, estudiante_id, parcial, nombre_item)
DO UPDATE SET nota = EXCLUDED.nota, fuente = 'rubrica', updated_at = NOW();
