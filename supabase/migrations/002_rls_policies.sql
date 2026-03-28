-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Cada profesor solo ve sus propios datos
-- Ejecutar DESPUÉS de 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE profesores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_estudiante  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participacion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajos_asignados   ENABLE ROW LEVEL SECURITY;
ALTER TABLE observaciones_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_clase       ENABLE ROW LEVEL SECURITY;

-- ─── PROFESORES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_profile" ON profesores;
CREATE POLICY "profesor_own_profile"
  ON profesores FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── CURSOS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_cursos" ON cursos;
CREATE POLICY "profesor_own_cursos"
  ON cursos FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── ESTUDIANTES ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_estudiantes" ON estudiantes;
CREATE POLICY "profesor_own_estudiantes"
  ON estudiantes FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── PERFIL ESTUDIANTE ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_perfiles" ON perfiles_estudiante;
CREATE POLICY "profesor_own_perfiles"
  ON perfiles_estudiante FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── ASISTENCIA ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_asistencia" ON asistencia;
CREATE POLICY "profesor_own_asistencia"
  ON asistencia FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── PARTICIPACIÓN ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_participacion" ON participacion;
CREATE POLICY "profesor_own_participacion"
  ON participacion FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── CALIFICACIONES ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_calificaciones" ON calificaciones;
CREATE POLICY "profesor_own_calificaciones"
  ON calificaciones FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── TRABAJOS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_trabajos" ON trabajos_asignados;
CREATE POLICY "profesor_own_trabajos"
  ON trabajos_asignados FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── OBSERVACIONES ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_observaciones" ON observaciones_trabajo;
CREATE POLICY "profesor_own_observaciones"
  ON observaciones_trabajo FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- ─── BITÁCORA ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profesor_own_bitacora" ON bitacora_clase;
CREATE POLICY "profesor_own_bitacora"
  ON bitacora_clase FOR ALL
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());
