ALTER TABLE estudiantes
  ADD COLUMN estado text NOT NULL DEFAULT 'activo',
  ADD COLUMN retirado_at timestamptz NULL;
