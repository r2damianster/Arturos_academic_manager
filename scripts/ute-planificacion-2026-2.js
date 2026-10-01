const https = require('https');

const SUPABASE_URL = 'hxsnyrutyyavvljxwgku.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI';
const PROFESOR_ID = '6d3391b6-68da-4127-a424-aa8a88b2a785';

function apiReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/' + path,
      method: method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=minimal'
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(options, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const CURSOS = [
  { id: '53966fa1-1401-43bb-bb4b-fc0c8e2d2ea2', nombre: 'NEG', dia: 'miercoles', parciales: 2, fecha_fin: '2027-02-03' },
  { id: '254d9765-0466-4d53-8b02-9d9bab624f53', nombre: 'GAS', dia: 'jueves',    parciales: 2, fecha_fin: '2027-02-04' },
  { id: '0f88c94d-f5c0-4262-b8c3-1f8b590e67d9', nombre: 'MED', dia: 'miercoles', parciales: 3, fecha_fin: '2027-02-03' },
  { id: '8d38cfd3-4a7b-4d60-a93f-9491909df306', nombre: 'ODO', dia: 'jueves',    parciales: 3, fecha_fin: '2027-02-04' },
];

const MIERCOLES = [
  {f:'2026-10-07',s:false},{f:'2026-10-14',s:false},{f:'2026-10-21',s:false},{f:'2026-10-28',s:false},
  {f:'2026-11-04',s:false},{f:'2026-11-11',s:false},{f:'2026-11-18',s:false},{f:'2026-11-25',s:false},
  {f:'2026-12-02',s:false},{f:'2026-12-09',s:false},{f:'2026-12-16',s:false},
  {f:'2026-12-23',s:true},{f:'2026-12-30',s:true},
  {f:'2027-01-06',s:false},{f:'2027-01-13',s:false},{f:'2027-01-20',s:false},{f:'2027-01-27',s:false},{f:'2027-02-03',s:false}
];

const JUEVES = [
  {f:'2026-10-08',s:false},{f:'2026-10-15',s:false},{f:'2026-10-22',s:false},{f:'2026-10-29',s:false},
  {f:'2026-11-05',s:false},{f:'2026-11-12',s:false},{f:'2026-11-19',s:false},{f:'2026-11-26',s:false},
  {f:'2026-12-03',s:false},{f:'2026-12-10',s:false},{f:'2026-12-17',s:false},
  {f:'2026-12-24',s:true},{f:'2026-12-31',s:true},
  {f:'2027-01-07',s:false},{f:'2027-01-14',s:false},{f:'2027-01-21',s:false},{f:'2027-01-28',s:false},{f:'2027-02-04',s:false}
];

function getTema(n, parciales, suspendida) {
  if (suspendida) return 'Vacaciones \u2014 Clase Suspendida';
  if (parciales === 2) {
    if (n === 8)  return 'Sesion 8 \u2014 Evaluacion Parcial I';
    if (n === 15) return 'Sesion 15 \u2014 Evaluacion Parcial II';
    if (n === 16) return 'Sesion 16 \u2014 Evaluacion Parcial II';
    return 'Sesion ' + n;
  } else {
    if (n === 5)  return 'Sesion 5 \u2014 Evaluacion Parcial I';
    if (n === 10) return 'Sesion 10 \u2014 Evaluacion Parcial II';
    if (n === 15) return 'Sesion 15 \u2014 Evaluacion Parcial III';
    if (n === 16) return 'Sesion 16 \u2014 Evaluacion Final';
    return 'Sesion ' + n;
  }
}

async function main() {
  for (const curso of CURSOS) {
    console.log('\n=== ' + curso.nombre + ' (' + curso.parciales + ' parciales) ===');
    const upd = await apiReq('PATCH', 'cursos?id=eq.' + curso.id, { fecha_fin: curso.fecha_fin, num_parciales: curso.parciales });
    console.log('  PATCH cursos -> ' + upd.status + (upd.body ? ' ' + upd.body : ''));
    const fechas = curso.dia === 'miercoles' ? MIERCOLES : JUEVES;
    let sesNum = 0;
    for (const f of fechas) {
      if (!f.s) sesNum++;
      const tema = getTema(sesNum, curso.parciales, f.s);
      const estado = f.s ? 'suspendido' : 'planificado';
      const semana = f.s ? 'Vacaciones' : ('Semana ' + sesNum);
      const chk = await apiReq('GET', 'bitacora_clase?curso_id=eq.' + curso.id + '&fecha=eq.' + f.f + '&select=id', null);
      const existing = JSON.parse(chk.body || '[]');
      const payload = { tema: tema, estado: estado, semana: semana, sin_planificacion: false, actividades_json: [] };
      let r;
      if (existing.length > 0) {
        r = await apiReq('PATCH', 'bitacora_clase?id=eq.' + existing[0].id, payload);
        console.log('  UPD ' + f.f + ' [' + (f.s ? 'SUS' : sesNum) + '] ' + tema + ' -> ' + r.status);
      } else {
        payload.profesor_id = PROFESOR_ID;
        payload.curso_id = curso.id;
        payload.fecha = f.f;
        r = await apiReq('POST', 'bitacora_clase', payload);
        console.log('  INS ' + f.f + ' [' + (f.s ? 'SUS' : sesNum) + '] ' + tema + ' -> ' + r.status);
      }
    }
  }
  console.log('\n LISTO - Planificacion UTE 2026-2 cargada en produccion.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
