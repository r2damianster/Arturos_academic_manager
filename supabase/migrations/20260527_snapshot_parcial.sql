-- Snapshot formal de cierre de parcial
CREATE TABLE IF NOT EXISTS public.snapshot_parcial (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  numero_parcial INTEGER NOT NULL CHECK (numero_parcial BETWEEN 1 AND 4),
  fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  semana_cierre TEXT,
  resumen JSONB NOT NULL DEFAULT '{}',
  UNIQUE(curso_id, numero_parcial)
);

ALTER TABLE public.snapshot_parcial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profesor_full_snapshots"
  ON public.snapshot_parcial FOR ALL
  USING (profesor_id = auth.uid());
