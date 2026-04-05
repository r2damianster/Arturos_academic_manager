-- Agregar columna tipo a horarios_clases
ALTER TABLE horarios_clases ADD COLUMN tipo TEXT DEFAULT 'clase' CHECK (tipo IN ('clase', 'tutoria_curso'));

-- Crear tabla para los anuncios/confirmaciones de asistencia a tutorías de curso
CREATE TABLE IF NOT EXISTS anuncios_tutoria_curso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horario_clase_id UUID NOT NULL REFERENCES horarios_clases(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(horario_clase_id, estudiante_id, fecha)
);

-- Habilitar RLS
ALTER TABLE anuncios_tutoria_curso ENABLE ROW LEVEL SECURITY;

-- Políticas para anuncios_tutoria_curso
-- Profesores pueden ver todos los anuncios de sus cursos
CREATE POLICY "Profesores pueden leer anuncios de sus cursos"
ON anuncios_tutoria_curso FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM horarios_clases hc
    WHERE hc.id = anuncios_tutoria_curso.horario_clase_id
    AND hc.profesor_id = auth.uid()
  )
);

-- Estudiantes pueden leer sus propios anuncios
CREATE POLICY "Estudiantes pueden leer sus anuncios"
ON anuncios_tutoria_curso FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = anuncios_tutoria_curso.estudiante_id
    AND (
      e.email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
      EXISTS (
         SELECT 1 FROM perfiles_estudiante pe
         WHERE pe.estudiante_id = e.id AND pe.id = auth.uid()
      )
    )
  )
);

-- Estudiantes pueden crear sus propios anuncios
CREATE POLICY "Estudiantes pueden crear sus anuncios"
ON anuncios_tutoria_curso FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = estudiante_id
    AND (
      e.email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
      EXISTS (
         SELECT 1 FROM perfiles_estudiante pe
         WHERE pe.estudiante_id = e.id AND pe.id = auth.uid()
      )
    )
  )
);

-- Estudiantes pueden eliminar sus propios anuncios
CREATE POLICY "Estudiantes pueden eliminar sus anuncios"
ON anuncios_tutoria_curso FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = estudiante_id
    AND (
      e.email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
      EXISTS (
         SELECT 1 FROM perfiles_estudiante pe
         WHERE pe.estudiante_id = e.id AND pe.id = auth.uid()
      )
    )
  )
);
