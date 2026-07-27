/* lib/agents/keep-alive.js
 * Skill reusable para mantener Supabase despierto.
 * Puede usarse desde un cron, un endpoint o cualquier módulo interno.
 */

async function pingSupabase(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('pingSupabase: missing Supabase URL or key');
    }

    const response = await fetch(
        `${supabaseUrl}/rest/v1/estudiantes?select=id&limit=1`,
        {
            method: 'GET',
            headers: {
                'apikey':        supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase keep-alive failed: ${response.status} ${text}`);
    }

    const rows = await response.json();
    return {
        rowsCount: Array.isArray(rows) ? rows.length : 0,
        timestamp: new Date().toISOString()
    };
}

module.exports = { pingSupabase };
