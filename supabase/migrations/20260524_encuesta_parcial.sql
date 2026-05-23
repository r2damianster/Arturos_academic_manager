CREATE TABLE IF NOT EXISTS encuesta_parcial (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id                UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  curso_id                     UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  auth_user_id                 TEXT NOT NULL,
  tipo                         TEXT NOT NULL DEFAULT 'mitad',
  porcentaje_curso             NUMERIC(5,2),
  semana_iso                   INTEGER,

  -- SECCIÓN 1: Actualización de perfil
  trabaja_actual               TEXT,
  tipo_trabajo_actual          TEXT,
  horas_trabajo_actual         SMALLINT,
  tiene_laptop_actual          BOOLEAN,
  tiene_pc_escritorio_actual   BOOLEAN,
  comparte_pc_actual           BOOLEAN,
  sin_computadora_actual       BOOLEAN,
  dispositivo_movil_actual     TEXT,
  nivel_tecnologia_actual      SMALLINT,
  situacion_vivienda_actual    TEXT,
  es_foraneo_actual            BOOLEAN,
  carrera_sigue_deseada        SMALLINT CHECK (carrera_sigue_deseada BETWEEN 1 AND 5),
  gusto_escritura_actual       SMALLINT CHECK (gusto_escritura_actual BETWEEN 1 AND 5),
  uso_ia_comprension_actual    SMALLINT CHECK (uso_ia_comprension_actual BETWEEN 1 AND 5),
  uso_ia_resumen_actual        SMALLINT CHECK (uso_ia_resumen_actual BETWEEN 1 AND 5),
  uso_ia_ideas_actual          SMALLINT CHECK (uso_ia_ideas_actual BETWEEN 1 AND 5),
  uso_ia_redaccion_actual      SMALLINT CHECK (uso_ia_redaccion_actual BETWEEN 1 AND 5),
  uso_ia_tareas_actual         SMALLINT CHECK (uso_ia_tareas_actual BETWEEN 1 AND 5),
  uso_ia_verificacion_actual   SMALLINT CHECK (uso_ia_verificacion_actual BETWEEN 1 AND 5),
  uso_ia_critico_actual        SMALLINT CHECK (uso_ia_critico_actual BETWEEN 1 AND 5),
  uso_ia_traduccion_actual     SMALLINT CHECK (uso_ia_traduccion_actual BETWEEN 1 AND 5),
  uso_ia_idiomas_actual        SMALLINT CHECK (uso_ia_idiomas_actual BETWEEN 1 AND 5),
  horas_dedicacion_estudio     TEXT,
  cambios_perfil               JSONB DEFAULT '{}'::jsonb,

  -- SECCIÓN 2: Autopercepción del aprendizaje
  autopercepcion_aprendizaje   SMALLINT CHECK (autopercepcion_aprendizaje BETWEEN 1 AND 5),
  esfuerzo_dedicado            SMALLINT CHECK (esfuerzo_dedicado BETWEEN 1 AND 5),
  comprension_temas_propia     SMALLINT CHECK (comprension_temas_propia BETWEEN 1 AND 5),
  preparacion_evaluacion       SMALLINT CHECK (preparacion_evaluacion BETWEEN 1 AND 5),
  cumplimiento_entregas        SMALLINT CHECK (cumplimiento_entregas BETWEEN 1 AND 5),
  dificultades                 TEXT[],
  detalle_dificultades         TEXT,

  -- SECCIÓN 3: Relevancia profesional
  utilidad_profesional         SMALLINT CHECK (utilidad_profesional BETWEEN 1 AND 5),
  aplicacion_practica          SMALLINT CHECK (aplicacion_practica BETWEEN 1 AND 5),
  actualidad_contenidos        SMALLINT CHECK (actualidad_contenidos BETWEEN 1 AND 5),
  motivacion_post_curso        SMALLINT CHECK (motivacion_post_curso BETWEEN 1 AND 5),

  -- SECCIÓN 4A: Contenido y metodología
  claridad_explicaciones       SMALLINT CHECK (claridad_explicaciones BETWEEN 1 AND 5),
  pertinencia_tareas           SMALLINT CHECK (pertinencia_tareas BETWEEN 1 AND 5),
  claridad_instrucciones       SMALLINT CHECK (claridad_instrucciones BETWEEN 1 AND 5),
  ritmo_clase                  SMALLINT CHECK (ritmo_clase BETWEEN 1 AND 5),
  calidad_recursos             SMALLINT CHECK (calidad_recursos BETWEEN 1 AND 5),

  -- SECCIÓN 4B: Evaluación
  justicia_evaluacion          SMALLINT CHECK (justicia_evaluacion BETWEEN 1 AND 5),
  retroalimentacion_recibida   SMALLINT CHECK (retroalimentacion_recibida BETWEEN 1 AND 5),

  -- SECCIÓN 4C: Docente
  puntualidad_docente          SMALLINT CHECK (puntualidad_docente BETWEEN 1 AND 5),
  trato_docente                SMALLINT CHECK (trato_docente BETWEEN 1 AND 5),
  dominio_tema                 SMALLINT CHECK (dominio_tema BETWEEN 1 AND 5),
  estrategias_didacticas       SMALLINT CHECK (estrategias_didacticas BETWEEN 1 AND 5),
  disponibilidad_docente       SMALLINT CHECK (disponibilidad_docente BETWEEN 1 AND 5),

  -- SECCIÓN 4D: Tutorías (NULL = no aplica)
  satisfaccion_tutorias        SMALLINT CHECK (satisfaccion_tutorias BETWEEN 1 AND 5),
  facilidad_reserva_tutoria    SMALLINT CHECK (facilidad_reserva_tutoria BETWEEN 1 AND 5),

  -- SECCIÓN 5: Texto libre
  fortalezas_curso             TEXT,
  sugerencias_mejora           TEXT,
  comentario_libre             TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (estudiante_id, curso_id, tipo)
);

-- Trigger updated_at (verificar si ya existe la función update_updated_at_column)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

CREATE TRIGGER set_encuesta_parcial_updated_at
  BEFORE UPDATE ON encuesta_parcial
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE encuesta_parcial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ep_estudiante_own" ON encuesta_parcial
  FOR ALL USING (auth_user_id = auth.uid()::text)
  WITH CHECK (auth_user_id = auth.uid()::text);

CREATE POLICY "ep_profesor_lee_sus_cursos" ON encuesta_parcial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM estudiantes e
      WHERE e.id = encuesta_parcial.estudiante_id
        AND e.profesor_id = auth.uid()
    )
  );

-- RPC para detectar encuestas pendientes (usada en student/layout.tsx)
CREATE OR REPLACE FUNCTION get_encuestas_parciales_pendientes(p_auth_user_id TEXT)
RETURNS TABLE(curso_id UUID, asignatura TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, c.asignatura
  FROM estudiantes e
  JOIN cursos c ON c.id = e.curso_id
  WHERE e.auth_user_id = p_auth_user_id::uuid
    AND e.estado = 'activo'
    AND c.encuesta_parcial_habilitada = TRUE
    AND c.fecha_inicio IS NOT NULL
    AND c.fecha_fin IS NOT NULL
    AND NOW() BETWEEN c.fecha_inicio::timestamptz AND c.fecha_fin::timestamptz
    AND (EXTRACT(EPOCH FROM (NOW() - c.fecha_inicio::timestamptz))
        / EXTRACT(EPOCH FROM (c.fecha_fin::timestamptz - c.fecha_inicio::timestamptz))) >= 0.50
    AND NOT EXISTS (
      SELECT 1 FROM encuesta_parcial ep
      WHERE ep.estudiante_id = e.id
        AND ep.curso_id = c.id
        AND ep.tipo = 'mitad'
    );
$$;
