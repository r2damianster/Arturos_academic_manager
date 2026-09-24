const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectConstraints() {
  console.log("=== INSPECTING PARTICIPACION & ASISTENCIA SAMPLES ===");

  const { data: pSample } = await supabase.from('participacion').select('nivel').limit(20);
  const pLevels = Array.from(new Set(pSample?.map(p => p.nivel)));
  console.log("Distinct participacion.nivel in DB:", pLevels);

  const { data: aSample } = await supabase.from('asistencia').select('estado').limit(50);
  const aStates = Array.from(new Set(aSample?.map(a => a.estado)));
  console.log("Distinct asistencia.estado in DB:", aStates);
}

inspectConstraints().catch(console.error);

