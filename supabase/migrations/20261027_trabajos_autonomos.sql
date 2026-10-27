-- Trabajos autónomos con código y fases por semana.
-- Se muestran (sin copiar texto) como primera actividad de cada clase de las semanas siguientes a la asignación.

CREATE TABLE IF NOT EXISTS public.trabajo_autonomo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_asignacion DATE NOT NULL,
  num_semanas INTEGER NOT NULL DEFAULT 1 CHECK (num_semanas BETWEEN 1 AND 12),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (curso_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.trabajo_autonomo_fase (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabajo_id UUID NOT NULL REFERENCES public.trabajo_autonomo(id) ON DELETE CASCADE,
  semana_offset INTEGER NOT NULL CHECK (semana_offset BETWEEN 0 AND 12), -- 0 = clases posteriores en la misma semana; 1 = semana siguiente
  descripcion TEXT NOT NULL,
  UNIQUE (trabajo_id, semana_offset)
);

ALTER TABLE public.trabajo_autonomo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabajo_autonomo_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profesor_gestiona_trabajo_autonomo" ON public.trabajo_autonomo;
CREATE POLICY "profesor_gestiona_trabajo_autonomo" ON public.trabajo_autonomo
  FOR ALL USING (profesor_id = auth.uid()) WITH CHECK (profesor_id = auth.uid());

DROP POLICY IF EXISTS "profesor_gestiona_trabajo_autonomo_fase" ON public.trabajo_autonomo_fase;
CREATE POLICY "profesor_gestiona_trabajo_autonomo_fase" ON public.trabajo_autonomo_fase
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trabajo_autonomo t WHERE t.id = trabajo_id AND t.profesor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trabajo_autonomo t WHERE t.id = trabajo_id AND t.profesor_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_trabajo_autonomo_curso ON public.trabajo_autonomo (curso_id) WHERE activo;
