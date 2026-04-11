-- Módulo de Planificación de Clases
-- Permite planificar actividades antes de clase y vincularlas al pase de lista

-- 1. bitacora_clase: estado del ciclo + actividades estructuradas
ALTER TABLE public.bitacora_clase
  ADD COLUMN IF NOT EXISTS estado text DEFAULT 'planificado'
    CHECK (estado IN ('planificado', 'cumplido')),
  ADD COLUMN IF NOT EXISTS actividades_json jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bitacora_clase.estado IS
  'planificado = antes de clase | cumplido = actividades confirmadas durante pase de lista';
COMMENT ON COLUMN public.bitacora_clase.actividades_json IS
  'Array de objetos: [{"actividad":"...", "recurso":"..."}]';

-- 2. asistencia: referencia a la bitácora de la sesión
ALTER TABLE public.asistencia
  ADD COLUMN IF NOT EXISTS bitacora_id uuid
    REFERENCES public.bitacora_clase(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.asistencia.bitacora_id IS
  'Vincula cada registro de asistencia a la bitácora (planificación) de esa sesión';
