ALTER TABLE public.tutorado_perfil
  ADD COLUMN IF NOT EXISTS publicado             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_publicacion     DATE,
  ADD COLUMN IF NOT EXISTS referencia_publicacion TEXT;
