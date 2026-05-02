CREATE TABLE IF NOT EXISTS public.tutor_horas_semana (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  curso_id    UUID NOT NULL REFERENCES public.cursos(id)    ON DELETE CASCADE,
  fecha_semana DATE NOT NULL,
  horas        FLOAT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profesor_id, curso_id, fecha_semana)
);

ALTER TABLE public.tutor_horas_semana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profesor_gestiona_sus_horas"
  ON public.tutor_horas_semana FOR ALL
  USING (profesor_id = auth.uid());

CREATE POLICY "estudiante_ve_horas_su_curso"
  ON public.tutor_horas_semana FOR SELECT
  USING (
    curso_id IN (
      SELECT curso_id FROM public.estudiantes WHERE auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION acumular_horas_tutoria_semana(
  p_profesor_id UUID,
  p_curso_id    UUID,
  p_fecha_semana DATE,
  p_horas       FLOAT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.tutor_horas_semana(profesor_id, curso_id, fecha_semana, horas)
  VALUES (p_profesor_id, p_curso_id, p_fecha_semana, p_horas)
  ON CONFLICT (profesor_id, curso_id, fecha_semana)
  DO UPDATE SET horas = tutor_horas_semana.horas + EXCLUDED.horas;
END; $$;
