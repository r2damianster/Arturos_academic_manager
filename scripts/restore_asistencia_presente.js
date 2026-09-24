const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function restoreAsistencia() {
  const cursoId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const fecha = '2026-09-17';

  console.log(`=== RESTORING ASISTENCIA = PRESENTE FOR ALL ACTIVE STUDENTS ON ${fecha} ===`);

  const { data: students } = await supabase
    .from('estudiantes')
    .select('id')
    .eq('curso_id', cursoId)
    .neq('estado', 'retirado');

  const activeIds = students?.map(s => s.id) || [];

  const { error } = await supabase
    .from('asistencia')
    .update({ estado: 'Presente', observacion_part: null })
    .eq('curso_id', cursoId)
    .eq('fecha', fecha)
    .in('estudiante_id', activeIds);

  if (error) {
    console.error("Error restoring asistencia:", error);
  } else {
    console.log(`✅ Asistencia restaurada a PRESENTE para todos los ${activeIds.length} estudiantes activos del 17-Sep!`);
  }
}

restoreAsistencia().catch(console.error);

