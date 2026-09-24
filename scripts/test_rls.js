const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyODE4NzcsImV4cCI6MjA2ODg1Nzg3N30.y_l4gyz_zPu9nCBdgTvfIqDGKE78Zlaz5xBvn-lqA-0';

async function testRLS() {
  console.log("=== TESTING RLS ON PARTICIPACION & ASISTENCIA & CALIFICACIONES_ITEMS ===");

  const serviceClient = createClient(url, serviceKey);
  const anonClient = createClient(url, anonKey);

  const cursoId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const fecha = '2026-09-17';

  // 1. Service Role Client
  const { data: pService } = await serviceClient.from('participacion').select('*').eq('curso_id', cursoId).eq('fecha', fecha);
  console.log(`Service Role 'participacion' rows: ${pService?.length}`);

  // 2. Anon Client (simulating unauthenticated or standard RLS)
  const { data: pAnon, error: pAnonErr } = await anonClient.from('participacion').select('*').eq('curso_id', cursoId).eq('fecha', fecha);
  console.log(`Anon Client 'participacion' rows: ${pAnon?.length} | Error:`, pAnonErr?.message || 'none');

  const { data: aAnon, error: aAnonErr } = await anonClient.from('asistencia').select('*').eq('curso_id', cursoId).eq('fecha', fecha);
  console.log(`Anon Client 'asistencia' rows: ${aAnon?.length} | Error:`, aAnonErr?.message || 'none');

  const { data: ciAnon, error: ciAnonErr } = await anonClient.from('calificaciones_items').select('*').eq('curso_id', cursoId).eq('fuente', 'en_curso');
  console.log(`Anon Client 'calificaciones_items' rows: ${ciAnon?.length} | Error:`, ciAnonErr?.message || 'none');
}

testRLS().catch(console.error);

