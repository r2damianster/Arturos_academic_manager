-- Agregar auth_user_id a la tabla estudiantes para vincular estudiantes con cuentas Supabase Auth.
-- Esta columna fue añadida directamente en el dashboard; esta migración documenta el cambio.

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estudiantes_auth_user_id ON public.estudiantes(auth_user_id);

COMMENT ON COLUMN public.estudiantes.auth_user_id IS
  'UUID de auth.users cuando el estudiante crea cuenta en el portal. Null si aún no tiene cuenta vinculada.';
