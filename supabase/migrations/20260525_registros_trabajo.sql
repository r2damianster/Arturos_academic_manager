-- Registros de trabajo: el profesor abre una convocatoria para que los estudiantes se registren
CREATE TABLE IF NOT EXISTS public.registros_trabajo (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id               UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo                 TEXT NOT NULL,
  tipo                   TEXT NOT NULL DEFAULT 'Otro',
  instrucciones          TEXT,
  criterios              JSONB DEFAULT '[]'::jsonb,
  validacion_automatica  BOOLEAN NOT NULL DEFAULT false,
  activo                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Envíos de estudiantes a un registro abierto
CREATE TABLE IF NOT EXISTS public.envios_registro (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_id         UUID NOT NULL REFERENCES public.registros_trabajo(id) ON DELETE CASCADE,
  estudiante_id       UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','aprobado','rechazado')),
  comentario_profesor TEXT,
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  revisado_at         TIMESTAMPTZ,
  UNIQUE (registro_id, estudiante_id)
);

-- RLS
ALTER TABLE public.registros_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_registro   ENABLE ROW LEVEL SECURITY;

-- Profesor: CRUD total sobre sus registros
CREATE POLICY "profesor_own_registros" ON public.registros_trabajo
  FOR ALL USING (profesor_id = auth.uid());

-- Estudiante: solo lectura de registros activos de sus cursos
CREATE POLICY "estudiante_lee_registros_activos" ON public.registros_trabajo
  FOR SELECT USING (
    activo = true
    AND curso_id IN (
      SELECT curso_id FROM public.estudiantes
      WHERE auth_user_id = auth.uid()
    )
  );

-- Profesor: lectura de envíos de sus registros
CREATE POLICY "profesor_lee_envios" ON public.envios_registro
  FOR SELECT USING (
    registro_id IN (
      SELECT id FROM public.registros_trabajo WHERE profesor_id = auth.uid()
    )
  );

-- Profesor: puede update envíos para aprobar/rechazar
CREATE POLICY "profesor_update_envios" ON public.envios_registro
  FOR UPDATE USING (
    registro_id IN (
      SELECT id FROM public.registros_trabajo WHERE profesor_id = auth.uid()
    )
  );

-- Estudiante: INSERT su propio envío (solo si el registro está activo y es de su curso)
CREATE POLICY "estudiante_insert_envio" ON public.envios_registro
  FOR INSERT WITH CHECK (
    estudiante_id IN (
      SELECT id FROM public.estudiantes WHERE auth_user_id = auth.uid()
    )
    AND registro_id IN (
      SELECT r.id FROM public.registros_trabajo r
      JOIN public.estudiantes e ON e.curso_id = r.curso_id
      WHERE r.activo = true AND e.auth_user_id = auth.uid()
    )
  );

-- Estudiante: lectura de sus propios envíos
CREATE POLICY "estudiante_lee_propio_envio" ON public.envios_registro
  FOR SELECT USING (
    estudiante_id IN (
      SELECT id FROM public.estudiantes WHERE auth_user_id = auth.uid()
    )
  );

-- Estudiante: puede reenviar si su envío fue rechazado (UPDATE propio en estado rechazado)
CREATE POLICY "estudiante_reenviar_rechazado" ON public.envios_registro
  FOR UPDATE USING (
    estudiante_id IN (
      SELECT id FROM public.estudiantes WHERE auth_user_id = auth.uid()
    )
    AND estado = 'rechazado'
  );
