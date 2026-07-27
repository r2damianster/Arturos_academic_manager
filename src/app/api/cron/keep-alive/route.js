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
        const response = await fetch(
            `${SB_URL}/rest/v1/estudiantes?select=id&limit=1`,
            {
                method: 'GET',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`
                }
            }
        );

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Supabase keep-alive failed: ${response.status} ${text}`);
        }

        const rows = await response.json();
        const rowsCount = Array.isArray(rows) ? rows.length : 0;

        console.log(`🟢 keep-alive: database woke up, estudiantes query returned ${rowsCount} rows`);

        return Response.json({
            success: true,
            warmed: true,
            returnedRows: rowsCount,
            timestamp: new Date().toISOString()
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
