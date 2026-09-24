-- Se elimina el sistema keep-alive (cron + tablas). Las tablas solo guardaban pings desechables.
DROP TABLE IF EXISTS public.sistema_heartbeat;
DROP TABLE IF EXISTS public.sistema_status;
