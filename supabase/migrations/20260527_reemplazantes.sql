-- Acceso temporal de reemplazantes para profesores
CREATE TABLE IF NOT EXISTS public.reemplazantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_reemplazante TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT '',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);

ALTER TABLE public.reemplazantes ENABLE ROW LEVEL SECURITY;

-- El profesor gestiona sus propios reemplazantes
CREATE POLICY "profesor_gestiona_reemplazantes"
  ON public.reemplazantes FOR ALL
  USING (profesor_id = auth.uid());

-- Función para que el middleware / layout detecte si un usuario es reemplazante activo
CREATE OR REPLACE FUNCTION public.get_reemplazante_info(p_email TEXT)
RETURNS TABLE(profesor_id UUID, nombre TEXT, fecha_inicio DATE, fecha_fin DATE)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.profesor_id, r.nombre, r.fecha_inicio, r.fecha_fin
  FROM public.reemplazantes r
  WHERE r.email_reemplazante = p_email
    AND r.activo = TRUE
    AND CURRENT_DATE BETWEEN r.fecha_inicio AND r.fecha_fin
  LIMIT 1;
$$;
