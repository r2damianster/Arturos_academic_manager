-- Columna para silenciar alertas automáticas por curso
-- Shape: { riesgo: boolean, encuesta_parcial: boolean, riesgo_excluidos: string[] }
ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS alertas_silenciadas JSONB NOT NULL DEFAULT '{}';
