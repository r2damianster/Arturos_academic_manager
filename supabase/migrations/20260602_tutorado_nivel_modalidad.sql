-- Actualizar modalidad_trabajo a nivel académico + nueva columna tipo_trabajo

-- 1. Migrar valor legacy 'articulo' → 'otro' antes de cambiar el CHECK
UPDATE public.tutorado_perfil
  SET modalidad_trabajo = 'otro'
  WHERE modalidad_trabajo = 'articulo';

-- 2. Soltar constraint viejo y crear nuevo
ALTER TABLE public.tutorado_perfil
  DROP CONSTRAINT IF EXISTS tutorado_perfil_modalidad_trabajo_check;

ALTER TABLE public.tutorado_perfil
  ADD CONSTRAINT tutorado_perfil_modalidad_trabajo_check
  CHECK (modalidad_trabajo IN ('pregrado','maestria','doctorado','tecnologia','otro'));

-- 3. Nueva columna para modalidad/tipo de trabajo de titulación
ALTER TABLE public.tutorado_perfil
  ADD COLUMN IF NOT EXISTS tipo_trabajo TEXT
  CHECK (tipo_trabajo IN (
    'articulo_cientifico',
    'sistematizacion_experiencias',
    'creacion_productos',
    'examen_complexivo',
    'proyecto_investigacion',
    'otro'
  ));
