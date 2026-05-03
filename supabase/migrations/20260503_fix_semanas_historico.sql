-- Fix: recalcular semanas en participacion con semanas académicas (lunes-domingo)
-- Solo corrige Semana 0, mantiene intactos los cambios manuales
UPDATE participacion
SET semana = CASE
  WHEN participacion.fecha::DATE < DATE_TRUNC('week', c.fecha_inicio)::DATE THEN 'Semana 0'
  WHEN c.fecha_fin IS NOT NULL AND participacion.fecha::DATE > c.fecha_fin THEN 'Curso finalizado'
  ELSE 'Semana ' || (FLOOR((participacion.fecha::DATE - DATE_TRUNC('week', c.fecha_inicio)::DATE) / 7) + 1)::TEXT
END
FROM cursos c
WHERE participacion.curso_id = c.id
  AND participacion.semana = 'Semana 0';

-- Mismo para asistencia
UPDATE asistencia
SET semana = CASE
  WHEN asistencia.fecha::DATE < DATE_TRUNC('week', c.fecha_inicio)::DATE THEN 'Semana 0'
  WHEN c.fecha_fin IS NOT NULL AND asistencia.fecha::DATE > c.fecha_fin THEN 'Curso finalizado'
  ELSE 'Semana ' || (FLOOR((asistencia.fecha::DATE - DATE_TRUNC('week', c.fecha_inicio)::DATE) / 7) + 1)::TEXT
END
FROM cursos c
WHERE asistencia.curso_id = c.id
  AND asistencia.semana = 'Semana 0';

