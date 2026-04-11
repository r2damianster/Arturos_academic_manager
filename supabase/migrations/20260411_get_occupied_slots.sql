-- Fix: bypass RLS para leer ocupación de slots sin exponer datos privados
-- Solo retorna horario_id + fecha de reservas activas para los slots indicados.
-- SECURITY DEFINER permite que estudiantes autenticados consulten ocupación de
-- slots ajenos sin ver datos personales de otros estudiantes.

CREATE OR REPLACE FUNCTION get_occupied_slots(p_horario_ids int[])
RETURNS TABLE(horario_id int, fecha date)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.horario_id, r.fecha
  FROM reservas r
  WHERE r.horario_id = ANY(p_horario_ids)
    AND r.estado IN ('pendiente', 'confirmada');
$$;
