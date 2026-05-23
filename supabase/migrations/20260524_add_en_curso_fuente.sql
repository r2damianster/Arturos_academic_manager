ALTER TABLE calificaciones_items
  DROP CONSTRAINT IF EXISTS calificaciones_items_fuente_check;

ALTER TABLE calificaciones_items
  ADD CONSTRAINT calificaciones_items_fuente_check
  CHECK (fuente IN ('moodle', 'manual', 'en_curso'));
