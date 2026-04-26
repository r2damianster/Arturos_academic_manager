-- Permite a cualquier usuario autenticado ver integrantes de grupos abiertos de afinidad.
-- Necesario para que el estudiante vea cuántos hay en cada grupo antes de unirse.
CREATE POLICY "todos_ven_integrantes_grupos_abiertos"
  ON public.grupo_integrantes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_clase g
      WHERE g.id = grupo_id AND g.abierto = true AND g.tipo = 'afinidad'
    )
  );
