-- Resumen de asistencia por estudiante y curso, agregado en la base de datos.
-- Reemplaza traer todas las filas de `asistencia` al servidor Node (lento y
-- truncado en silencio por el límite de 1000 filas de PostgREST).
-- SECURITY INVOKER: RLS de `asistencia` sigue aplicando al profesor que llama.
CREATE OR REPLACE FUNCTION public.get_asistencia_resumen(p_curso_ids uuid[])
RETURNS TABLE (curso_id uuid, estudiante_id uuid, presentes bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT a.curso_id,
         a.estudiante_id,
         count(*) FILTER (WHERE a.estado = 'Presente') AS presentes,
         count(*) AS total
  FROM public.asistencia a
  WHERE a.curso_id = ANY (p_curso_ids)
  GROUP BY a.curso_id, a.estudiante_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_asistencia_resumen(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_asistencia_resumen(uuid[]) TO authenticated;
