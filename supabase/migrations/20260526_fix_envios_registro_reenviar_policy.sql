-- Fix: WITH CHECK explícito en política de reenvío del estudiante.
-- Sin WITH CHECK, PostgreSQL usa el USING como WITH CHECK también,
-- bloqueando el UPDATE porque el row ya no tiene estado='rechazado' después.
DROP POLICY IF EXISTS estudiante_reenviar_rechazado ON envios_registro;

CREATE POLICY estudiante_reenviar_rechazado ON envios_registro
  FOR UPDATE
  TO authenticated
  USING (
    estudiante_id IN (SELECT id FROM estudiantes WHERE auth_user_id = auth.uid())
    AND estado = 'rechazado'
  )
  WITH CHECK (
    estudiante_id IN (SELECT id FROM estudiantes WHERE auth_user_id = auth.uid())
  );
