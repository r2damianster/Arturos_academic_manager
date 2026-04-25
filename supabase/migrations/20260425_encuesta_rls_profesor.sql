-- Permite al profesor leer las encuestas de sus propios estudiantes.
-- La tabla fue creada desde el dashboard sin política para el rol profesor.

ALTER TABLE public.encuesta_estudiante ENABLE ROW LEVEL SECURITY;

-- Profesor: leer encuestas de estudiantes vinculados a él
DROP POLICY IF EXISTS "profesor_lee_encuestas_sus_estudiantes" ON public.encuesta_estudiante;
CREATE POLICY "profesor_lee_encuestas_sus_estudiantes"
  ON public.encuesta_estudiante
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.estudiantes est
      WHERE est.auth_user_id = encuesta_estudiante.auth_user_id
        AND est.profesor_id = auth.uid()
    )
  );

-- Estudiante: leer y escribir solo su propia fila
DROP POLICY IF EXISTS "estudiante_own_encuesta" ON public.encuesta_estudiante;
CREATE POLICY "estudiante_own_encuesta"
  ON public.encuesta_estudiante
  FOR ALL
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
