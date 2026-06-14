-- Suspensión de clases: feriados, paros, suspensiones por asignatura/fecha
-- Nuevo estado 'suspendido' en bitacora_clase + razón opcional

ALTER TABLE public.bitacora_clase
  DROP CONSTRAINT IF EXISTS bitacora_clase_estado_check;

ALTER TABLE public.bitacora_clase
  ADD CONSTRAINT bitacora_clase_estado_check
    CHECK (estado IN ('planificado', 'cumplido', 'suspendido'));

ALTER TABLE public.bitacora_clase
  ADD COLUMN IF NOT EXISTS razon_suspension TEXT;

COMMENT ON COLUMN public.bitacora_clase.razon_suspension IS
  'Motivo de suspensión cuando estado = suspendido (ej: Feriado nacional, Paro)';
