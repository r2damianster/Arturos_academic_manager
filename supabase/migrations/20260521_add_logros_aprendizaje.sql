-- Tabla de logros/objetivos de aprendizaje por curso
CREATE TABLE IF NOT EXISTS public.logros_aprendizaje (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id    UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logros_aprendizaje ENABLE ROW LEVEL SECURITY;

-- Profesor lee/escribe logros de sus propios cursos
CREATE POLICY "profesor_logros_aprendizaje"
  ON public.logros_aprendizaje
  USING (
    curso_id IN (
      SELECT id FROM public.cursos WHERE profesor_id = auth.uid()
    )
  )
  WITH CHECK (
    curso_id IN (
      SELECT id FROM public.cursos WHERE profesor_id = auth.uid()
    )
  );
