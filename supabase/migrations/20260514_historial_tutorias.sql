-- Add columns to reservas for manual tutoring registration and historial filtering

-- 1. Add profesor_id for direct ownership (needed for manual entries without horario_id)
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS profesor_id UUID REFERENCES public.profesores(id) ON DELETE CASCADE;

-- 2. Backfill profesor_id from horarios for existing records
UPDATE public.reservas r
SET profesor_id = h.profesor_id
FROM public.horarios h
WHERE r.horario_id = h.id
  AND r.profesor_id IS NULL;

-- 3. Add origen to distinguish entry type
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'agendada';

-- 4. Add curso_id for course filtering
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL;

-- 5. Add manual time fields (for entries without horario_id)
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS hora_inicio_manual TIME;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS hora_fin_manual TIME;

-- 6. Make horario_id nullable for manual entries
ALTER TABLE public.reservas ALTER COLUMN horario_id DROP NOT NULL;

-- 7. Update RLS to include profesor_id-based access for manual entries
DROP POLICY IF EXISTS "profesor_gestiona_reservas" ON public.reservas;
DROP POLICY IF EXISTS "estudiante_ve_sus_reservas" ON public.reservas;

CREATE POLICY "profesor_gestiona_reservas" ON public.reservas
  FOR ALL
  USING (
    profesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.horarios h
      WHERE h.id = reservas.horario_id
        AND h.profesor_id = auth.uid()
    )
  );

CREATE POLICY "estudiante_ve_sus_reservas" ON public.reservas
  FOR SELECT
  USING (auth_user_id = auth.uid());
