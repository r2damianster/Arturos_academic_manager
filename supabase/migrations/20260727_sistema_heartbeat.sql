-- Tabla para keep-alive: registra pings para mantener BD activa
CREATE TABLE IF NOT EXISTS sistema_heartbeat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT DEFAULT 'api/cron/keep-alive'
);

-- Sin RLS (lo usa SERVICE ROLE directamente)
ALTER TABLE sistema_heartbeat DISABLE ROW LEVEL SECURITY;

-- Índice para limpiar antiguos
CREATE INDEX IF NOT EXISTS idx_sistema_heartbeat_timestamp
ON sistema_heartbeat(timestamp DESC);
