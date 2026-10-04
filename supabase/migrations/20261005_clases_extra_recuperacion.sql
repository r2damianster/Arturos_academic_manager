-- Clases fuera del horario regular: recuperación, continuación y extra.
-- Una sesión de este tipo vive en bitacora_clase con fecha/hora libres.
--   tipo = 'regular'      → clase normal (default, comportamiento histórico)
--   tipo = 'recuperacion' → recupera una clase suspendida/no dada (vínculo opcional)
--   tipo = 'continuacion' → completa una clase dada a medias (vínculo opcional)
--   tipo = 'extra'        → sesión adicional sin vínculo
-- hora_inicio_manual / hora_fin_manual reemplazan el horario de horarios_clases
-- (Modo Clase y exportación Moodle CSV).

ALTER TABLE public.bitacora_clase
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS recupera_bitacora_id UUID
    REFERENCES public.bitacora_clase(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS hora_inicio_manual TIME,
  ADD COLUMN IF NOT EXISTS hora_fin_manual TIME;

ALTER TABLE public.bitacora_clase
  DROP CONSTRAINT IF EXISTS bitacora_clase_tipo_check;

ALTER TABLE public.bitacora_clase
  ADD CONSTRAINT bitacora_clase_tipo_check
    CHECK (tipo IN ('regular', 'recuperacion', 'continuacion', 'extra'));

CREATE INDEX IF NOT EXISTS idx_bitacora_recupera
  ON public.bitacora_clase(recupera_bitacora_id)
  WHERE recupera_bitacora_id IS NOT NULL;

COMMENT ON COLUMN public.bitacora_clase.tipo IS
  'regular | recuperacion | continuacion | extra. Las no regulares pueden caer fuera de horarios_clases.';
COMMENT ON COLUMN public.bitacora_clase.recupera_bitacora_id IS
  'Clase original que esta sesión recupera o continúa (opcional).';
