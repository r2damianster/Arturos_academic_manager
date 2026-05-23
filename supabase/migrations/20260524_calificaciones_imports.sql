-- Historial de imports de calificaciones desde Moodle.
-- snapshot_antes permite revertir el import restaurando el estado previo.
CREATE TABLE IF NOT EXISTS calificaciones_imports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id             UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id                UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  archivo_nombre          TEXT NOT NULL,
  hash_archivo            TEXT,
  fecha_descarga_moodle   TIMESTAMPTZ,
  parciales_afectados     SMALLINT[] NOT NULL DEFAULT '{}',
  columnas_importadas     JSONB NOT NULL DEFAULT '[]',
  num_estudiantes_match   INT NOT NULL DEFAULT 0,
  num_estudiantes_sin_match INT NOT NULL DEFAULT 0,
  num_celdas_creadas      INT NOT NULL DEFAULT 0,
  num_celdas_actualizadas INT NOT NULL DEFAULT 0,
  num_celdas_sin_cambio   INT NOT NULL DEFAULT 0,
  num_celdas_preservadas  INT NOT NULL DEFAULT 0,
  snapshot_antes          JSONB,
  revertido_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_imports_curso ON calificaciones_imports(curso_id);

ALTER TABLE calificaciones_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profesor_own_cal_imports ON calificaciones_imports;
CREATE POLICY profesor_own_cal_imports ON calificaciones_imports
  FOR ALL
  USING  (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- FK de calificaciones_items → calificaciones_imports (después de crear ambas tablas)
ALTER TABLE calificaciones_items
  DROP CONSTRAINT IF EXISTS fk_cal_items_import,
  ADD CONSTRAINT fk_cal_items_import
    FOREIGN KEY (import_id) REFERENCES calificaciones_imports(id) ON DELETE SET NULL;
