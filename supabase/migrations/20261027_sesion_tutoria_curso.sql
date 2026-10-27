-- Sesiones grupales de "tutoría de curso" (horarios_clases.tipo = 'tutoria_curso').
-- Se registran en reservas (origen = 'sesion_curso'), NO en asistencia: no afectan promedios ni riesgo.

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS sesion_grupo_id UUID;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS estudiante_id UUID REFERENCES public.estudiantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_sesion_grupo ON public.reservas (sesion_grupo_id) WHERE sesion_grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_estudiante ON public.reservas (estudiante_id) WHERE estudiante_id IS NOT NULL;
