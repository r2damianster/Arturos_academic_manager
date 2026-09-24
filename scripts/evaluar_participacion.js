const { createClient } = require('@supabase/supabase-js');
const { url, serviceKey, anonKey } = require('./_supabase-env');


const supabase = createClient(url, serviceKey);

const PROFESOR_ID = '6d3391b6-68da-4127-a424-aa8a88b2a785';
const CURSO_ID = '3409c0a6-d716-490b-a6ca-3b437be3494e'; // FILOSOFÍA
const FECHA_EVALUACION = '2026-09-17';
const BITACORA_ID = 'd84a6640-e138-4b33-8a93-a08ea8c8a79c';
const ACTIVIDAD_NOMBRE = 'Control de lectura: Videos de Paulo Freire';

const zeroListRaw = [
  "anthony ortegga", "inmNOL", "FATIMA IBARRA", "YELENA CORNEJO", "MELANY MEJIA",
  "ARIELKA NAREA", "ASLEY VERA", "jonathan vera", "brithany mero", "yulia zambrnao",
  "geovana lascano", "sherlye cheme", "cristhoper leon", "bryen macias", "melanie barberan",
  "paola roman", "nicollw lucas", "steffany artos", "jasson velez"
];

const excellentListRaw = [
  "karime", "maria pia carreño", "daniela zambrano", "españo romero", "sebastian rodriguez",
  "daniela alexandra", "alexandra delgado", "emily cadena", "bravo santana", "isamae esavi",
  "nathaly mera", "valeska perez", "alisson vera", "valentina lucas", "alvarez romina",
  "danna vaca", "gislayne posligua", "daniela maritza", "nohely rodriguez", "malany zambrano",
  "camelia romero"
];

function normalize(str) {
  return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
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

async function runEvaluation() {
  console.log(`=== RUNNING EVALUATION FOR ${FECHA_EVALUACION} (Active Students Only) ===`);
  
  const { data: students, error: sErr } = await supabase
    .from('estudiantes')
    .select('*')
    .eq('curso_id', CURSO_ID);

  if (sErr || !students) {
    console.error("Error loading students:", sErr);
    return;
  }

  // Filter ONLY active students
  const activeStudents = students.filter(s => s.estado === 'activo' || !s.estado);
  console.log(`Active students count: ${activeStudents.length}`);

  const evaluations = [];

  for (const s of activeStudents) {
    let bestZero = { score: 0, query: null };
    let bestExc = { score: 0, query: null };

    for (const z of zeroListRaw) {
      const sc = scoreMatch(s.nombre, z);
      if (sc > bestZero.score) bestZero = { score: sc, query: z };
    }
    for (const e of excellentListRaw) {
      const sc = scoreMatch(s.nombre, e);
      if (sc > bestExc.score) bestExc = { score: sc, query: e };
    }

    let cumple = null;
    let matchedQuery = null;

    const norm = normalize(s.nombre);
    if (norm.includes("emily domenica cadena")) {
      cumple = true; matchedQuery = "emily cadena";
    } else if (norm.includes("emily dayana loor")) {
      cumple = false; matchedQuery = "Omitido (Opción A)";
    } else if (norm.includes("dayana michelle murillo")) {
      cumple = false; matchedQuery = "Omitido (Opción A)";
    } else if (norm.includes("imannol paolo")) {
      cumple = false; matchedQuery = "inmNOL";
    }

    if (cumple === null) {
      if (bestZero.score >= 12 || bestExc.score >= 12) {
        cumple = bestExc.score > bestZero.score;
        matchedQuery = cumple ? bestExc.query : bestZero.query;
      } else if (bestZero.score >= 7 || bestExc.score >= 7) {
        cumple = bestExc.score > bestZero.score;
        matchedQuery = cumple ? bestExc.query : bestZero.query;
      }
    }

    // Default to false (Option A) if unassigned
    if (cumple === null) {
      cumple = false;
      matchedQuery = "Omitido (Opción A)";
    }

    evaluations.push({
      student_id: s.id,
      nombre: s.nombre,
      email: s.email,
      cumple,
      nota: cumple ? 10 : 0,
      nivelParticipacion: cumple ? 5 : 1,
      estadoAsistencia: cumple ? 'Presente' : 'Ausente',
      matchedQuery
    });
  }

  console.log(`\nCLASSIFICATION SUMMARY (${evaluations.length} active students):`);
  console.log(`- Cumplen Excelente (Nota 10 / Nivel 5): ${evaluations.filter(e => e.cumple).length}`);
  console.log(`- Incumplen / Omitidos A (Nota 0 / Nivel 1): ${evaluations.filter(e => !e.cumple).length}`);

  // 1. UPSERT INTO `participacion` TABLE
  console.log(`\n1. Upserting into table 'participacion'...`);
  const participacionRecords = evaluations.map(e => ({
    profesor_id: PROFESOR_ID,
    curso_id: CURSO_ID,
    estudiante_id: e.student_id,
    fecha: FECHA_EVALUACION,
    semana: 'Semana 3',
    nivel: e.nivelParticipacion,
    observacion: `${ACTIVIDAD_NOMBRE} - ${e.cumple ? 'Cumple Excelente' : 'Incumple'}`
  }));

  const { error: pErr } = await supabase
    .from('participacion')
    .upsert(participacionRecords, { onConflict: 'curso_id,estudiante_id,fecha' });

  if (pErr) console.error("Error upserting participacion:", pErr);
  else console.log("✅ Participación (nivel 1 a 5 con observaciones) registrada exitosamente en Supabase!");

  // 2. UPSERT INTO `asistencia` TABLE
  console.log(`\n2. Upserting into table 'asistencia'...`);
  const asistenciaRecords = evaluations.map(e => ({
    profesor_id: PROFESOR_ID,
    curso_id: CURSO_ID,
    estudiante_id: e.student_id,
    fecha: FECHA_EVALUACION,
    semana: 'Semana 3',
    estado: e.estadoAsistencia,
    horas: 2,
    observacion_part: `${ACTIVIDAD_NOMBRE} - ${e.cumple ? 'Cumple Excelente' : 'Incumple'}`,
    bitacora_id: BITACORA_ID
  }));

  const { error: aErr } = await supabase
    .from('asistencia')
    .upsert(asistenciaRecords, { onConflict: 'curso_id,estudiante_id,fecha' });

  if (aErr) console.error("Error upserting asistencia:", aErr);
  else console.log("✅ Asistencia vinculada a la Bitácora registrada exitosamente!");

  // 3. UPSERT INTO `calificaciones_items` (Notas en curso)
  console.log(`\n3. Upserting into table 'calificaciones_items' (Notas en curso)...`);
  const calificacionesItemsRecords = evaluations.map(e => ({
    profesor_id: PROFESOR_ID,
    curso_id: CURSO_ID,
    estudiante_id: e.student_id,
    parcial: 1,
    nombre_item: ACTIVIDAD_NOMBRE,
    tipo: 'tarea',
    nota: e.nota,
    fuente: 'en_curso'
  }));

  // Clean old item entries for this activity if needed, then insert
  await supabase
    .from('calificaciones_items')
    .delete()
    .eq('curso_id', CURSO_ID)
    .eq('nombre_item', ACTIVIDAD_NOMBRE)
    .eq('fuente', 'en_curso');

  const { error: ciErr } = await supabase
    .from('calificaciones_items')
    .insert(calificacionesItemsRecords);

  if (ciErr) console.error("Error inserting calificaciones_items:", ciErr);
  else console.log("✅ Calificaciones_items (Notas en curso: 10/0) registradas exitosamente!");
}

runEvaluation().catch(console.error);
