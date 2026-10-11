/**
 * Registra participación y notas en curso (control de lectura) a partir de dos listas informales.
 * NO toca la tabla `asistencia` (ver docs/GUIA_ANTIGRAVITY_ERRORES_A_EVITAR.md § 4).
 *
 * Uso:
 *   node scripts/evaluar_participacion.js <config.json>           # simulación (no escribe)
 *   node scripts/evaluar_participacion.js <config.json> --apply   # escribe en la base de .env.local
 *
 * config.json (guardarlo en scratch/, que está en .gitignore; nunca commitear nombres de estudiantes):
 *   {
 *     "cursoId": "<uuid del curso>",
 *     "fecha": "YYYY-MM-DD",
 *     "actividad": "Control de lectura: ...",
 *     "parcial": 1,
 *     "semana": "Semana 3",                 // opcional
 *     "cumplen":   ["nombre informal", ...],
 *     "incumplen": ["nombre informal", ...]
 *   }
 *
 * Los estudiantes activos que no aparecen en ninguna lista o cuyo nombre es ambiguo se informan
 * y NO se escriben: decide el profesor.
 * Lee `.env.local` (hoy producción): el script imprime la URL de la base; revisar la simulación antes de --apply.
 */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { url, serviceKey } = require('./_supabase-env');

const MIN_SCORE = 7;
const AMBIGUITY_MARGIN = 2;

function normalize(text) {
  return text ? text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() : '';
}

function levenshtein(first, second) {
  const matrix = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0));
  for (let row = 0; row <= first.length; row++) matrix[row][0] = row;
  for (let column = 0; column <= second.length; column++) matrix[0][column] = column;
  for (let row = 1; row <= first.length; row++) {
    for (let column = 1; column <= second.length; column++) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }
  return matrix[first.length][second.length];
}

function scoreMatch(studentName, query) {
  const nameParts = normalize(studentName).split(/\s+/).filter(Boolean);
  const queryParts = normalize(query).split(/\s+/).filter(Boolean);

  let totalScore = 0;
  for (const queryPart of queryParts) {
    let bestWordScore = 0;
    for (const namePart of nameParts) {
      if (namePart === queryPart) { bestWordScore = 10; break; }
      if (namePart.startsWith(queryPart) || queryPart.startsWith(namePart)) bestWordScore = Math.max(bestWordScore, 8);
      if (namePart.includes(queryPart) || queryPart.includes(namePart)) bestWordScore = Math.max(bestWordScore, 7);
      const distance = levenshtein(queryPart, namePart);
      if (distance <= 2) bestWordScore = Math.max(bestWordScore, 6 - distance);
    }
    totalScore += bestWordScore;
  }
  return totalScore;
}

/** Devuelve { student } si hay un único mejor candidato claro; si no, { reason }. */
function resolveStudent(query, students) {
  const ranked = students
    .map(student => ({ student, score: scoreMatch(student.nombre, query) }))
    .filter(candidate => candidate.score > 0)
    .sort((first, second) => second.score - first.score);

  if (ranked.length === 0 || ranked[0].score < MIN_SCORE) return { reason: 'sin coincidencia' };
  if (ranked[1] && ranked[0].score - ranked[1].score < AMBIGUITY_MARGIN) {
    return { reason: `ambiguo: ${ranked[0].student.nombre} / ${ranked[1].student.nombre}` };
  }
  return { student: ranked[0].student };
}

async function main() {
  const configPath = process.argv[2];
  const shouldApply = process.argv.includes('--apply');
  if (!configPath || configPath.startsWith('--')) {
    console.error('Uso: node scripts/evaluar_participacion.js <config.json> [--apply]');
    process.exitCode = 1;
    return;
  }

  // Quita el BOM que añaden algunos editores de Windows.
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^﻿/, ''));
  const { cursoId, fecha, actividad, parcial = 1, semana = null, cumplen = [], incumplen = [] } = config;
  if (!cursoId || !fecha || !actividad) {
    console.error('config.json requiere cursoId, fecha y actividad');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, serviceKey);
  console.log(`Base: ${url}${shouldApply ? '  (--apply: ESCRIBE)' : '  (simulación)'}`);

  const { data: course, error: courseError } = await supabase
    .from('cursos').select('id, profesor_id, asignatura, estado').eq('id', cursoId).single();
  if (courseError || !course) {
    console.error('Curso no encontrado en esta base:', courseError?.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Curso: ${course.asignatura} (${course.estado})`);

  const { data: students, error: studentsError } = await supabase
    .from('estudiantes').select('id, nombre, estado').eq('curso_id', cursoId);
  if (studentsError || !students) {
    console.error('Error cargando estudiantes:', studentsError?.message);
    process.exitCode = 1;
    return;
  }
  const activeStudents = students.filter(student => student.estado !== 'retirado');

  const evaluations = new Map(); // student.id -> { student, cumple, query }
  const problems = [];

  const register = (queries, cumple) => {
    for (const query of queries) {
      const resolution = resolveStudent(query, activeStudents);
      if (!resolution.student) {
        problems.push(`"${query}" → ${resolution.reason}`);
        continue;
      }
      const previous = evaluations.get(resolution.student.id);
      if (previous && previous.cumple !== cumple) {
        problems.push(`"${query}" y "${previous.query}" apuntan a ${resolution.student.nombre} con resultado distinto`);
        continue;
      }
      evaluations.set(resolution.student.id, { student: resolution.student, cumple, query });
    }
  };
  register(cumplen, true);
  register(incumplen, false);

  const withoutList = activeStudents.filter(student => !evaluations.has(student.id));

  console.log(`\nCumplen: ${[...evaluations.values()].filter(item => item.cumple).length}` +
    ` | Incumplen: ${[...evaluations.values()].filter(item => !item.cumple).length}` +
    ` | Sin lista: ${withoutList.length} | Problemas: ${problems.length}`);
  for (const item of evaluations.values()) {
    console.log(`  ${item.cumple ? '✔' : '✘'} ${item.student.nombre}  ← "${item.query}"`);
  }
  if (problems.length) console.log('\nRevisar (no se escriben):\n  ' + problems.join('\n  '));
  if (withoutList.length) {
    console.log('\nActivos sin lista (no se escriben; decide el profesor):\n  ' +
      withoutList.map(student => student.nombre).join('\n  '));
  }

  if (!shouldApply) {
    console.log('\nSimulación terminada. Repetir con --apply para escribir.');
    return;
  }

  const rows = [...evaluations.values()];
  const participationRows = rows.map(item => ({
    profesor_id: course.profesor_id,
    curso_id: cursoId,
    estudiante_id: item.student.id,
    fecha,
    semana,
    nivel: item.cumple ? 5 : 1,
    observacion: `${actividad} - ${item.cumple ? 'Cumple Excelente' : 'Incumple'}`,
  }));
  const { error: participationError } = await supabase
    .from('participacion')
    .upsert(participationRows, { onConflict: 'curso_id,estudiante_id,fecha' });
  console.log(participationError ? `Error participacion: ${participationError.message}` : `participacion: ${participationRows.length} filas`);

  const itemRows = rows.map(item => ({
    profesor_id: course.profesor_id,
    curso_id: cursoId,
    estudiante_id: item.student.id,
    parcial,
    nombre_item: actividad,
    tipo: 'tarea',
    nota: item.cumple ? 10 : 0,
    fuente: 'en_curso',
  }));
  const { error: itemsError } = await supabase
    .from('calificaciones_items')
    .upsert(itemRows, { onConflict: 'curso_id,estudiante_id,parcial,nombre_item' });
  console.log(itemsError ? `Error calificaciones_items: ${itemsError.message}` : `calificaciones_items: ${itemRows.length} filas`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
