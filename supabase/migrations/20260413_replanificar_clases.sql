-- Módulo de Replanificación de Clases
-- Permite mover clases planificadas a otra fecha con opciones Merge y Shift

-- Nota: No se requieren cambios de schema.
-- La lógica se maneja enteramente en la Server Action.
-- Solo se usa la estructura existente de bitacora_clase.

COMMENT ON TABLE public.bitacora_clase IS
  'Bitácora de clase: soporta estado=planificado para clases futuras. Las Server Actions de replanificación permiten mover estas entradas a nuevas fechas.';
