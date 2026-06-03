-- Ciclo de vida de cursos: activo → finalizado → archivado
ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'finalizado', 'archivado')),
  ADD COLUMN IF NOT EXISTS link_publicacion TEXT;

-- Auto-finalizar cursos cuya fecha_fin ya pasó
UPDATE public.cursos
  SET estado = 'finalizado'
  WHERE fecha_fin IS NOT NULL
    AND fecha_fin::date < CURRENT_DATE
    AND estado = 'activo';
