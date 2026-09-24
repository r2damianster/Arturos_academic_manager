const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function cleanRetirados() {
  const filId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const retiradosIds = [
    'dfa16749-d0ed-40b5-b137-4708d73c6979', // 1315493369
    '6fae847e-fc30-4249-b3f5-b86b3ba122c6', // Mirka Jimenez
    '5ead6956-69e8-42a8-8149-33b75ae797ee'  // Luis Pin
  ];

  console.log("Removing 2026-09-17 records for retirados...");

  const { error: pErr } = await supabase
    .from('participacion')
    .delete()
    .eq('curso_id', filId)
    .eq('fecha', '2026-09-17')
    .in('estudiante_id', retiradosIds);

  if (pErr) console.error("Error cleaning participacion:", pErr);
  else console.log("✅ Participación limpia para retirados.");

  const { error: aErr } = await supabase
    .from('asistencia')
    .delete()
    .eq('curso_id', filId)
    .eq('fecha', '2026-09-17')
    .in('estudiante_id', retiradosIds);

  if (aErr) console.error("Error cleaning asistencia:", aErr);
  else console.log("✅ Asistencia limpia para retirados.");
}

cleanRetirados().catch(console.error);

