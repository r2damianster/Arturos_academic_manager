const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Proyecto TutorArt - Producción (hxsnyrutyyavvljxwgku)
const PROD_URL = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const PROD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(PROD_URL, PROD_SERVICE_KEY);

async function main() {
  console.log('Conectando a TutorArt (hxsnyrutyyavvljxwgku)...');

  // 1. Buscar cursos con "pensamiento" en el nombre
  const { data: cursos, error: errCursos } = await supabase
    .from('cursos')
    .select('*')
    .ilike('asignatura', '%pensamiento%');

  if (errCursos) {
    console.error('ERROR cursos:', JSON.stringify(errCursos, null, 2));
    return;
  }

  console.log('\n=== TODOS LOS CURSOS CON "pensamiento" ===');
  console.log(JSON.stringify(cursos, null, 2));

  const curso2026_1 = cursos && cursos.filter(c => c.periodo === '2026-1');
  console.log('\n=== CURSOS 2026-1 DESARROLLO DEL PENSAMIENTO ===');
  console.log(JSON.stringify(curso2026_1, null, 2));

  if (!curso2026_1 || curso2026_1.length === 0) {
    console.log('\n⚠️ No se encontraron cursos en 2026-1. Verificando todos los periodos...');
    return;
  }

  const cursoId = curso2026_1[0].id;
  console.log('\nCurso ID:', cursoId);
  console.log('Carrera:', curso2026_1[0].carrera);

  // 2. Estudiantes
  const { data: estudiantes, error: errEst } = await supabase
    .from('estudiantes')
    .select('id, nombre, email, estado, retirado_at')
    .eq('curso_id', cursoId)
    .order('nombre');

  console.log('\n=== ESTUDIANTES (' + (estudiantes ? estudiantes.length : 0) + ') ===');
  if (errEst) console.error('ERROR estudiantes:', errEst);

  // 3. Participaciones
  const { data: participaciones, error: errPart } = await supabase
    .from('participacion')
    .select('id, estudiante_id, fecha, nivel, observacion, created_at')
    .eq('curso_id', cursoId)
    .order('fecha');

  console.log('\n=== PARTICIPACIONES (' + (participaciones ? participaciones.length : 0) + ') ===');
  if (errPart) console.error('ERROR participacion:', errPart);
  else console.log(JSON.stringify(participaciones, null, 2));

  // 4. Calificaciones items
  const { data: calItems, error: errCal } = await supabase
    .from('calificaciones_items')
    .select('id, estudiante_id, parcial, nombre_item, tipo, nota, fuente, created_at')
    .eq('curso_id', cursoId)
    .order('nombre_item');

  console.log('\n=== CALIFICACIONES ITEMS (' + (calItems ? calItems.length : 0) + ') ===');
  if (errCal) console.error('ERROR calificaciones_items:', errCal);
  else console.log(JSON.stringify(calItems ? calItems.slice(0, 5) : [], null, 2), '...');

  // 5. Asistencia
  const { data: asistencia, error: errAs } = await supabase
    .from('asistencia')
    .select('id, estudiante_id, fecha, estado, created_at')
    .eq('curso_id', cursoId)
    .order('fecha');

  console.log('\n=== ASISTENCIA (' + (asistencia ? asistencia.length : 0) + ' registros) ===');
  if (errAs) console.error('ERROR asistencia:', errAs);

  // 6. Bitacora clase
  const { data: bitacora, error: errBit } = await supabase
    .from('bitacora_clase')
    .select('*')
    .eq('curso_id', cursoId)
    .order('fecha');

  console.log('\n=== BITACORA CLASE (' + (bitacora ? bitacora.length : 0) + ') ===');
  if (errBit) console.error('ERROR bitacora_clase:', errBit);
  else console.log(JSON.stringify(bitacora, null, 2));

  // Guardar datos completos
  const allData = {
    curso: curso2026_1[0],
    estudiantes,
    participaciones,
    calificaciones_items: calItems,
    asistencia,
    bitacora_clase: bitacora
  };

  const outPath = 'C:/Users/User/.gemini/antigravity/brain/754d0f33-5673-4261-8492-9de4c144b566/scratch/data_pensamiento_2026_1.json';
  fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2));
  console.log('\n✅ Datos guardados en:', outPath);
}

main().catch(console.error);
