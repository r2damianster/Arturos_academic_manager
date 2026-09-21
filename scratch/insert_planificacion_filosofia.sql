-- ═══════════════════════════════════════════════════════════════════════════
-- GESTOR UNIVERSITARIO — Carga de Planificación de Filosofía (21 - 24 Sep 2026)
-- Copiar y Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Asegurar tablas principales (si no existen)
CREATE TABLE IF NOT EXISTS public.profesores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  institucion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  asignatura TEXT NOT NULL,
  periodo TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  horas_semana INTEGER DEFAULT 16,
  num_sesiones INTEGER DEFAULT 8,
  horas_teoricas INTEGER DEFAULT 16,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profesor_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.horarios_clases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  aula TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bitacora_clase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  semana TEXT,
  tema TEXT NOT NULL,
  actividades TEXT,
  actividades_json JSONB DEFAULT '[]'::jsonb,
  materiales TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'planificado' CHECK (estado IN ('planificado', 'cumplido')),
  sin_planificacion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(curso_id, fecha)
);

CREATE TABLE IF NOT EXISTS public.logros_aprendizaje (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función para calcular semana
CREATE OR REPLACE FUNCTION public.calcular_semana(p_curso_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_inicio DATE;
  v_semana INT;
BEGIN
  SELECT fecha_inicio INTO v_inicio FROM public.cursos WHERE id = p_curso_id;
  IF v_inicio IS NULL THEN
    RETURN 'Semana 1';
  END IF;
  v_semana := FLOOR((CURRENT_DATE - v_inicio) / 7) + 1;
  IF v_semana < 1 THEN v_semana := 1; END IF;
  RETURN 'Semana ' || v_semana;
END;
$$;

-- 2. Insertar / Resolver datos en bloque plpgsql
DO $$
DECLARE
  v_profesor_id UUID;
  v_curso_id UUID;
BEGIN
  SELECT id INTO v_profesor_id FROM public.profesores LIMIT 1;
  
  IF v_profesor_id IS NULL THEN
    INSERT INTO public.profesores (nombre, email)
    VALUES ('Profesor de Filosofía', 'profesor@universidad.edu')
    RETURNING id INTO v_profesor_id;
  END IF;

  -- 3. Insertar/Obtener Curso
  SELECT id INTO v_curso_id FROM public.cursos 
  WHERE profesor_id = v_profesor_id AND asignatura ILIKE '%Filosofía%' LIMIT 1;

  IF v_curso_id IS NULL THEN
    INSERT INTO public.cursos (profesor_id, codigo, asignatura, periodo, fecha_inicio, fecha_fin, horas_semana, num_sesiones)
    VALUES (v_profesor_id, 'FIL101', 'Filosofía, Epistemología y Sociología de la Educación', '20262-1', '2026-09-21', '2027-01-31', 5, 32)
    RETURNING id INTO v_curso_id;
  END IF;

  -- 4. Horarios (Lunes 1, Jueves 4)
  DELETE FROM public.horarios_clases WHERE curso_id = v_curso_id;
  INSERT INTO public.horarios_clases (profesor_id, curso_id, dia_semana, hora_inicio, hora_fin, aula)
  VALUES 
    (v_profesor_id, v_curso_id, 1, '08:00', '11:00', 'Aula 101'),
    (v_profesor_id, v_curso_id, 4, '08:00', '10:00', 'Aula 101');

  -- 5. Logro de aprendizaje único
  DELETE FROM public.logros_aprendizaje WHERE curso_id = v_curso_id;
  INSERT INTO public.logros_aprendizaje (curso_id, descripcion, orden)
  VALUES (v_curso_id, 'Identifica los principios y corrientes del pensamiento filosófico y su vínculo con las tensiones educativas, argumentando una postura crítica sobre la ética profesional ante situaciones concretas del ámbito educativo.', 1);

  -- 6. Bitácora Sesión 1 (Lunes 21/09/2026)
  INSERT INTO public.bitacora_clase (
    profesor_id, curso_id, fecha, semana, tema, actividades_json, materiales, observaciones, estado, sin_planificacion
  ) VALUES (
    v_profesor_id, v_curso_id, '2026-09-21', 'Semana 1',
    '1.3 Tensiones Filosóficas: Del humanismo a la Educación crítica | 1.3. Habilidad blanda: pensamiento crítico propositivo.',
    '[
      {"actividad": "1. Control de lectura de libros individuales con doble ruleta digital (Estudiante + Pregunta clave sobre Homo Faber, Economicus, Estoicismo, Utilitarismo, Existencialismo, Zoon Politikon, Homo Viator)", "recurso": "Herramienta Ruleta Digital / Preguntas guías prediseñadas"},
      {"actividad": "2. Debate con r2-argumentum sobre las 12 posturas antropológicas", "recurso": "Plataforma Argumentum Host (https://r2-argumentum.vercel.app/host.html)"},
      {"actividad": "3. [35-75m] Exposición Magistral: Modelos Antropológicos en Tensión Dialéctica (Matriz de 12 modelos + Dinámica Embajadores Itinerantes e Anfitriones Fijos)", "recurso": "Diapositivas Antropología Filosófica (https://docs.google.com/presentation/d/1Xhe_xT-xXeROPYZEvsiCTrSY0n_inCbiZTMS9UCUHfo/edit?usp=sharing)"},
      {"actividad": "4. [75-140m] Taller Dialéctico en Plataforma Argumentum: Pensamiento crítico propositivo (Indagación IA + Careos Speed-Dating cronometrados de 90s + Rotación)", "recurso": "Plataforma Argumentum (https://r2-argumentum.vercel.app/)"},
      {"actividad": "5. [140-170m] Conexión Teórica: Del Humanismo a la Educación Crítica y Concientización Social", "recurso": "Diapositivas Tensiones Filosóficas (https://docs.google.com/presentation/d/1QJ6idfNY86jVplL0CYHqmwYdqSvEvHEt/edit?usp=sharing&ouid=117470340814742320349&rtpof=true&sd=true)"},
      {"actividad": "6. [170-180m] Orientación de Trabajo Autónomo Inter-sesión: Instrucciones para el visionado analítico de Death Note (Caps. 1 y 2)", "recurso": "Serie Death Note (Episodios 1 y 2)"}
    ]'::jsonb,
    'Diapositivas de Tensiones Filosóficas (Google Slides), Plataforma Argumentum (Host & Student).',
    'Trabajo autónomo inter-sesión: Visionado de Death Note (Caps. 1 y 2 - Careo moral L vs. Light Yagami).',
    'planificado', false
  )
  ON CONFLICT (curso_id, fecha) DO UPDATE SET
    tema = EXCLUDED.tema,
    actividades_json = EXCLUDED.actividades_json,
    materiales = EXCLUDED.materiales,
    observaciones = EXCLUDED.observaciones,
    sin_planificacion = false;

  -- 7. Bitácora Sesión 2 (Jueves 24/09/2026)
  INSERT INTO public.bitacora_clase (
    profesor_id, curso_id, fecha, semana, tema, actividades_json, materiales, observaciones, estado, sin_planificacion
  ) VALUES (
    v_profesor_id, v_curso_id, '2026-09-24', 'Semana 1',
    '1.4 Axiología y Ética profesional',
    '[
      {"actividad": "[00-30m] Control Oral por Ruletas: Dilemas de Death Note (Utilitarismo vs. Deontología, Existencialismo/Mala fe, Jerarquía Axiológica, Homo Demens, Estoicismo)", "recurso": "Ruleta Digital + Casos Death Note"},
      {"actividad": "[30-60m] Exposición Magistral: Axiología, Deontología Profesional y Nuevos Marcos Éticos (Virtudes de Aristóteles, Cuidado de Gilligan, Discurso de Habermas, Responsabilidad de Jonas)", "recurso": "Diapositivas Axiología y Marcos Éticos"},
      {"actividad": "[60-105m] Taller Aplicado: Resolución de Dilemas Éticos Clásicos mediante Arquitectura PEEL (Tranvía/Hombre corpulento, Cirujano Trasplantólogo, Náufragos Dudley & Stephens)", "recurso": "Guía de Dilemas + Matriz PEEL"},
      {"actividad": "[105-120m] Síntesis Plenaria y Asignación de Trabajo Autónomo: Orientación de lectura e indagación con IA para el bloque de Ontología", "recurso": "Lectura El Mundo de Sofía (Caps. 1, 3, 4 y 9)"}
    ]'::jsonb,
    'Presentación Axiología y Deontología, Guía de Casos y Dilemas Éticos, Estructura PEEL.',
    'Trabajo autónomo para la siguiente semana: Lectura e indagación con IA de El Mundo de Sofía (Caps. 1, 3, 4 y 9: El jardín del Edén, Filósofos de la naturaleza, Atomistas y Platón).',
    'planificado', false
  )
  ON CONFLICT (curso_id, fecha) DO UPDATE SET
    tema = EXCLUDED.tema,
    actividades_json = EXCLUDED.actividades_json,
    materiales = EXCLUDED.materiales,
    observaciones = EXCLUDED.observaciones,
    sin_planificacion = false;

END $$;

