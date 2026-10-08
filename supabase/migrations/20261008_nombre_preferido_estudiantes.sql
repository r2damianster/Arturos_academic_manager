-- Nombre preferido: cómo el estudiante pide que lo llamen en clase.
-- Solo informal (pase de lista / modo clase). Reportes y registros usan siempre estudiantes.nombre.
ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS nombre_preferido TEXT;

ALTER TABLE public.estudiantes
  DROP CONSTRAINT IF EXISTS estudiantes_nombre_preferido_largo;
ALTER TABLE public.estudiantes
  ADD CONSTRAINT estudiantes_nombre_preferido_largo
  CHECK (nombre_preferido IS NULL OR char_length(nombre_preferido) BETWEEN 1 AND 40);
