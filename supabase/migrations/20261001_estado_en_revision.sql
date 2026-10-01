-- Estado 'en_revision' para planes de clase (p. ej. generados con IA) pendientes de aprobación.
-- Ciclo: en_revision -> planificado (aprobado) -> cumplido. 'suspendido' no cambia.

ALTER TABLE public.bitacora_clase
  DROP CONSTRAINT IF EXISTS bitacora_clase_estado_check;

ALTER TABLE public.bitacora_clase
  ADD CONSTRAINT bitacora_clase_estado_check
    CHECK (estado IN ('en_revision', 'planificado', 'cumplido', 'suspendido'));

-- Backfill: planes futuros ya cargados quedan por revisar (pasados y cumplidos intactos)
UPDATE public.bitacora_clase
   SET estado = 'en_revision'
 WHERE estado = 'planificado'
   AND fecha >= CURRENT_DATE
   AND COALESCE(sin_planificacion, false) = false;
