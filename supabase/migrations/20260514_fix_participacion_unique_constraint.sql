-- Fix: add missing unique constraint on participacion(curso_id, estudiante_id, fecha)
-- Without this, upsert with onConflict silently failed and no participation was ever saved.
CREATE UNIQUE INDEX participacion_curso_estudiante_fecha_key
  ON public.participacion (curso_id, estudiante_id, fecha);
