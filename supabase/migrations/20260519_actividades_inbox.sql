-- Inbox universal de actividades, tareas e inspiración del profesor

CREATE TABLE IF NOT EXISTS actividades_inbox (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  tipo                TEXT NOT NULL DEFAULT 'tarea' CHECK (tipo IN ('idea','tarea','recordatorio')),
  prioridad           TEXT DEFAULT 'normal' CHECK (prioridad IN ('baja','normal','alta')),
  estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','cumplida','convertida','archivada')),
  curso_id            UUID REFERENCES cursos(id) ON DELETE SET NULL,
  etiquetas           TEXT[] DEFAULT '{}',
  fecha_vencimiento   TIMESTAMPTZ,
  fecha_cumplimiento  TIMESTAMPTZ,
  conversion_destino  TEXT CHECK (conversion_destino IN ('evento','planificacion','bitacora_actividad','tutoria_manual','horario_tutoria')),
  conversion_ref_id   UUID,
  conversion_fecha    TIMESTAMPTZ,
  origen              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividades_inbox_prof_estado
  ON actividades_inbox(profesor_id, estado);

CREATE INDEX IF NOT EXISTS idx_actividades_inbox_curso
  ON actividades_inbox(curso_id) WHERE curso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actividades_inbox_vencimiento
  ON actividades_inbox(profesor_id, fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;

ALTER TABLE actividades_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profesor_full_actividades ON actividades_inbox;
CREATE POLICY profesor_full_actividades ON actividades_inbox
  FOR ALL USING (profesor_id = auth.uid()) WITH CHECK (profesor_id = auth.uid());

-- Trigger updated_at (sin depender de la extensión moddatetime)
CREATE OR REPLACE FUNCTION _set_actividades_inbox_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actividades_inbox_updated_at ON actividades_inbox;
CREATE TRIGGER trg_actividades_inbox_updated_at
  BEFORE UPDATE ON actividades_inbox
  FOR EACH ROW EXECUTE FUNCTION _set_actividades_inbox_updated_at();
