const { createClient } = require('@supabase/supabase-js');

const url = 'https://hxsnyrutyyavvljxwgku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';

const supabase = createClient(url, serviceKey);

const zeroList = [
  "anthony ortegga", "inmNOL", "FATIMA IBARRA", "YELENA CORNEJO", "MELANY MEJIA",
  "ARIELKA NAREA", "ASLEY VERA", "jonathan vera", "brithany mero", "yulia zambrnao",
  "geovana lascano", "sherlye cheme", "cristhoper leon", "bryen macias", "melanie barberan",
  "paola roman", "nicollw lucas", "steffany artos", "jasson velez"
];

const excellentList = [
  "karime", "maria pia carreño", "daniela zambrano", "españo romero", "sebastian rodriguez",
  "daniela alexandra", "alexandra delgado", "emily cadena", "bravo santana", "isamae esavi",
  "nathaly mera", "valeska perez", "alisson vera", "valentina lucas", "alvarez romina",
  "danna vaca", "gislayne posligua", "daniela maritza", "nohely rodriguez", "malany zambrano",
  "camelia romero"
];

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function normalize(str) {
  return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
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
      if (np === qp) {
        bestWordScore = 10;
        break;
      }
      if (np.startsWith(qp) || qp.startsWith(np)) {
        bestWordScore = Math.max(bestWordScore, 8);
      }
      if (np.includes(qp) || qp.includes(np)) {
        bestWordScore = Math.max(bestWordScore, 7);
      }
      const dist = levenshtein(qp, np);
      if (dist <= 2) {
        bestWordScore = Math.max(bestWordScore, 6 - dist);
      }
    }
    totalScore += bestWordScore;
  }
  return totalScore;
}

async function main() {
  const filId = '3409c0a6-d716-490b-a6ca-3b437be3494e';
  const { data: students, error } = await supabase.from('estudiantes').select('*').eq('curso_id', filId);

  if (error || !students) {
    console.error("Error fetching students:", error);
    return;
  }

  console.log("=== ADVANCED FUZZY MATCHING ===");
  const results = [];

  for (const s of students) {
    let bestZero = { score: 0, query: null };
    let bestExc = { score: 0, query: null };

    for (const z of zeroList) {
      const sc = scoreMatch(s.nombre, z);
      if (sc > bestZero.score) bestZero = { score: sc, query: z };
    }

    for (const e of excellentList) {
      const sc = scoreMatch(s.nombre, e);
      if (sc > bestExc.score) bestExc = { score: sc, query: e };
    }

    let category = "SIN_LISTA";
    let matchedQuery = null;

    if (bestZero.score >= 12 || bestExc.score >= 12) {
      if (bestZero.score > bestExc.score) {
        category = "ZERO (0)";
        matchedQuery = bestZero.query;
      } else {
        category = "EXCELLENT (10)";
        matchedQuery = bestExc.query;
      }
    } else if (bestZero.score >= 7 || bestExc.score >= 7) {
      if (bestZero.score >= bestExc.score) {
        category = "ZERO (0)";
        matchedQuery = bestZero.query;
      } else {
        category = "EXCELLENT (10)";
        matchedQuery = bestExc.query;
      }
    }

    results.push({ student: s, category, matchedQuery, scoreZero: bestZero.score, scoreExc: bestExc.score });
  }

  results.sort((a, b) => a.student.nombre.localeCompare(b.student.nombre));

  let countZero = 0, countExc = 0, countUnassigned = 0;

  results.forEach((r, idx) => {
    if (r.category === "ZERO (0)") countZero++;
    else if (r.category === "EXCELLENT (10)") countExc++;
    else countUnassigned++;

    console.log(`${idx+1}. [${r.category.padEnd(14)}] ${r.student.nombre.padEnd(40)} (Query: "${r.matchedQuery || 'N/A'}")`);
  });

  console.log(`\nTOTALES:`);
  console.log(`- Cumplen Excelente (10): ${countExc}`);
  console.log(`- Incumplen (0): ${countZero}`);
  console.log(`- Sin evaluar / No en lista: ${countUnassigned}`);

  if (countUnassigned > 0) {
    console.log("\nESTUDIANTES EN EL CURSO PERO NO EN NINGUNA LISTA:");
    results.filter(r => r.category === "SIN_LISTA").forEach(r => {
      console.log(`- ${r.student.nombre} (${r.student.email})`);
    });
  }
}

main().catch(console.error);

