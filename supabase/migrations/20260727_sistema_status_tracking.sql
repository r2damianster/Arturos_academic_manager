-- Tabla para tracking de sistema (última ejecución de keep-alive, etc)
CREATE TABLE IF NOT EXISTS sistema_status (
    id TEXT PRIMARY KEY DEFAULT 'keep-alive-status',
    ultima_ejecucion TIMESTAMP WITH TIME ZONE,
    proxima_ejecucion_esperada TIMESTAMP WITH TIME ZONE,
    total_ejecuciones INT DEFAULT 0,
    ultima_operacion TEXT,
    estado TEXT DEFAULT 'activo',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sin RLS (SERVICE ROLE only)
ALTER TABLE sistema_status DISABLE ROW LEVEL SECURITY;

-- Insertar registro inicial
INSERT INTO sistema_status (id, ultima_ejecucion, proxima_ejecucion_esperada, total_ejecuciones, ultima_operacion)
VALUES ('keep-alive-status', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 minutes', 1, 'sistema inicializado')
ON CONFLICT (id) DO NOTHING;
