-- Campos de institución del tutorado en tutorado_perfil
ALTER TABLE public.tutorado_perfil
  ADD COLUMN IF NOT EXISTS universidad        TEXT,
  ADD COLUMN IF NOT EXISTS facultad           TEXT,
  ADD COLUMN IF NOT EXISTS carrera_tutorado   TEXT;
