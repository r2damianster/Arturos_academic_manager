/* api/cron/keep-alive/status
 * Endpoint público para verificar última ejecución del keep-alive.
 * Retorna: última ejecución, próxima esperada, total de runs, últimos pings.
 */

export async function GET(req) {
    const SB_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SB_URL || !SB_SERVICE) {
        return Response.json(
            { error: 'Missing Supabase config' },
            { status: 500 }
        );
    }

    try {
        // 1. Fetch sistema_status
        const statusResponse = await fetch(
            `${SB_URL}/rest/v1/sistema_status?id=eq.keep-alive-status&select=*`,
            {
                method: 'GET',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`
                }
            }
        );

        if (!statusResponse.ok) {
            throw new Error(`Status fetch failed: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        const status = Array.isArray(statusData) && statusData.length > 0 ? statusData[0] : null;

        // 2. Fetch últimos pings (últimas 5 inserciones)
        const pingsResponse = await fetch(
            `${SB_URL}/rest/v1/sistema_heartbeat?order=timestamp.desc&limit=5&select=id,evento,timestamp,endpoint`,
            {
                method: 'GET',
                headers: {
                    'apikey':        SB_SERVICE,
                    'Authorization': `Bearer ${SB_SERVICE}`
                }
            }
        );

        if (!pingsResponse.ok) {
            throw new Error(`Pings fetch failed: ${pingsResponse.status}`);
        }

        const pings = await pingsResponse.json();

        // 3. Retornar status completo
        return Response.json({
            success: true,
            status: status ? {
                ultimaEjecucion: status.ultima_ejecucion,
                proximaEjecucionEsperada: status.proxima_ejecucion_esperada,
                totalEjecuciones: status.total_ejecuciones,
                ultimaOperacion: status.ultima_operacion,
                estado: status.estado,
                actualizadoEn: status.updated_at
            } : { error: 'No status record found' },
            ultimosPings: pings.slice(0, 5).map(p => ({
                timestamp: p.timestamp,
                evento: p.evento,
                endpoint: p.endpoint
            })),
            ahora: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Status endpoint error:', error.message);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
