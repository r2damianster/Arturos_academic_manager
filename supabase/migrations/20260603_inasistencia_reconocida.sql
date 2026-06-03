-- Reconocimiento de inasistencia por el estudiante
-- Cuando el profesor marca no_asistida, o pasa 1 semana sin asistencia registrada,
-- el portal bloquea al estudiante hasta que reconozca y justifique la inasistencia.

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS justificacion_inasistencia TEXT,
  ADD COLUMN IF NOT EXISTS inasistencia_reconocida BOOLEAN NOT NULL DEFAULT false;

-- Índice para la query del layout (busca rápido por auth_user_id + estado pendiente)
CREATE INDEX IF NOT EXISTS idx_reservas_inasistencia
  ON public.reservas (auth_user_id, inasistencia_reconocida, fecha)
  WHERE inasistencia_reconocida = false;
