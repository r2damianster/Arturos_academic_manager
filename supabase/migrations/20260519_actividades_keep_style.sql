-- Rediseño: actividades_inbox → board estilo Google Keep

-- Eliminar columna de workflow de estados
ALTER TABLE actividades_inbox DROP COLUMN IF EXISTS estado;

-- Añadir columnas Keep-style
ALTER TABLE actividades_inbox
  ADD COLUMN IF NOT EXISTS archivada        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completada       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color            TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checklist_items  JSONB NOT NULL DEFAULT '[]';

-- Migrar tipo: idea → nota
UPDATE actividades_inbox SET tipo = 'nota' WHERE tipo = 'idea';

-- Actualizar constraint de tipo
ALTER TABLE actividades_inbox DROP CONSTRAINT IF EXISTS actividades_inbox_tipo_check;
ALTER TABLE actividades_inbox ADD CONSTRAINT actividades_inbox_tipo_check
  CHECK (tipo IN ('nota','tarea','recordatorio'));
ALTER TABLE actividades_inbox ALTER COLUMN tipo SET DEFAULT 'nota';

-- Validar color
ALTER TABLE actividades_inbox ADD CONSTRAINT actividades_inbox_color_check
  CHECK (color IS NULL OR color IN ('rojo','naranja','amarillo','verde','teal','azul','morado'));

-- Índices nuevos
CREATE INDEX IF NOT EXISTS idx_actividades_inbox_pinned
  ON actividades_inbox(profesor_id) WHERE pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_actividades_inbox_archivada
  ON actividades_inbox(profesor_id, archivada);
