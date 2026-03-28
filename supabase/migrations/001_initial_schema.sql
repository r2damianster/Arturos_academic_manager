-- ═══════════════════════════════════════════════════════════════════════════
-- GESTOR UNIVERSITARIO — Esquema inicial Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PROFESORES ─────────────────────────────────────────────────────────────
-- Se crea automáticamente al registrarse un usuario (ver trigger al final)
CREATE TABLE IF NOT EXISTS profesores (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  avatar_url  TEXT,
  institucion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CURSOS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cursos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id  UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  codigo       TEXT NOT NULL,
  asignatura   TEXT NOT NULL,
  periodo      TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin    DATE,
  horas_semana INTEGER DEFAULT 16,
  num_sesiones INTEGER DEFAULT 8,
  horas_teoricas INTEGER DEFAULT 16,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profesor_id, codigo)
);

-- ─── ESTUDIANTES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estudiantes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id    UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  tutoria     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(curso_id, email)
);

-- ─── PERFIL ESTUDIANTE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perfiles_estudiante (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  carrera       TEXT,
  trabaja       BOOLEAN DEFAULT FALSE,
  laptop        BOOLEAN DEFAULT FALSE,
  genero        TEXT,
  edad          INTEGER,
  UNIQUE(estudiante_id)
);

-- ─── ASISTENCIA ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  semana        TEXT,
  estado        TEXT NOT NULL CHECK (estado IN ('Presente', 'Ausente', 'Atraso')),
  atraso        BOOLEAN DEFAULT FALSE,
  horas         NUMERIC(4,1) DEFAULT 0,
  momento       TEXT CHECK (momento IN ('En clase', 'Después de clase')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(curso_id, estudiante_id, fecha)
);

-- ─── PARTICIPACIÓN ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  semana        TEXT,
  nivel         INTEGER CHECK (nivel BETWEEN 1 AND 5),
  observacion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CALIFICACIONES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  acd1          NUMERIC(5,2) DEFAULT 0,
  ta1           NUMERIC(5,2) DEFAULT 0,
  pe1           NUMERIC(5,2) DEFAULT 0,
  ex1           NUMERIC(5,2) DEFAULT 0,
  acd2          NUMERIC(5,2) DEFAULT 0,
  ta2           NUMERIC(5,2) DEFAULT 0,
  pe2           NUMERIC(5,2) DEFAULT 0,
  ex2           NUMERIC(5,2) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(curso_id, estudiante_id)
);

-- ─── TRABAJOS ASIGNADOS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trabajos_asignados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id       UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id          UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id     UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL,
  tema              TEXT,
  descripcion       TEXT,
  estado            TEXT DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado')),
  fecha_asignacion  DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── OBSERVACIONES DE TRABAJO ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS observaciones_trabajo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  trabajo_id  UUID NOT NULL REFERENCES trabajos_asignados(id) ON DELETE CASCADE,
  observacion TEXT NOT NULL,
  fecha       DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BITÁCORA DE CLASE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bitacora_clase (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  semana        TEXT,
  tema          TEXT NOT NULL,
  actividades   TEXT,
  materiales    TEXT,
  observaciones TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÍNDICES para rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cursos_profesor      ON cursos(profesor_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_curso    ON estudiantes(curso_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_curso     ON asistencia(curso_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_estudiante ON asistencia(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha     ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_calificaciones_curso ON calificaciones(curso_id);
CREATE INDEX IF NOT EXISTS idx_participacion_curso  ON participacion(curso_id);
CREATE INDEX IF NOT EXISTS idx_trabajos_estudiante  ON trabajos_asignados(estudiante_id);

-- ─── TRIGGER: crear perfil de profesor automáticamente al registrarse ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profesores (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
