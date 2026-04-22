-- Descripción: Agrega hora_inicio_real a bitacora_clase para registrar
--              el momento exacto en que el profesor inicia la clase.
--              NULL = clase no iniciada (solo planificada).
--              NOT NULL = clase en progreso o finalizada.
-- Fecha: 2026-04-22
-- Autor: ArturoPC

ALTER TABLE public.bitacora_clase
  ADD COLUMN IF NOT EXISTS hora_inicio_real TIMESTAMPTZ;

COMMENT ON COLUMN public.bitacora_clase.hora_inicio_real IS
  'Momento exacto en que el profesor inició la clase. NULL = no iniciada todavía. NOT NULL = en progreso o finalizada.';
