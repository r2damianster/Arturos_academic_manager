-- ============================================================
-- Sistema de Grupos en Clases
-- grupo_categorias · grupos_clase · grupo_integrantes · grupo_participacion
-- ============================================================

-- Categorías predefinidas de nombres de grupo
CREATE TABLE IF NOT EXISTS public.grupo_categorias (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  TEXT NOT NULL,
  valores TEXT[] NOT NULL DEFAULT '{}',
  orden   INT DEFAULT 0
);

INSERT INTO public.grupo_categorias (nombre, valores, orden) VALUES
('Países',   ARRAY['Albania','Brasil','Chile','Dinamarca','Egipto','Francia','Grecia',
                   'Holanda','Italia','Japón','Kenya','Líbano','México','Nepal','Omán',
                   'Perú','Qatar','Rusia','Suecia','Túnez'], 1),
('Colores',  ARRAY['Rojo','Azul','Verde','Amarillo','Naranja','Morado','Rosa',
                   'Turquesa','Café','Blanco'], 2),
('Planetas', ARRAY['Mercurio','Venus','Tierra','Marte','Júpiter','Saturno','Urano','Neptuno'], 3),
('Animales', ARRAY['Águila','Búho','Cóndor','Delfín','Elefante','Flamenco',
                   'Guepardo','Halcón','Iguana','Jaguar'], 4),
('Personalizado', ARRAY[]::TEXT[], 99);

-- Instancias de grupos por sesión de clase
CREATE TABLE IF NOT EXISTS public.grupos_clase (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bitacora_id     UUID REFERENCES public.bitacora_clase(id) ON DELETE CASCADE,
  curso_id        UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
  profesor_id     UUID NOT NULL REFERENCES public.profesores(id),
  nombre          TEXT NOT NULL,
  categoria       TEXT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('aleatoria','manual','afinidad')),
  orden           INT DEFAULT 0,
  abierto         BOOLEAN DEFAULT true,
  max_integrantes INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Integrantes de cada grupo
CREATE TABLE IF NOT EXISTS public.grupo_integrantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id      UUID NOT NULL REFERENCES public.grupos_clase(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  asignado_por  TEXT DEFAULT 'profesor' CHECK (asignado_por IN ('profesor','estudiante')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grupo_id, estudiante_id)
);

-- Trigger: un estudiante solo puede estar en un grupo por sesión
CREATE OR REPLACE FUNCTION public.check_unique_grupo_sesion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_bitacora_id UUID;
BEGIN
  SELECT bitacora_id INTO v_bitacora_id
  FROM public.grupos_clase WHERE id = NEW.grupo_id;

  IF v_bitacora_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.grupo_integrantes gi
    JOIN public.grupos_clase gc ON gc.id = gi.grupo_id
    WHERE gi.estudiante_id = NEW.estudiante_id
      AND gc.bitacora_id = v_bitacora_id
      AND gi.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'El estudiante ya pertenece a otro grupo en esta sesión';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_unique_grupo_sesion
  BEFORE INSERT ON public.grupo_integrantes
  FOR EACH ROW EXECUTE FUNCTION public.check_unique_grupo_sesion();

-- Notas de participación por sesión (provisional durante la clase)
CREATE TABLE IF NOT EXISTS public.grupo_participacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id      UUID REFERENCES public.grupos_clase(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  bitacora_id   UUID NOT NULL REFERENCES public.bitacora_clase(id) ON DELETE CASCADE,
  nota          NUMERIC(4,1) CHECK (nota BETWEEN 0 AND 10),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (estudiante_id, bitacora_id)
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.grupo_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_integrantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_participacion ENABLE ROW LEVEL SECURITY;

-- Categorías: lectura pública (presets globales)
CREATE POLICY "todos_leen_categorias"
  ON public.grupo_categorias FOR SELECT USING (true);

-- Grupos: profesor dueño (CRUD completo)
CREATE POLICY "profesor_gestiona_grupos"
  ON public.grupos_clase FOR ALL
  USING (profesor_id = auth.uid());

-- Grupos abiertos de afinidad: estudiante puede leer para unirse
CREATE POLICY "estudiante_ve_grupos_afinidad"
  ON public.grupos_clase FOR SELECT
  USING (abierto = true AND tipo = 'afinidad');

-- Integrantes: profesor dueño del grupo
CREATE POLICY "profesor_gestiona_integrantes"
  ON public.grupo_integrantes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_clase g
      WHERE g.id = grupo_id AND g.profesor_id = auth.uid()
    )
  );

-- Integrantes: estudiante ve sus propios registros
CREATE POLICY "estudiante_ve_sus_integrantes"
  ON public.grupo_integrantes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.estudiantes e
      WHERE e.id = estudiante_id AND e.auth_user_id = auth.uid()
    )
  );

-- Integrantes: estudiante se une a grupo abierto de afinidad
CREATE POLICY "estudiante_se_une_grupo"
  ON public.grupo_integrantes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estudiantes e
      WHERE e.id = estudiante_id AND e.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.grupos_clase g
      WHERE g.id = grupo_id AND g.abierto = true AND g.tipo = 'afinidad'
    )
  );

-- Integrantes: estudiante puede salir si el grupo está abierto
CREATE POLICY "estudiante_sale_grupo"
  ON public.grupo_integrantes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.estudiantes e
      WHERE e.id = estudiante_id AND e.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.grupos_clase g
      WHERE g.id = grupo_id AND g.abierto = true
    )
  );

-- Participación: profesor dueño del grupo
CREATE POLICY "profesor_gestiona_participacion"
  ON public.grupo_participacion FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grupos_clase g
      WHERE g.id = grupo_id AND g.profesor_id = auth.uid()
    )
  );
