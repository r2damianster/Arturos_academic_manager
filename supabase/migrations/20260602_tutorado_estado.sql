ALTER TABLE public.tutorado_perfil
  ADD COLUMN IF NOT EXISTS estado        TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','finalizado')),
  ADD COLUMN IF NOT EXISTS finalizado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resultado     TEXT
    CHECK (resultado IN ('graduado','aprobado','abandono','otro')),
  ADD COLUMN IF NOT EXISTS nota_final    TEXT;
