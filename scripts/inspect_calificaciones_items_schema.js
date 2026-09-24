const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectCalificacionesItems() {
  const { data, error } = await supabase.from('calificaciones_items').select('*').limit(3);
  console.log("calificaciones_items sample:", error || data);

  const filId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const { data: itemsFil } = await supabase.from('calificaciones_items').select('*').eq('curso_id', filId);
  console.log(`Calificaciones items for Filosofia (${filId}): count=${itemsFil?.length}`);
  if (itemsFil && itemsFil.length > 0) {
    console.log("Keys:", Object.keys(itemsFil[0]));
    console.log("Sample row:", itemsFil[0]);
  }
}

inspectCalificacionesItems().catch(console.error);
