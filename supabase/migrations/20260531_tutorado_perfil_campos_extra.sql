-- Campos adicionales en tutorado_perfil: fechas de gestión + oficio
ALTER TABLE public.tutorado_perfil
  ADD COLUMN IF NOT EXISTS fecha_asignacion    DATE,
  ADD COLUMN IF NOT EXISTS num_periodos        INT DEFAULT 1 CHECK (num_periodos BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS fecha_proyectada_fin DATE,
  ADD COLUMN IF NOT EXISTS numero_oficio       TEXT;
