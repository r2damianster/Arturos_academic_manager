const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function main() {
  const filId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const { data: students, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, email, estado, retirado_at')
    .eq('curso_id', filId);

  if (error || !students) {
    console.error("Error fetching students:", error);
    return;
  }

  console.log(`=== CHECKING STUDENT STATUS (Total: ${students.length}) ===`);
  const activos = students.filter(s => s.estado === 'activo' || !s.estado);
  const retirados = students.filter(s => s.estado === 'retirado' || s.retirado_at !== null);
  const otros = students.filter(s => s.estado && s.estado !== 'activo' && s.estado !== 'retirado');

  console.log(`- Activos: ${activos.length}`);
  console.log(`- Retirados: ${retirados.length}`);
  console.log(`- Otros estados: ${otros.length}`);

  if (retirados.length > 0) {
    console.log("\nESTUDIANTES CON ESTADO 'RETIRADO':");
    retirados.forEach((s, idx) => {
      console.log(`${idx+1}. ID: ${s.id} | Nombre: ${s.nombre} | Email: ${s.email} | Estado: ${s.estado} | Retirado_at: ${s.retirado_at}`);
    });
  }

  console.log("\nESTADOS DE CADA ESTUDIANTE EN LA LISTA:");
  students.forEach((s, idx) => {
    console.log(`${idx+1}. [${(s.estado || 'sin_estado').padEnd(10)}] ${s.nombre} (Retirado_at: ${s.retirado_at || 'null'})`);
  });
}

main().catch(console.error);

