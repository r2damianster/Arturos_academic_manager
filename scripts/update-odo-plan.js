const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxsnyrutyyavvljxwgku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI'
);
const ODO = '8d38cfd3-4a7b-4d60-a93f-9491909df306';

const cambios = [
  // ── SES. 1 y 2 — agrega PEEL como AA ─────────────────────────────────────
  {
    fecha: '2026-10-08',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Presentación de sílabo.', recurso: '' },
      { actividad: 'ACD: Lluvia de ideas sobre la investigación en salud y sus aportes.', recurso: '' },
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Control de lectura.', recurso: '' },
      { actividad: 'AA: Constructor PEEL — Redacción de párrafos argumentativos.', recurso: 'https://elprofesimulations.vercel.app/peel.html' }
    ],
    materiales: '[Diapositiva — pendiente de carga]',
    observaciones: 'EACD: Participación activa en clase proponiendo ejemplos sobre la relevancia de la investigación en salud. — EACD: Evaluación en clase sobre las diferencias entre el método científico y empírico.'
  },

  // ── SES. 6 — agrega APA 7 (x2) como ACD ─────────────────────────────────
  {
    fecha: '2026-11-12',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Taller y trabajo colaborativo en clase.', recurso: '' },
      { actividad: 'ACD: Simulación Formato APA 7 — corrección de manuscrito.', recurso: 'https://elprofesimulations.vercel.app/apa7.html' },
      { actividad: 'ACD: Editor APA 7 — cinta de herramientas, formateo de manuscrito.', recurso: 'https://elprofesimulations.vercel.app/apa7_2.html' }
    ],
    materiales: 'https://docs.google.com/presentation/d/1EdnPWSGCRYVaLJbLjr7AQ7lnkZoGSQtWnW960eL9RuE/edit?usp=sharing\nhttps://docs.google.com/presentation/d/1xosUsIbPC-TqX9bgbpjfKrQa221w3rjK6KTIcHmsw8g/edit?usp=sharing',
    observaciones: 'EACD: Exposición grupal del tema delimitado, planteamiento y contextualización del problema.'
  },

  // ── SES. 8 — agrega simulador diseños como ACD ───────────────────────────
  {
    fecha: '2026-11-26',
    actividades_json: [
      { actividad: 'AA (Flipped Learning — Preclase): Revisión autónoma del video: COVID-19 más allá de una visión nosológica y clínica.', recurso: '' },
      { actividad: 'ACD: Síntesis oral individual en clase.', recurso: '' },
      { actividad: 'ACD: Trabajo en grupos pequeños para extracción de conclusiones.', recurso: '' },
      { actividad: 'ACD: Simulador de diseños experimentales, no experimentales y cuasiexperimentales.', recurso: 'https://elprofesimulations.vercel.app/disenos.html' }
    ],
    materiales: 'https://docs.google.com/presentation/d/1q8vQ5OZLZ9jTqfVntWnR_3PY1MMg4XMOmoqiy2-PySE/edit?usp=sharing\nhttps://docs.google.com/presentation/d/1GYVKXpWhJGnyMc-j1Kq0WrNu28Vwxz4q22KE7V0zYAk/edit?usp=sharing',
    observaciones: 'EAA: Participación aportando fundamentos de la teoría de campos de la salud. — EACD: Evaluación grupal en clase sobre teorías de la salud.'
  },

  // ── SES. 11 — agrega r2-graphs + Experimentación blanda ──────────────────
  {
    fecha: '2026-12-17',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Trabajo grupal en aula.', recurso: 'https://elprofesimulations.vercel.app/observaci%C3%B3n.html' },
      { actividad: 'ACD: Construcción y análisis de gráficos estadísticos.', recurso: 'https://r2-graphs.vercel.app/' }
    ],
    materiales: '[Diapositiva — pendiente de carga]',
    observaciones: 'EACD: Exposición grupal del instrumento diseñado para el levantamiento de información. Criterio: Diseña y valida un instrumento de recolección de datos para su tema de estudio. — AA: Experimentación blanda — Seguimiento semanal de la actividad autónoma.'
  },

  // ── SES. 12 — agrega r2-graphs + r2-argumentum + Experimentación blanda ──
  {
    fecha: '2027-01-07',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Trabajo grupal en aula.', recurso: '' },
      { actividad: 'ACD: Visualización de resultados con gráficos estadísticos.', recurso: 'https://r2-graphs.vercel.app/' },
      { actividad: 'ACD: Debate y defensa de hallazgos.', recurso: 'https://r2-argumentum.vercel.app/' }
    ],
    materiales: '[Diapositiva — pendiente de carga]',
    observaciones: 'EACD: Presentación oral grupal de los resultados, contrastación y conclusiones del estudio. Criterio: Comunica y analiza los principales hallazgos de la investigación. — AA: Experimentación blanda — Seguimiento semanal de la actividad autónoma.'
  },

  // ── SES. 13 — agrega OJS + Experimentación blanda ────────────────────────
  {
    fecha: '2027-01-14',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Taller de redacción grupal.', recurso: '' },
      { actividad: 'ACD: Simulación de envío de artículo científico a revista (sistema OJS).', recurso: 'https://elprofesimulations.vercel.app/revista.html' }
    ],
    materiales: '[Diapositiva — pendiente de carga]',
    observaciones: 'EACD: Exposición de avances preliminares y entrega formal del primer borrador en formato paper. Criterio: Reconoce las diferentes vías y formatos de divulgación científica. — AA: Experimentación blanda — Seguimiento semanal de la actividad autónoma.'
  },

  // ── SES. 14 — agrega OJS + r2-argumentum + Experimentación blanda ─────────
  {
    fecha: '2027-01-21',
    actividades_json: [
      { actividad: 'ACD: Clase magistral.', recurso: '' },
      { actividad: 'ACD: Sustentación grupal.', recurso: '' },
      { actividad: 'ACD: Simulación de envío del artículo científico terminado (sistema OJS).', recurso: 'https://elprofesimulations.vercel.app/revista.html' },
      { actividad: 'ACD: Práctica de defensa oral.', recurso: 'https://r2-argumentum.vercel.app/' }
    ],
    materiales: '[Diapositiva — pendiente de carga]',
    observaciones: 'EACD: Sustentación grupal de los resultados finales y entrega del artículo científico terminado (paper). Criterio: Revisión integral de la propuesta y defensa oral de la investigación. — AA: Experimentación blanda — Seguimiento semanal de la actividad autónoma.'
  }
];

async function run() {
  let ok = 0, err = 0;
  for (const s of cambios) {
    const { error } = await sb.from('bitacora_clase')
      .update({
        actividades_json: s.actividades_json,
        materiales: s.materiales,
        observaciones: s.observaciones
      })
      .eq('curso_id', ODO)
      .eq('fecha', s.fecha);
    if (error) {
      console.log('ERROR ' + s.fecha + ': ' + JSON.stringify(error));
      err++;
    } else {
      console.log('OK ' + s.fecha);
      ok++;
    }
  }
  console.log('\n✅ ' + ok + ' OK  ❌ ' + err + ' errores');
}
run().catch(console.error);
