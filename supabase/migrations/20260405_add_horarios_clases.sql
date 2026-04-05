-- Run this in the Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS horarios_clases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  profesor_id UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado')),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS si aplica en otras tablas del proyecto
ALTER TABLE horarios_clases ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de lectura y escritura
CREATE POLICY "Public profiles are viewable by everyone."
  ON horarios_clases FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own class schedules."
  ON horarios_clases FOR INSERT
  WITH CHECK (auth.uid() = profesor_id);

CREATE POLICY "Users can update their own class schedules."
  ON horarios_clases FOR UPDATE
  USING (auth.uid() = profesor_id);

CREATE POLICY "Users can delete their own class schedules."
  ON horarios_clases FOR DELETE
  USING (auth.uid() = profesor_id);
