-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN DE SEGURIDAD: Habilitar RLS en todas las tablas públicas
-- Soluciona la alerta de Supabase: rls_disabled_in_public
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS dinámicamente en cualquier tabla del esquema public que no lo tenga activado
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = false
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        RAISE NOTICE 'RLS habilitado para la tabla: %', r.tablename;
    END LOOP;
END $$;

