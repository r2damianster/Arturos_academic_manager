const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';
const supabase = createClient(url, serviceKey);

const PROFESOR_ID = '6d3391b6-68da-4127-a424-aa8a88b2a785';
const CURSO_ID = '3409c0a6-d716-490b-a6ca-3b437be3494e'; // FILOSOFÍA
const FECHA = '2026-09-21';
const ACTIVIDAD_NOMBRE = 'R2 Argumentum: ¿Qué hace único al ser humano?';

const json = JSON.parse(fs.readFileSync('r2-argumentum-que-nos-hace-humanos-2026-1790027467551.json', 'utf8'));
const rawNames = Array.from(new Set(json.eventLogCompleto.filter(e => e.name === 'ingreso.confirmado').map(e => e.data.nombre.trim())));

function normalize(str) {
  return str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function scoreMatch(studentName, query) {
  const normName = normalize(studentName);
  const normQ = normalize(query);
  const qParts = normQ.split(/\s+/).filter(Boolean);
  const nParts = normName.split(/\s+/).filter(Boolean);

  let totalScore = 0;
  for (const qp of qParts) {
    let bestWordScore = 0;
    for (const np of nParts) {
      if (np === qp) { bestWordScore = 10; break; }
      if (np.startsWith(qp) || qp.startsWith(np)) bestWordScore = Math.max(bestWordScore, 8);
      if (np.includes(qp) || qp.includes(np)) bestWordScore = Math.max(bestWordScore, 7);
      const dist = levenshtein(qp, np);
      if (dist <= 2) bestWordScore = Math.max(bestWordScore, 6 - dist);
    }
    totalScore += bestWordScore;
  }
  return totalScore;
}

async function run() {
  console.log(`=== REGISTRANDO PARTICIPACIÓN Y CALIFICACIONES DEL ${FECHA} ===`);

  const { data: students, error: sErr } = await supabase
    .from('estudiantes')
    .select('id, nombre, estado, retirado_at')
    .eq('curso_id', CURSO_ID);

  if (sErr || !students) {
    console.error('Error al cargar estudiantes:', sErr);
    return;
  }

  const activeStudents = students.filter(s => s.estado !== 'retirado' && !s.retirado_at);
  console.log(`Estudiantes activos en la asignatura: ${activeStudents.length}`);

  const matchedList = [];

  for (const rawName of rawNames) {
    let bestMatch = null;
    let maxScore = -1;

    const normRaw = normalize(rawName);
    if (normRaw === 'pia') {
      bestMatch = activeStudents.find(s => normalize(s.nombre).includes('carreno') || normalize(s.nombre).includes('maria pia'));
      maxScore = 100;
    } else if (normRaw === 'yulia') {
      bestMatch = activeStudents.find(s => normalize(s.nombre).includes('zambrano puruncaja') || normalize(s.nombre).includes('yulia'));
      maxScore = 100;
    } else if (normRaw === 'alejandra rodriguez') {
      bestMatch = activeStudents.find(s => normalize(s.nombre).includes('rodriguez goya') || normalize(s.nombre).includes('nohely'));
      maxScore = 100;
    } else if (normRaw === 'emily l') {
      bestMatch = activeStudents.find(s => normalize(s.nombre).includes('cadena') || normalize(s.nombre).includes('emily domenica'));
      maxScore = 100;
    } else {
      for (const s of activeStudents) {
        const sc = scoreMatch(s.nombre, rawName);
        if (sc > maxScore) {
          maxScore = sc;
          bestMatch = s;
        }
      }
    }

    if (bestMatch) {
      matchedList.push({
        rawName,
        student: bestMatch
      });
    } else {
      console.warn(`⚠️ No se encontró coincidencia para: ${rawName}`);
    }
  }

  console.log(`Total participantes emparejados exitosamente: ${matchedList.length}`);

  // 1. Inserción en 'participacion'
  const participaciones = matchedList.map(m => ({
    profesor_id: PROFESOR_ID,
    curso_id: CURSO_ID,
    estudiante_id: m.student.id,
    fecha: FECHA,
    semana: 'Semana 4',
    nivel: 5,
    observacion: `${ACTIVIDAD_NOMBRE} - Cumple Excelente`
  }));

  console.log(`\nInserting ${participaciones.length} records into 'participacion'...`);
  const { data: pData, error: pErr } = await supabase
    .from('participacion')
    .upsert(participaciones, { onConflict: 'curso_id,estudiante_id,fecha' })
    .select();

  if (pErr) {
    console.error('Error inserting participacion:', pErr);
  } else {
    console.log(`✅ ${pData.length} registros insertados/actualizados en 'participacion'.`);
  }

  // 2. Inserción en 'calificaciones_items'
  const calificaciones = matchedList.map(m => ({
    profesor_id: PROFESOR_ID,
    curso_id: CURSO_ID,
    estudiante_id: m.student.id,
    parcial: 1,
    nombre_item: ACTIVIDAD_NOMBRE,
    tipo: 'tarea',
    nota: 10,
    fuente: 'en_curso'
  }));

  console.log(`\nInserting ${calificaciones.length} records into 'calificaciones_items'...`);
  // Clean old item entries if any
  await supabase
    .from('calificaciones_items')
    .delete()
    .eq('curso_id', CURSO_ID)
    .eq('nombre_item', ACTIVIDAD_NOMBRE)
    .eq('fuente', 'en_curso');

  const { data: cData, error: cErr } = await supabase
    .from('calificaciones_items')
    .insert(calificaciones)
    .select();

  if (cErr) {
    console.error('Error inserting calificaciones_items:', cErr);
  } else {
    console.log(`✅ ${cData.length} registros insertados en 'calificaciones_items'.`);
  }

  console.log('\n=== PROCESO COMPLETADO EXITOSAMENTE ===');
}

run().catch(console.error);

