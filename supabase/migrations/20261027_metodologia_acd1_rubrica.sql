-- ACD1 (Metodología de Investigación II, ULEAM, Parcial 1): rúbrica sobre 4 + notas calculadas.
-- Curso: 1212364 (c7464bad-ddaa-42d1-b964-f83ad60dcd14). Idempotente.
--
-- Criterios (total 4):
--   1. Asistencia (2.0): obligatoria, 31-ago → 23-oct, bandas >=100 %:2.0, >=85 %:1.5, >=75 %:1.0, >=60 %:0.5.
--   2. Participación (2.0): promedio de niveles, nivel 1 = 0, nivel 5 = 100 %.
--      Solo existe una fecha registrada (7-oct). Decisión del profesor: quien no fue evaluado esa
--      fecha recibe nivel 5 (ponderación alta); quienes tuvieron nivel bajo conservan su nivel.
--
-- Las notas se calculan aquí con las mismas reglas del motor (src/lib/rubrica-calculo.ts).
-- Para recalcular con el motor de la app basta pulsar ↻ en la columna ACD1.

-- 1) Participación por defecto (nivel 5) para quien no tiene registro el 7-oct
INSERT INTO public.participacion (profesor_id, curso_id, estudiante_id, fecha, semana, nivel, observacion)
SELECT c.profesor_id, c.id, e.id, DATE '2026-10-07',
       (SELECT p.semana FROM public.participacion p
         WHERE p.curso_id = c.id AND p.fecha = DATE '2026-10-07' LIMIT 1),
       5,
       'ACD1: sin registro de bajo desempeño; nivel alto por defecto (decisión del profesor)'
FROM public.cursos c
JOIN public.estudiantes e ON e.curso_id = c.id AND e.estado = 'activo'
WHERE c.id = 'c7464bad-ddaa-42d1-b964-f83ad60dcd14'
  AND NOT EXISTS (
    SELECT 1 FROM public.participacion p
    WHERE p.curso_id = c.id AND p.estudiante_id = e.id AND p.fecha = DATE '2026-10-07')
ON CONFLICT DO NOTHING;

-- 2) Definición de la rúbrica
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
          'desde', '2026-08-31', 'hasta', '2026-10-23'))
      ),
      jsonb_build_object(
        'nombre', 'Participación en Clases',
        'puntosMax', 2,
        'modo', 'lineal',
        'fuentes', jsonb_build_array(jsonb_build_object(
          'tipo', 'participacion', 'escalaMax', 5, 'escalaMin', 1, 'obligatoria', false,
          'desde', '2026-08-31', 'hasta', '2026-10-23'))
      )
    )
  )
FROM public.cursos c
WHERE c.id = 'c7464bad-ddaa-42d1-b964-f83ad60dcd14'
ON CONFLICT (curso_id, parcial, nombre_columna)
DO UPDATE SET definicion = EXCLUDED.definicion, escala_salida = EXCLUDED.escala_salida;

-- 3) Notas calculadas por estudiante activo (fuente = 'rubrica'; no toca comentarios existentes)
WITH cur AS (
  SELECT c.id, c.profesor_id FROM public.cursos c WHERE c.id = 'c7464bad-ddaa-42d1-b964-f83ad60dcd14'
),
fechas AS (
  SELECT DISTINCT fecha FROM (
    SELECT a.fecha FROM public.asistencia a, cur WHERE a.curso_id = cur.id
    UNION
    SELECT b.fecha FROM public.bitacora_clase b, cur WHERE b.curso_id = cur.id AND b.estado = 'cumplido'
  ) u WHERE fecha BETWEEN DATE '2026-08-31' AND DATE '2026-10-23'
),
est AS (
  SELECT e.id FROM public.estudiantes e, cur WHERE e.curso_id = cur.id AND e.estado = 'activo'
),
asistencia_calc AS (
  SELECT est.id,
    (SELECT count(*) FROM fechas) AS sesiones,
    (SELECT COALESCE(sum(
        COALESCE((SELECT max(CASE a.estado WHEN 'Presente' THEN 1 WHEN 'Atraso' THEN 1 ELSE 0 END)
                  FROM public.asistencia a, cur
                  WHERE a.estudiante_id = est.id AND a.curso_id = cur.id AND a.fecha = f.fecha), 0)), 0)
      FROM fechas f) AS suma
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
        AND p.fecha BETWEEN DATE '2026-08-31' AND DATE '2026-10-23'
    ) - 1) / 4)) * 2, 2), 0) AS pts
  FROM est
)
INSERT INTO public.calificaciones_items
  (profesor_id, curso_id, estudiante_id, parcial, categoria, nombre_item, tipo, nota, fuente, import_id, updated_at)
SELECT cur.profesor_id, cur.id, est.id, 1, NULL, 'ACD1 - Portafolio de actividades', 'tarea',
       round(a.pts + p.pts, 2), 'rubrica', NULL, NOW()
FROM cur, est
JOIN asistencia_pts a    ON a.id = est.id
JOIN participacion_pts p ON p.id = est.id
ON CONFLICT (curso_id, estudiante_id, parcial, nombre_item)
DO UPDATE SET nota = EXCLUDED.nota, fuente = 'rubrica', updated_at = NOW();
