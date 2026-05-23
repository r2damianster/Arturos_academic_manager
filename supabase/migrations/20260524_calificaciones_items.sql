-- Tabla granular de ítems de calificación importados desde Moodle o creados manualmente.
-- El UNIQUE (curso_id, estudiante_id, parcial, nombre_item) permite upsert idempotente:
-- re-importar el mismo archivo actualiza valores, no duplica filas.
CREATE TABLE IF NOT EXISTS calificaciones_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  parcial       SMALLINT NOT NULL CHECK (parcial BETWEEN 1 AND 4),
  categoria     TEXT,
  nombre_item   TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('tarea', 'subtotal_categoria', 'otro')),
  nota          NUMERIC(5,2),
  fuente        TEXT NOT NULL DEFAULT 'moodle' CHECK (fuente IN ('moodle', 'manual')),
  import_id     UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (curso_id, estudiante_id, parcial, nombre_item)
);

CREATE INDEX IF NOT EXISTS idx_cal_items_curso      ON calificaciones_items(curso_id);
CREATE INDEX IF NOT EXISTS idx_cal_items_estudiante ON calificaciones_items(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_cal_items_import     ON calificaciones_items(import_id);

ALTER TABLE calificaciones_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profesor_own_cal_items ON calificaciones_items;
CREATE POLICY profesor_own_cal_items ON calificaciones_items
  FOR ALL
  USING  (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_cal_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cal_items_updated_at ON calificaciones_items;
CREATE TRIGGER trg_cal_items_updated_at
  BEFORE UPDATE ON calificaciones_items
  FOR EACH ROW EXECUTE FUNCTION update_cal_items_updated_at();
