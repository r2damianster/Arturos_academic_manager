-- Distingue el comentario generado automáticamente desde una rúbrica del escrito por el profesor.
-- Un comentario automático se regenera al recalcular; uno manual (o vaciado a propósito) no se toca.
ALTER TABLE public.calificaciones_items
  ADD COLUMN IF NOT EXISTS comentario_auto BOOLEAN NOT NULL DEFAULT false;
