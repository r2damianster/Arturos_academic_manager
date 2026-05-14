-- Candado: un estudiante no puede agendar más de 1 tutoría por semana calendario.
-- La semana se calcula con date_trunc('week', fecha) → lunes de la semana ISO.

CREATE OR REPLACE FUNCTION public.reservar_tutoria(
  p_horario_id   integer,
  p_nombre       text,
  p_carrera      text,
  p_email        text,
  p_telefono     text,
  p_auth_user_id uuid,
  p_notas        text DEFAULT NULL::text,
  p_fecha        date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado        TEXT;
  v_reserva_id    INTEGER;
  v_semana_inicio DATE;
  v_semana_fin    DATE;
BEGIN
  -- Límite semanal: 1 reserva activa por estudiante por semana
  v_semana_inicio := date_trunc('week', p_fecha)::date;
  v_semana_fin    := v_semana_inicio + 6;

  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE auth_user_id = p_auth_user_id
      AND fecha BETWEEN v_semana_inicio AND v_semana_fin
      AND estado IN ('pendiente', 'confirmada')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Ya tienes una tutoría agendada esta semana. Solo se permite una por semana.');
  END IF;

  -- Verificar que el horario existe y bloquearlo para evitar doble-booking concurrente
  SELECT estado INTO v_estado FROM horarios WHERE id = p_horario_id FOR UPDATE;
  IF v_estado IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Horario no encontrado');
  END IF;
  IF v_estado != 'disponible' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este horario no está disponible');
  END IF;

  -- Verificar que no haya otra reserva pendiente para el mismo slot/fecha
  IF EXISTS (
    SELECT 1 FROM reservas
    WHERE horario_id = p_horario_id AND fecha = p_fecha AND estado = 'pendiente'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Este horario ya tiene una reserva para esa fecha');
  END IF;

  INSERT INTO reservas (
    estudiante_nombre, estudiante_carrera, email, telefono,
    fecha, horario_id, estado, auth_user_id, notas
  ) VALUES (
    p_nombre, p_carrera, p_email, p_telefono,
    p_fecha, p_horario_id, 'pendiente', p_auth_user_id, p_notas
  )
  RETURNING id INTO v_reserva_id;

  RETURN jsonb_build_object('ok', true, 'reserva_id', v_reserva_id);
END;
$function$;
