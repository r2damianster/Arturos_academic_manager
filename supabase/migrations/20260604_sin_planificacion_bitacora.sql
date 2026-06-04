-- Marca bitácoras creadas espontáneamente (sin planificación previa)
-- al tomar asistencia directamente desde la vista de planificación
ALTER TABLE bitacora_clase
  ADD COLUMN IF NOT EXISTS sin_planificacion BOOLEAN NOT NULL DEFAULT false;
