const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectExactRecords() {
  const cursoId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const fecha = '2026-09-17';

  console.log(`=== CHECKING EXACT RECORDS FOR CURSO=${cursoId} FECHA=${fecha} ===`);

  // 1. Asistencia
  const { data: asis, error: aErr } = await supabase
    .from('asistencia')
    .select('*, estudiantes(nombre)')
    .eq('curso_id', cursoId)
    .eq('fecha', fecha);

  console.log(`\nASISTENCIA RECORDS (${asis?.length || 0}):`, aErr || '');
  asis?.forEach((a, i) => {
    console.log(`${i+1}. [${a.estado}] ${a.estudiantes?.nombre || a.estudiante_id} | bitacora_id: ${a.bitacora_id}`);
  });

  // 2. Participacion
  const { data: part, error: pErr } = await supabase
    .from('participacion')
    .select('*, estudiantes(nombre)')
    .eq('curso_id', cursoId)
    .eq('fecha', fecha);

  console.log(`\nPARTICIPACION RECORDS (${part?.length || 0}):`, pErr || '');
  part?.forEach((p, i) => {
    console.log(`${i+1}. [Nivel: ${p.nivel}] ${p.estudiantes?.nombre || p.estudiante_id} | obs: ${p.observacion}`);
  });

  // 3. Calificaciones items
  const { data: items, error: iErr } = await supabase
    .from('calificaciones_items')
    .select('*, estudiantes(nombre)')
    .eq('curso_id', cursoId)
    .eq('fuente', 'en_curso');

  console.log(`\nCALIFICACIONES_ITEMS (EN_CURSO) RECORDS (${items?.length || 0}):`, iErr || '');
  items?.forEach((ci, i) => {
    console.log(`${i+1}. [Nota: ${ci.nota}] ${ci.estudiantes?.nombre || ci.estudiante_id} | Item: ${ci.nombre_item}`);
  });
}

inspectExactRecords().catch(console.error);

