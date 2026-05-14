-- cancelar_mi_reserva: solo permite cancelar con >1h de anticipación.
-- marcar_no_asistire: alternativa cuando ya pasó el corte; registra inasistencia
--   para que el profesor la vea como "no asistió".

CREATE OR REPLACE FUNCTION public.cancelar_mi_reserva(p_reserva_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reserva     reservas%ROWTYPE;
  v_hora_inicio TIME;
  v_cita_at     TIMESTAMP;
BEGIN
  SELECT r.* INTO v_reserva
  FROM reservas r
  WHERE r.id = p_reserva_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reserva no encontrada');
  END IF;
  IF v_reserva.auth_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  IF v_reserva.estado != 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden cancelar reservas pendientes');
  END IF;

  -- Verificar ventana de 1 hora
  SELECT hora_inicio INTO v_hora_inicio FROM horarios WHERE id = v_reserva.horario_id;
  v_cita_at := (v_reserva.fecha::date + v_hora_inicio)::timestamp;

  IF NOW() > v_cita_at - interval '1 hour' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Ya no puedes cancelar esta cita (faltan menos de 60 min). Usa "No asistiré" en su lugar.',
      'use_no_asistire', true
    );
  END IF;

  UPDATE reservas
  SET estado = 'cancelado', cancelado_por = 'estudiante', cancelado_at = NOW()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;


-- Nueva función: estudiante marca que no asistirá (dentro de 1h antes o durante la cita)
CREATE OR REPLACE FUNCTION public.marcar_no_asistire(p_reserva_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reserva     reservas%ROWTYPE;
  v_hora_fin    TIME;
  v_cita_fin_at TIMESTAMP;
BEGIN
  SELECT r.* INTO v_reserva
  FROM reservas r
  WHERE r.id = p_reserva_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reserva no encontrada');
  END IF;
  IF v_reserva.auth_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  IF v_reserva.estado NOT IN ('pendiente', 'confirmada') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se puede modificar esta reserva');
  END IF;

  -- Permitir hasta que termine la cita (hora_fin), no antes del corte
  SELECT hora_fin INTO v_hora_fin FROM horarios WHERE id = v_reserva.horario_id;
  v_cita_fin_at := (v_reserva.fecha::date + v_hora_fin)::timestamp;

  IF NOW() > v_cita_fin_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta cita ya terminó. El profesor debe registrar la asistencia.');
  END IF;

  UPDATE reservas
  SET estado = 'completada', asistio = FALSE, completada_at = NOW()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
