-- Identidad persistente de estudiante entre semestres/instancias de curso.
-- Cada fila de estudiantes sigue siendo 1 matrícula por curso_id (asistencia/notas
-- resetean correctamente cada periodo). persona_id vincula matrículas de la misma
-- persona real a través de distintos curso_id — usado por "Duplicar curso" para
-- reconocer estudiantes que repiten y por la ficha de estudiante para mostrar
-- historial de periodos anteriores.
ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS persona_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_estudiantes_persona_id ON public.estudiantes(persona_id);
