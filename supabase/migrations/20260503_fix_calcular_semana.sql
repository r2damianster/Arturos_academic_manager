-- Fix: calcular_semana con semanas académicas (lunes a domingo)
CREATE OR REPLACE FUNCTION calcular_semana(p_curso_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_inicio DATE;
  v_fin    DATE;
  v_hoy    DATE := CURRENT_DATE;
  v_semana INTEGER;
  v_lunes_inicio DATE; -- Lunes de la semana académica que contiene fecha_inicio
BEGIN
  SELECT
    COALESCE(fecha_inicio, created_at::DATE),
    fecha_fin
  INTO v_inicio, v_fin
  FROM cursos
  WHERE id = p_curso_id;

  IF v_inicio IS NULL THEN
    RETURN NULL;
  END IF;

  -- Encontrar el lunes de la semana que contiene fecha_inicio
  -- DATE_TRUNC('week', fecha) da el lunes de esa semana en PostgreSQL
  v_lunes_inicio := DATE_TRUNC('week', v_inicio)::DATE;

  IF v_hoy < v_lunes_inicio THEN
    RETURN 'Semana 0';
  END IF;

  IF v_fin IS NOT NULL AND v_hoy > v_fin THEN
    RETURN 'Curso finalizado';
  END IF;

  -- Calcular semana académica: FLOOR((fecha - lunes_inicio) / 7) + 1
  v_semana := FLOOR((v_hoy - v_lunes_inicio) / 7) + 1;
  RETURN 'Semana ' || v_semana;
END;
$$;

