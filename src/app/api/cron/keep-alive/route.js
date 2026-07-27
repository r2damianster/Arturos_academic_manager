/* api/cron/keep-alive
 * Cron de mantenimiento: consulta ligera a Supabase para mantener la base de datos activa.
 *
 * Uso:
 *   - Vercel cron puede ejecutar esta ruta cada 30 minutos.
 *   - También puede llamarse manualmente con el header Authorization: Bearer <CRON_SECRET>
 *
 * Configuración en Vercel (vercel.json):
 *   {
 *     "crons": [{ "path": "/api/cron/keep-alive", "schedule": "*/30 * * * *" }]
 *   }
 */

export async function GET(req) {
    const cronSecret  = process.env.CRON_SECRET || '';
    const authHeader  = req.headers.get('authorization') || '';
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (cronSecret && !isVercelCron) {
        const provided = authHeader.replace('Bearer ', '').trim();
        if (provided !== cronSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const SB_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SB_URL || !SB_SERVICE) {
        return Response.json(
            { error: 'Missing required environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
            { status: 500 }
        );
    }

    try {
        // 1. INSERT heartbeat (WRITE a BD)
        const insertResponse = await fetch(
            `${SB_URL}/rest/v1/sistema_heartbeat`,
            {
                method: 'POST',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    evento: 'keep-alive-ping',
                    endpoint: 'api/cron/keep-alive'
                })
            }
        );

        if (!insertResponse.ok) {
            const text = await insertResponse.text();
            throw new Error(`Heartbeat INSERT failed: ${insertResponse.status} ${text}`);
        }

        // 2. DELETE old pings (cleanup, + otra WRITE)
        const deleteResponse = await fetch(
            `${SB_URL}/rest/v1/sistema_heartbeat?timestamp=lte.${new Date(Date.now() - 3600000).toISOString()}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`
                }
            }
        );

        if (!deleteResponse.ok) {
            const text = await deleteResponse.text();
            throw new Error(`Heartbeat DELETE failed: ${deleteResponse.status} ${text}`);
        }

        // 3. Verificar estado BD con SELECT
        const selectResponse = await fetch(
            `${SB_URL}/rest/v1/estudiantes?select=id&limit=1`,
            {
                method: 'GET',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`
                }
            }
        );

        if (!selectResponse.ok) {
            const text = await selectResponse.text();
            throw new Error(`Select query failed: ${selectResponse.status} ${text}`);
        }

        const rows = await selectResponse.json();
        const rowsCount = Array.isArray(rows) ? rows.length : 0;

        // 4. UPDATE sistema_status con timestamp de última ejecución
        const now = new Date().toISOString();
        const nextExecution = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const updateStatusResponse = await fetch(
            `${SB_URL}/rest/v1/sistema_status?id=eq.keep-alive-status`,
            {
                method: 'PATCH',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ultima_ejecucion: now,
                    proxima_ejecucion_esperada: nextExecution,
                    total_ejecuciones: 'total_ejecuciones + 1',  // incrementa
                    ultima_operacion: 'INSERT + DELETE + SELECT ok',
                    updated_at: now
                })
            }
        );

        if (!updateStatusResponse.ok) {
            const text = await updateStatusResponse.text();
            console.warn(`⚠ Status update failed (no-blocking): ${updateStatusResponse.status} ${text}`);
        }

        console.log(`🟢 keep-alive: INSERT + DELETE + SELECT successful. DB active. Estudiantes: ${rowsCount}. Last run: ${now}`);

        return Response.json({
            success: true,
            warmed: true,
            operations: ['INSERT heartbeat', 'DELETE old records', 'SELECT check', 'UPDATE status'],
            returnedRows: rowsCount,
            lastExecution: now,
            nextExpected: nextExecution,
            timestamp: now
        });
    } catch (error) {
        console.error('❌ keep-alive error:', error.message);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    return GET(req);
}
