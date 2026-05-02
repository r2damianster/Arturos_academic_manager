ALTER TABLE public.cursos DROP CONSTRAINT IF EXISTS cursos_num_parciales_check;
ALTER TABLE public.cursos ADD CONSTRAINT cursos_num_parciales_check CHECK (num_parciales >= 1 AND num_parciales <= 4);
