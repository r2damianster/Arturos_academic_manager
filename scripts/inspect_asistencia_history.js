const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectAsistenciaHistory() {
  const cursoId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const fecha = '2026-09-17';

  const { data: asis, error } = await supabase
    .from('asistencia')
    .select('*, estudiantes(nombre)')
    .eq('curso_id', cursoId)
    .eq('fecha', fecha);

  console.log(`=== ASISTENCIA RECORDS FOR ${fecha} (${asis?.length}) ===`);
  asis?.forEach((a, i) => {
    console.log(`${i+1}. [${a.estado}] ${a.estudiantes?.nombre} | created_at: ${a.created_at} | obs: ${a.observacion_part}`);
  });
}

inspectAsistenciaHistory().catch(console.error);

