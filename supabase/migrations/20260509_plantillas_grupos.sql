-- Plantillas de grupos: agregar columnas es_plantilla y plantilla_nombre
ALTER TABLE public.grupos_clase
  ADD COLUMN IF NOT EXISTS es_plantilla BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plantilla_nombre TEXT;

-- Índice para queries de plantillas por profesor
CREATE INDEX IF NOT EXISTS idx_grupos_clase_plantilla
  ON public.grupos_clase (profesor_id, es_plantilla, plantilla_nombre)
  WHERE es_plantilla = true;
