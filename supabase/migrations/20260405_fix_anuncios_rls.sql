-- Fix: las políticas RLS de anuncios_tutoria_curso usaban
-- (SELECT email FROM auth.users WHERE id = auth.uid())
-- lo que da "permission denied for table users" para estudiantes.
-- Solución: usar e.auth_user_id = auth.uid() directamente.

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "Estudiantes pueden leer sus anuncios" ON anuncios_tutoria_curso;
DROP POLICY IF EXISTS "Estudiantes pueden crear sus anuncios" ON anuncios_tutoria_curso;
DROP POLICY IF EXISTS "Estudiantes pueden eliminar sus anuncios" ON anuncios_tutoria_curso;

-- Recrear usando auth_user_id (sin tocar auth.users)
CREATE POLICY "Estudiantes pueden leer sus anuncios"
ON anuncios_tutoria_curso FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = anuncios_tutoria_curso.estudiante_id
      AND e.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Estudiantes pueden crear sus anuncios"
ON anuncios_tutoria_curso FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = estudiante_id
      AND e.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Estudiantes pueden eliminar sus anuncios"
ON anuncios_tutoria_curso FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = anuncios_tutoria_curso.estudiante_id
      AND e.auth_user_id = auth.uid()
  )
);
