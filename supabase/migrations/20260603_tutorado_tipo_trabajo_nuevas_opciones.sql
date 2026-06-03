-- Ampliar CHECK de tipo_trabajo en tutorado_perfil
-- Nuevas opciones: disertacion_academica, ensayo_academico, producto_educomunicacional

ALTER TABLE public.tutorado_perfil
  DROP CONSTRAINT IF EXISTS tutorado_perfil_tipo_trabajo_check;

ALTER TABLE public.tutorado_perfil
  ADD CONSTRAINT tutorado_perfil_tipo_trabajo_check
  CHECK (tipo_trabajo IN (
    'articulo_cientifico',
    'sistematizacion_experiencias',
    'creacion_productos',
    'examen_complexivo',
    'proyecto_investigacion',
    'disertacion_academica',
    'ensayo_academico',
    'producto_educomunicacional',
    'otro'
  ));
