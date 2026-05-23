-- Habilitar/deshabilitar encuestas por curso
ALTER TABLE cursos
  ADD COLUMN IF NOT EXISTS encuesta_inicial_habilitada  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS encuesta_parcial_habilitada  BOOLEAN NOT NULL DEFAULT TRUE;
