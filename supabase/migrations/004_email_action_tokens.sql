-- ============================================================
-- Email action tokens for weekly unreported-tutoria emails
-- ============================================================

-- Table: one row per (reserva × accion) — single-use, expires in 8 days
CREATE TABLE IF NOT EXISTS public.email_action_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id  INT         NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  accion      TEXT        NOT NULL CHECK (accion IN ('asistio', 'no_asistio', 'cancelar')),
  profesor_id UUID        NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_eat_id ON public.email_action_tokens(id);
CREATE INDEX IF NOT EXISTS idx_eat_reserva ON public.email_action_tokens(reserva_id);

-- RLS: tokens are only accessed via service-role (Edge Functions) or the action endpoint
ALTER TABLE public.email_action_tokens ENABLE ROW LEVEL SECURITY;

-- Service-role bypass is automatic; no anon/authenticated policies needed
-- (the action page uses the service-role key server-side)

-- ============================================================
-- Function: get_unreported_tutorias_by_profesor
-- Returns reservas still 'pendiente' whose time slot already ended,
-- grouped info needed to build the weekly email
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unreported_tutorias()
RETURNS TABLE (
  reserva_id    INT,
  profesor_id   UUID,
  profesor_nombre TEXT,
  profesor_email  TEXT,
  estudiante_nombre TEXT,
  dia_semana    TEXT,
  hora_inicio   TEXT,
  hora_fin      TEXT,
  semana_label  TEXT   -- "L 24 Mar – V 28 Mar"
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id                          AS reserva_id,
    p.id                          AS profesor_id,
    p.nombre                      AS profesor_nombre,
    p.email                       AS profesor_email,
    r.nombre_estudiante           AS estudiante_nombre,
    h.dia_semana,
    h.hora_inicio::TEXT,
    h.hora_fin::TEXT,
    to_char(
      date_trunc('week', NOW() - INTERVAL '7 days'),
      'DD Mon'
    ) || ' – ' ||
    to_char(
      date_trunc('week', NOW() - INTERVAL '7 days') + INTERVAL '4 days',
      'DD Mon'
    )                             AS semana_label
  FROM public.reservas r
  JOIN public.horarios  h ON h.id = r.horario_id
  JOIN public.profesores p ON p.id = h.profesor_id
  WHERE r.estado = 'pendiente'
    -- slot ended more than 1 hour ago (buffer)
    AND (
      CURRENT_DATE + h.hora_fin::TIME
    ) < (NOW() - INTERVAL '1 hour')
  ORDER BY p.id, h.dia_semana, h.hora_inicio;
$$;

-- ============================================================
-- Function: consume_action_token(token_id, accion)
-- Called by the Next.js action page — validates & executes
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_action_token(
  p_token_id  UUID,
  p_accion    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token     email_action_tokens%ROWTYPE;
  v_result    JSONB;
BEGIN
  -- Lock the row
  SELECT * INTO v_token
  FROM email_action_tokens
  WHERE id = p_token_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token no encontrado');
  END IF;

  IF v_token.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este enlace ya fue utilizado');
  END IF;

  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este enlace ha expirado');
  END IF;

  -- Token accion must match what was requested (extra safety)
  IF v_token.accion <> p_accion THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acción no coincide con el token');
  END IF;

  -- Execute the tutoria action
  SELECT gestionar_reserva_profesor(v_token.reserva_id, p_accion)
  INTO v_result;

  IF NOT (v_result->>'ok')::BOOLEAN THEN
    RETURN v_result;
  END IF;

  -- Mark token as used
  UPDATE email_action_tokens SET used_at = NOW() WHERE id = p_token_id;

  -- Also mark sibling tokens for same reserva as used (prevent double-action)
  UPDATE email_action_tokens
  SET used_at = NOW()
  WHERE reserva_id = v_token.reserva_id
    AND id <> p_token_id
    AND used_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- Enable pg_cron + pg_net and schedule weekly job
-- (runs every Monday at 08:00 UTC)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

SELECT cron.schedule(
  'weekly-tutoria-email',
  '0 8 * * 1',
  $$
    SELECT net.http_post(
      url     := 'https://hxsnyrutyyavvljxwgku.supabase.co/functions/v1/send-weekly-tutoria-report',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
