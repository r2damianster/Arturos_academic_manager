-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCIONES DE BASE DE DATOS
-- ═══════════════════════════════════════════════════════════════════════════

-- Calcula la semana actual de un curso basado en fecha_inicio
CREATE OR REPLACE FUNCTION calcular_semana(p_curso_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_inicio DATE;
  v_fin    DATE;
  v_hoy    DATE := CURRENT_DATE;
  v_semana INTEGER;
BEGIN
  SELECT fecha_inicio, fecha_fin
  INTO v_inicio, v_fin
  FROM cursos
  WHERE id = p_curso_id;

  IF v_inicio IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_hoy < v_inicio THEN
    RETURN 'Semana 0';
  END IF;
  IF v_fin IS NOT NULL AND v_hoy > v_fin THEN
    RETURN 'Curso finalizado';
  END IF;

  v_semana := FLOOR((v_hoy - v_inicio) / 7) + 1;
  RETURN 'Semana ' || v_semana;
END;
$$;

-- Obtiene estadísticas de asistencia para un estudiante en un curso
CREATE OR REPLACE FUNCTION stats_asistencia(p_estudiante_id UUID, p_curso_id UUID)
RETURNS TABLE(
  total_sesiones  BIGINT,
  presentes       BIGINT,
  ausentes        BIGINT,
  atrasos         BIGINT,
  porcentaje      NUMERIC,
  promedio_part   NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)                                                AS total_sesiones,
    COUNT(*) FILTER (WHERE estado = 'Presente')            AS presentes,
    COUNT(*) FILTER (WHERE estado = 'Ausente')             AS ausentes,
    COUNT(*) FILTER (WHERE atraso = TRUE)                  AS atrasos,
    ROUND(
      COUNT(*) FILTER (WHERE estado = 'Presente')::NUMERIC
      / NULLIF(COUNT(*), 0) * 100, 1
    )                                                       AS porcentaje,
    (SELECT ROUND(AVG(nivel)::NUMERIC, 1)
     FROM participacion p
     WHERE p.estudiante_id = p_estudiante_id
       AND p.curso_id = p_curso_id)                        AS promedio_part
  FROM asistencia a
  WHERE a.estudiante_id = p_estudiante_id
    AND a.curso_id = p_curso_id;
END;
$$;
