-- Multi-reservas por slot de tutoría (micro-reservas)
-- Fecha: 2026-05-25
-- Permite que múltiples estudiantes reserven el mismo slot, cada uno
-- con un tipo de actividad que determina su duración en minutos.
-- El slot se llena secuencialmente: hora_inicio_reserva = MAX(hora_fin_reserva anterior) + buffer

BEGIN;

-- ===========================================================================
-- 1. TABLA tipos_tutoria
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.tipos_tutoria (
  id              serial PRIMARY KEY,
  profesor_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = default global
  nombre          text NOT NULL,
  duracion_minutos int NOT NULL CHECK (duracion_minutos > 0),
  descripcion     text,
  activo          boolean NOT NULL DEFAULT true,
  orden           int NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Defaults globales (profesor_id = NULL)
INSERT INTO public.tipos_tutoria (profesor_id, nombre, duracion_minutos, orden) VALUES
  (NULL, 'Duda rápida o aclaración',         10, 1),
  (NULL, 'Revisión de tarea',                15, 2),
  (NULL, 'Explicación de tema',              20, 3),
  (NULL, 'Resolución de ejercicio',          25, 4),
  (NULL, 'Revisión de proyecto',             30, 5),
  (NULL, 'Revisión de proyecto de titulación', 60, 6)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 2. ALTER TABLE reservas — 4 nuevas columnas
-- ===========================================================================

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS tipo_tutoria_id    int REFERENCES public.tipos_tutoria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hora_inicio_reserva time,
  ADD COLUMN IF NOT EXISTS hora_fin_reserva    time,
  ADD COLUMN IF NOT EXISTS duracion_minutos    int;

-- ===========================================================================
-- 3. ALTER TABLE horarios — 2 nuevas columnas
-- ===========================================================================

ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS permitir_multiples boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buffer_minutos     int NOT NULL DEFAULT 2;

-- ===========================================================================
-- 4. RLS para tipos_tutoria
-- ===========================================================================

ALTER TABLE public.tipos_tutoria ENABLE ROW LEVEL SECURITY;

-- Profesor: ve sus propios tipos + los globales
CREATE POLICY "profesor ve sus tipos_tutoria y globales" ON public.tipos_tutoria
  FOR SELECT USING (
    profesor_id = auth.uid()
    OR profesor_id IS NULL
  );

-- Profesor: inserta solo para sí mismo
CREATE POLICY "profesor inserta sus tipos_tutoria" ON public.tipos_tutoria
  FOR INSERT WITH CHECK (profesor_id = auth.uid());

-- Profesor: actualiza solo los suyos (no los globales)
CREATE POLICY "profesor modifica sus tipos_tutoria" ON public.tipos_tutoria
  FOR UPDATE USING (profesor_id = auth.uid());

-- Profesor: borra solo los suyos
CREATE POLICY "profesor borra sus tipos_tutoria" ON public.tipos_tutoria
  FOR DELETE USING (profesor_id = auth.uid());

-- Estudiante autenticado: puede ver tipos del profesor de sus cursos + globales
-- (necesita SECURITY DEFINER en la función o una policy permisiva controlada)
-- Usamos policy permisiva para autenticados — los tipos no son datos sensibles
CREATE POLICY "autenticado ve todos los tipos_tutoria activos" ON public.tipos_tutoria
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND activo = true
  );

-- ===========================================================================
-- 5. DROP funciones existentes (todas las variantes)
-- ===========================================================================

DROP FUNCTION IF EXISTS public.reservar_tutoria(integer, text, text, text, text, uuid, text, date);
DROP FUNCTION IF EXISTS public.reservar_tutoria(integer, text, text, text, text, uuid, text, date, text, text);
DROP FUNCTION IF EXISTS public.get_occupied_slots(int[]);
DROP FUNCTION IF EXISTS public.get_occupied_slots(int[], date);

-- ===========================================================================
-- 6. CREATE FUNCTION reservar_tutoria — versión 3 con micro-reservas
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.reservar_tutoria(
  p_horario_id        integer,
  p_nombre            text,
  p_carrera           text,
  p_email             text,
  p_telefono          text,
  p_auth_user_id      uuid,
  p_notas             text    DEFAULT NULL,
  p_fecha             date    DEFAULT CURRENT_DATE,
  p_modalidad         text    DEFAULT 'presencial',
  p_link_zoom         text    DEFAULT NULL,
  p_tipo_tutoria_id   int     DEFAULT NULL,
  p_duracion_minutos  int     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado              TEXT;
  v_permite_multiples   BOOLEAN;
  v_buffer              INT;
  v_hora_inicio         TIME;
  v_hora_fin            TIME;
  v_reserva_id          INTEGER;
  v_semana_inicio       DATE;
  v_semana_fin          DATE;
  v_hora_inicio_nueva   TIME;
  v_hora_fin_nueva      TIME;
  v_duracion            INT;
  v_max_hora_fin        TIME;
  v_disponible_hasta    DATE;
BEGIN
  -- Validar modalidad
  IF p_modalidad NOT IN ('presencial', 'virtual', 'otro') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Modalidad no válida');
  END IF;

  -- Link Zoom solo aplica en modalidad virtual
  IF p_modalidad != 'virtual' THEN
    p_link_zoom := NULL;
  END IF;

  -- Límite semanal: 1 reserva activa por estudiante por semana (lunes-domingo ISO)
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
  SELECT estado, permitir_multiples, buffer_minutos, hora_inicio, hora_fin, disponible_hasta
    INTO v_estado, v_permite_multiples, v_buffer, v_hora_inicio, v_hora_fin, v_disponible_hasta
    FROM horarios
   WHERE id = p_horario_id
     FOR UPDATE;

  IF v_estado IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Horario no encontrado');
  END IF;
  IF v_estado != 'disponible' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este horario no está disponible');
  END IF;

  -- Verificar que no ha vencido disponible_hasta
  IF v_disponible_hasta IS NOT NULL AND v_disponible_hasta < p_fecha THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este horario ya no está disponible');
  END IF;

  -- ===========================================================================
  -- RAMA: slot sin multi-reserva (comportamiento clásico)
  -- ===========================================================================
  IF NOT v_permite_multiples THEN
    IF EXISTS (
      SELECT 1 FROM reservas
      WHERE horario_id = p_horario_id
        AND fecha = p_fecha
        AND estado IN ('pendiente', 'confirmada')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Este horario ya tiene una reserva para esa fecha');
    END IF;

    INSERT INTO reservas (
      estudiante_nombre, estudiante_carrera, email, telefono,
      fecha, horario_id, estado, auth_user_id, notas,
      modalidad, link_zoom,
      tipo_tutoria_id, duracion_minutos
    ) VALUES (
      p_nombre, p_carrera, p_email, p_telefono,
      p_fecha, p_horario_id, 'pendiente', p_auth_user_id, p_notas,
      p_modalidad, p_link_zoom,
      p_tipo_tutoria_id, p_duracion_minutos
    )
    RETURNING id INTO v_reserva_id;

    RETURN jsonb_build_object('ok', true, 'reserva_id', v_reserva_id);
  END IF;

  -- ===========================================================================
  -- RAMA: slot con multi-reserva (micro-reservas)
  -- ===========================================================================

  -- Determinar duración: parámetro explícito > tipo_tutoria > error
  v_duracion := p_duracion_minutos;

  IF v_duracion IS NULL AND p_tipo_tutoria_id IS NOT NULL THEN
    SELECT duracion_minutos INTO v_duracion
      FROM tipos_tutoria
     WHERE id = p_tipo_tutoria_id AND activo = true;
  END IF;

  IF v_duracion IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Debes seleccionar un tipo de actividad para este horario con múltiples reservas');
  END IF;

  -- Obtener última hora_fin_reserva activa en este slot+fecha
  SELECT MAX(hora_fin_reserva) INTO v_max_hora_fin
    FROM reservas
   WHERE horario_id = p_horario_id
     AND fecha = p_fecha
     AND estado IN ('pendiente', 'confirmada')
     AND hora_fin_reserva IS NOT NULL;

  -- Calcular hora de inicio de la nueva micro-reserva
  IF v_max_hora_fin IS NULL THEN
    -- No hay reservas activas: empezar en hora_inicio del horario
    v_hora_inicio_nueva := v_hora_inicio;
  ELSE
    -- Encadenar tras la última, más buffer
    v_hora_inicio_nueva := v_max_hora_fin + (v_buffer || ' minutes')::interval;
  END IF;

  v_hora_fin_nueva := v_hora_inicio_nueva + (v_duracion || ' minutes')::interval;

  -- Validar que cabe dentro del slot
  IF v_hora_fin_nueva > v_hora_fin THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'No hay tiempo disponible en este horario. Todos los turnos están ocupados.');
  END IF;

  -- Insertar con horas calculadas
  INSERT INTO reservas (
    estudiante_nombre, estudiante_carrera, email, telefono,
    fecha, horario_id, estado, auth_user_id, notas,
    modalidad, link_zoom,
    tipo_tutoria_id, duracion_minutos,
    hora_inicio_reserva, hora_fin_reserva
  ) VALUES (
    p_nombre, p_carrera, p_email, p_telefono,
    p_fecha, p_horario_id, 'pendiente', p_auth_user_id, p_notas,
    p_modalidad, p_link_zoom,
    p_tipo_tutoria_id, v_duracion,
    v_hora_inicio_nueva, v_hora_fin_nueva
  )
  RETURNING id INTO v_reserva_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'hora_inicio', to_char(v_hora_inicio_nueva, 'HH24:MI'),
    'hora_fin',    to_char(v_hora_fin_nueva,    'HH24:MI')
  );
END;
$function$;

-- ===========================================================================
-- 7. CREATE FUNCTION get_occupied_slots — nueva versión con ocupación parcial
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_occupied_slots(
  p_horario_ids int[],
  p_fecha       date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  horario_id       int,
  fecha            date,
  reservas_count   int,
  minutos_usados   int,
  minutos_totales  int,
  esta_lleno       boolean,
  permite_multiples boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id                                                     AS horario_id,
    p_fecha                                                  AS fecha,
    COUNT(r.id)::int                                         AS reservas_count,
    COALESCE(
      SUM(r.duracion_minutos)::int
      + GREATEST(0, (COUNT(r.id)::int - 1)) * h.buffer_minutos,
      0
    )                                                        AS minutos_usados,
    EXTRACT(EPOCH FROM (h.hora_fin - h.hora_inicio))::int / 60 AS minutos_totales,
    CASE
      WHEN NOT h.permitir_multiples THEN
        EXISTS(
          SELECT 1 FROM reservas r2
          WHERE r2.horario_id = h.id
            AND r2.fecha = p_fecha
            AND r2.estado IN ('pendiente', 'confirmada')
        )
      ELSE
        -- Lleno si el siguiente slot (último fin + buffer + duración mínima) no cabe
        COALESCE(
          (
            SELECT MAX(r3.hora_fin_reserva) + (h.buffer_minutos || ' minutes')::interval
                   + '10 minutes'::interval > h.hora_fin
            FROM reservas r3
            WHERE r3.horario_id = h.id
              AND r3.fecha = p_fecha
              AND r3.estado IN ('pendiente', 'confirmada')
              AND r3.hora_fin_reserva IS NOT NULL
          ),
          false
        )
    END                                                      AS esta_lleno,
    h.permitir_multiples                                     AS permite_multiples
  FROM unnest(p_horario_ids) AS uh(id)
  JOIN horarios h ON h.id = uh.id
  LEFT JOIN reservas r
    ON r.horario_id = h.id
   AND r.fecha = p_fecha
   AND r.estado IN ('pendiente', 'confirmada')
  GROUP BY h.id, h.hora_inicio, h.hora_fin, h.buffer_minutos, h.permitir_multiples, p_fecha;
$$;

COMMIT;
