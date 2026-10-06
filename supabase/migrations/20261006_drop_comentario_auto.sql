-- El comentario automático de las rúbricas se calcula al mostrarlo y ya no se guarda en la base,
-- así que la columna que lo distinguía (20261006_calificaciones_items_comentario_auto) deja de usarse.
-- IMPORTANTE: ejecutar solo DESPUÉS de desplegar el código que ya no lee `comentario_auto`;
-- si se corre antes, la página de calificaciones desplegada falla al consultar la columna.
ALTER TABLE public.calificaciones_items
  DROP COLUMN IF EXISTS comentario_auto;
