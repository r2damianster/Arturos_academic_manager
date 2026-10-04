-- Estado 'borrador' para planes nuevos creados por autoguardado en PlanificarModal.
-- Ciclo: borrador -> planificado (clic en "Guardar planificación") ; en_revision -> planificado (aprobar) ; -> cumplido.
-- El autoguardado nunca cambia el estado de un plan existente: solo crea filas nuevas como 'borrador'.

ALTER TABLE public.bitacora_clase
  DROP CONSTRAINT IF EXISTS bitacora_clase_estado_check;

ALTER TABLE public.bitacora_clase
  ADD CONSTRAINT bitacora_clase_estado_check
    CHECK (estado IN ('borrador', 'en_revision', 'planificado', 'cumplido', 'suspendido'));
