const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectBitacora() {
  const bitacoraId = 'd84a6640-e138-4b33-8a93-a08ea8c8a79c';
  
  // 1. Fetch bitacora
  const { data: b, error: bErr } = await supabase
    .from('bitacora_clase')
    .select('*')
    .eq('id', bitacoraId)
    .single();

  console.log("=== BITACORA ===", bErr || b);

  if (b) {
    const cursoId = b.curso_id;
    const fecha = b.fecha;
    console.log(`Bitacora Curso ID: ${cursoId}, Fecha: ${fecha}`);

    // 2. Fetch asistencia for this bitacora_id or (curso_id, fecha)
    const { data: asis } = await supabase
      .from('asistencia')
      .select('*')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha);

    console.log(`Asistencia records count for fecha=${fecha}: ${asis?.length}`);
    if (asis && asis.length > 0) {
      console.log("Sample asistencia row:", asis[0]);
      console.log("Asistencia bitacora_ids:", Array.from(new Set(asis.map(a => a.bitacora_id))));
    }

    // 3. Fetch participacion for fecha
    const { data: part } = await supabase
      .from('participacion')
      .select('*')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha);

    console.log(`Participacion records count for fecha=${fecha}: ${part?.length}`);

    // 4. Fetch calificaciones_items for fuente='en_curso' and calificaciones_notas
    const { data: items } = await supabase
      .from('calificaciones_items')
      .select('*, calificaciones_notas(*)')
      .eq('curso_id', cursoId);

    console.log(`Calificaciones items for curso: ${items?.length}`);
    items?.forEach(it => {
      console.log(`- Item: "${it.nombre}" | Fuente: ${it.fuente} | Fecha: ${it.fecha_evaluacion || it.created_at} | Notas count: ${it.calificaciones_notas?.length}`);
    });
  }
}

inspectBitacora().catch(console.error);
