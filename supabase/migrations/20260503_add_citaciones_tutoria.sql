CREATE TABLE IF NOT EXISTS public.citaciones_tutoria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profesor_id UUID NOT NULL REFERENCES public.profesores(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    fecha_citacion DATE NOT NULL DEFAULT CURRENT_DATE,
    razon VARCHAR(50) NOT NULL, -- 'inasistencia', 'bajo_desempeño', 'asignacion_trabajo', 'otro'
    detalle_razon TEXT,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'agendada', 'asistida', 'no_asistida', 'cumplida'
    reserva_id INTEGER REFERENCES public.reservas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.citaciones_tutoria ENABLE ROW LEVEL SECURITY;

-- Policy: Profesor can manage citations of their own students
DROP POLICY IF EXISTS "profesor_gestiona_citaciones" ON public.citaciones_tutoria;
CREATE POLICY "profesor_gestiona_citaciones" ON public.citaciones_tutoria
    FOR ALL
    USING (profesor_id = auth.uid());

-- Policy: Estudiantes can see their own citations
DROP POLICY IF EXISTS "estudiante_ve_sus_citaciones" ON public.citaciones_tutoria;
CREATE POLICY "estudiante_ve_sus_citaciones" ON public.citaciones_tutoria
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.estudiantes e
        WHERE e.id = citaciones_tutoria.estudiante_id
        AND e.auth_user_id = auth.uid()
      )
    );
