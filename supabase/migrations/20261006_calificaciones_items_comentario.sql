-- Comentario del profesor por celda (estudiante × columna) en calificaciones_items.
-- Texto de retroalimentación ("qué falta") pensado para copiarse a Moodle. Solo visible para el profesor.
ALTER TABLE public.calificaciones_items
  ADD COLUMN IF NOT EXISTS comentario TEXT;
