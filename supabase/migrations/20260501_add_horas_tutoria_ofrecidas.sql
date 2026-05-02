ALTER TABLE public.profesores ADD COLUMN IF NOT EXISTS horas_tutoria_ofrecidas FLOAT DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_horas_tutoria(p_profesor_id UUID, p_horas FLOAT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profesores
  SET horas_tutoria_ofrecidas = COALESCE(horas_tutoria_ofrecidas, 0) + p_horas
  WHERE id = p_profesor_id;
END; $$;
