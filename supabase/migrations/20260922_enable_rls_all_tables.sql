-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURIDAD: habilitar RLS en tablas internas del keep-alive
-- Soluciona la alerta de Supabase: rls_disabled_in_public
--
-- Estado verificado en producción (hxsnyrutyyavvljxwgku, 2026-09-24): todas las
-- tablas de public ya tenían RLS salvo sistema_heartbeat y sistema_status
-- (las migraciones 20260727_* hacían DISABLE ROW LEVEL SECURITY).
--
-- Sin políticas = acceso denegado a anon/authenticated. Es intencional: solo
-- las rutas /api/cron/keep-alive y /api/cron/keep-alive/status las usan, con
-- SUPABASE_SERVICE_ROLE_KEY (bypasea RLS). No se crea ninguna política.
--
-- Deliberadamente explícita (NO un bucle dinámico sobre pg_tables): un bucle
-- activaría RLS sin políticas en tablas futuras y rompería la app en silencio.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.sistema_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sistema_status    ENABLE ROW LEVEL SECURITY;
