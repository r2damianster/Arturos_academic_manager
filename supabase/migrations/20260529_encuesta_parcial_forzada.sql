-- Permite forzar la encuesta parcial en cursos específicos sin alterar la lógica del 50%.
-- Para desactivar: UPDATE cursos SET encuesta_parcial_forzada = FALSE WHERE codigo = 'XXX';

ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS encuesta_parcial_forzada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.get_encuestas_parciales_pendientes(p_auth_user_id text)
RETURNS TABLE(curso_id uuid, asignatura text)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT c.id, c.asignatura
  FROM estudiantes e
  JOIN cursos c ON c.id = e.curso_id
  WHERE e.auth_user_id = p_auth_user_id::uuid
    AND e.estado = 'activo'
    AND c.encuesta_parcial_habilitada = TRUE
    AND c.fecha_inicio IS NOT NULL
    AND c.fecha_fin IS NOT NULL
    AND NOW() BETWEEN c.fecha_inicio::timestamptz AND c.fecha_fin::timestamptz
    AND (
      c.encuesta_parcial_forzada = TRUE
      OR (
        EXTRACT(EPOCH FROM (NOW() - c.fecha_inicio::timestamptz))
        / EXTRACT(EPOCH FROM (c.fecha_fin::timestamptz - c.fecha_inicio::timestamptz))
      ) >= 0.50
    )
    AND NOT EXISTS (
      SELECT 1 FROM encuesta_parcial ep
      WHERE ep.estudiante_id = e.id
        AND ep.curso_id = c.id
        AND ep.tipo = 'mitad'
    );
$function$;

-- Activar forzado en todos los cursos habilitados excepto dp-m261 y mi-ni261
UPDATE public.cursos
SET encuesta_parcial_forzada = TRUE
WHERE encuesta_parcial_habilitada = TRUE
  AND codigo NOT IN ('dp-m261', 'mi-ni261');
