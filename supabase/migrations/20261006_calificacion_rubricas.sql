-- Rúbricas de cálculo: definen cómo se calcula una columna de calificaciones_items.
-- La definición (criterios, fuentes, escalas, obligatoriedad) vive en JSONB, validada con Zod en la app.
-- El resultado por estudiante se guarda como ítems con fuente='rubrica'.
CREATE TABLE IF NOT EXISTS public.calificacion_rubricas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id    UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id       UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  parcial        SMALLINT NOT NULL CHECK (parcial BETWEEN 1 AND 4),
  nombre_columna TEXT NOT NULL,
  escala_salida  NUMERIC(5,2),
  definicion     JSONB NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (curso_id, parcial, nombre_columna)
);

CREATE INDEX IF NOT EXISTS idx_cal_rubricas_curso ON public.calificacion_rubricas(curso_id);

ALTER TABLE public.calificacion_rubricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profesor_own_cal_rubricas ON public.calificacion_rubricas;
CREATE POLICY profesor_own_cal_rubricas ON public.calificacion_rubricas
  FOR ALL
  USING  (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_cal_rubricas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cal_rubricas_updated_at ON public.calificacion_rubricas;
CREATE TRIGGER trg_cal_rubricas_updated_at
  BEFORE UPDATE ON public.calificacion_rubricas
  FOR EACH ROW EXECUTE FUNCTION public.update_cal_rubricas_updated_at();

-- Los resultados calculados se guardan como ítems con fuente 'rubrica'
ALTER TABLE public.calificaciones_items DROP CONSTRAINT IF EXISTS calificaciones_items_fuente_check;
ALTER TABLE public.calificaciones_items
  ADD CONSTRAINT calificaciones_items_fuente_check
  CHECK (fuente IN ('moodle', 'manual', 'en_curso', 'rubrica'));
