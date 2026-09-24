const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

async function inspectProfesor() {
  console.log("=== INSPECTING PROFESOR ID & CURSO PROFESOR ID ===");

  const { data: curso } = await supabase.from('cursos').select('id, asignatura, profesor_id').eq('id', '3409c0a6-d716-490b-a6ca-3b437be3494e').single();
  console.log("Curso Filosofia profesor_id:", curso?.profesor_id);

  const { data: profs } = await supabase.from('profesores').select('*');
  console.log(`Profesores table count: ${profs?.length}`);
  profs?.forEach(p => console.log(`- ID: ${p.id} | Email: ${p.email} | Nombre: ${p.nombre}`));

  // Check auth users if possible or check bitacora_clase profesor_id
  const { data: bit } = await supabase.from('bitacora_clase').select('id, profesor_id').eq('id', 'd84a6640-e138-4b33-8a93-a08ea8c8a79c').single();
  console.log("Bitacora profesor_id:", bit?.profesor_id);
}

inspectProfesor().catch(console.error);

