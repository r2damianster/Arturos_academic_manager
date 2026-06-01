-- Modo Tutorados: discriminador en cursos + tablas tutorado_perfil y tutorado_sesiones

-- 1. Discriminador en cursos
ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'regular'
  CHECK (tipo IN ('regular','tutorados'));

-- 2. Perfil + horario diferenciado por tutorado (1 fila por estudiante)
CREATE TABLE IF NOT EXISTS public.tutorado_perfil (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id      uuid NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  estudiante_id    uuid NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  curso_id         uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  modalidad_trabajo TEXT CHECK (modalidad_trabajo IN ('maestria','pregrado','articulo','otro')),
  titulo_trabajo   TEXT,
  etapa            TEXT,
  progreso_pct     INT DEFAULT 0 CHECK (progreso_pct BETWEEN 0 AND 100),
  dia_semana       TEXT,          -- NULL = sin horario fijo
  hora_inicio      TIME,
  hora_fin         TIME,
  modalidad_sesion TEXT DEFAULT 'presencial'
                   CHECK (modalidad_sesion IN ('presencial','virtual','whatsapp','telefono','otro')),
  nota_horario     TEXT,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (estudiante_id, curso_id)
);

-- 3. Bitácora de sesiones individuales por tutorado
CREATE TABLE IF NOT EXISTS public.tutorado_sesiones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id      uuid NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  estudiante_id    uuid NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  curso_id         uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  fecha            date NOT NULL DEFAULT current_date,
  modalidad        TEXT NOT NULL DEFAULT 'presencial'
                   CHECK (modalidad IN ('presencial','virtual','whatsapp','telefono','otro')),
  duracion_minutos INT,
  lo_realizado     TEXT,
  proximo_paso     TEXT,
  created_at       timestamptz DEFAULT now()
);

-- 4. RLS — tutorado_perfil
ALTER TABLE public.tutorado_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profesor_gestiona_tutorado_perfil" ON public.tutorado_perfil;
CREATE POLICY "profesor_gestiona_tutorado_perfil"
  ON public.tutorado_perfil
  FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- 5. RLS — tutorado_sesiones
ALTER TABLE public.tutorado_sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profesor_gestiona_tutorado_sesiones" ON public.tutorado_sesiones;
CREATE POLICY "profesor_gestiona_tutorado_sesiones"
  ON public.tutorado_sesiones
  FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());
