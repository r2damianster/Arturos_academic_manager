const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hxsnyrutyyavvljxwgku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4c255cnV0eXlhdnZsanh3Z2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MTg3NywiZXhwIjoyMDY4ODU3ODc3fQ.XbawTHFGzEOlz_XIgkt2sRNBJrTG_2BGpgtn0sEyfbI'
);
const NEG = '53966fa1-1401-43bb-bb4b-fc0c8e2d2ea2';
const SLIDE = '[Diapositiva — pendiente de carga]';

const sesiones = [
  {
    fecha: '2026-10-07',
    // N°1 + N°2 del sílabo combinados
    actividades_json: [
      {
        actividad: 'ACD: Actividad de presentación. Metodología magistral formativa y gamificación. Lectura previa bibliografía básica.',
        recurso: 'Bloch, M. (2001). Apología para la Historia o el Oficio de Historiador, Cap. I — Moodle'
      },
      {
        actividad: 'ACD: Clase magistral y discusión.',
        recurso: 'Ayala Mora, E. (2012). Resumen de Historia del Ecuador, pp. 15-28'
      },
      {
        actividad: 'ACD: Clase magistral y discusión.',
        recurso: 'Sevilla Larrea, C. (2003). Vida y muerte en Quito: raíces del sujeto moderno en la colonia temprana, pp. 35-74'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión del sílabo y de las lecturas de la sesión siguiente. — EACD: Evaluación diagnóstica.'
  },
  {
    fecha: '2026-10-21',
    // N°3
    actividades_json: [
      {
        actividad: 'ACD: Clase sobre la temática apoyada en:',
        recurso: 'Braudel, F. (2001). El Mediterráneo y el mundo mediterráneo en la época de Felipe II, pp. 718-792'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de la lectura de la sesión siguiente.'
  },
  {
    fecha: '2026-10-28',
    // N°4
    actividades_json: [
      {
        actividad: 'ACD: Clase con lectura de apoyo:',
        recurso: 'Chust, M. y Frasquet, I. (2013). Tiempos de Revolución: Comprender las independencias iberoamericanas'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de lectura y desarrollo de Tarea: Aprendizaje Cooperativo mediante Mapa mental colaborativo: Continuidades y rupturas en el territorio histórico de la actual República del Ecuador.'
  },
  {
    fecha: '2026-11-04',
    // N°5
    actividades_json: [
      {
        actividad: 'ACD: Clase con apoyo bibliográfico:',
        recurso: 'Ayala Mora, E. (2011). Ecuador del siglo XIX: Estado Nacional, Ejército, Iglesia y Municipio'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de la lectura de la sesión siguiente. — EAA: Evaluación formativa. Rúbrica para evaluar pertinencia y participación en el mapa mental colaborativo.'
  },
  {
    fecha: '2026-11-11',
    // N°6
    actividades_json: [
      {
        actividad: 'ACD: Clase apoyada en:',
        recurso: 'Hobsbawm, E. J. (1998). Naciones y nacionalismo desde 1780'
      },
      {
        actividad: 'ACD: Inicio de Ensayo académico (Aprendizaje Cooperativo): Análisis de la inserción de Ecuador en el mundo. Cap. 1: Desde la época aborigen a la formación de la República.',
        recurso: ''
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Culminación del Ensayo académico (Cap. 1) y revisión de la lectura de la sesión siguiente.'
  },
  {
    fecha: '2026-11-18',
    // N°7
    actividades_json: [
      {
        actividad: 'ACD: Clase sobre la temática con base en:',
        recurso: 'Larrea Maldonado, C. (2010). La estructura social ecuatoriana entre 1982 y 2009'
      },
      {
        actividad: 'ACD: Resolución de dudas respecto al Parcial 1.',
        recurso: ''
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Preparación para la prueba del Parcial 1. — EAA: Evaluación formativa. Rúbrica para evaluar el desempeño y la participación del estudiante en el ensayo (Cap. 1).'
  },
  {
    fecha: '2026-11-25',
    // N°8 - Evaluación Parcial 1
    actividades_json: [
      {
        actividad: 'ACD: Evaluación. Prueba escrita con preguntas abiertas.',
        recurso: ''
      }
    ],
    materiales: '',
    observaciones: 'AA: Revisión de las lecturas de la sesión siguiente. — EAA: Evaluación sumativa. Rúbrica para evaluar el desempeño del estudiante en el examen.'
  },
  {
    fecha: '2026-12-02',
    // N°9
    actividades_json: [
      {
        actividad: 'ACD: Clase teórica con base en:',
        recurso: 'Dussel, E. (2007). El giro descolonizador desde el pueblo y hacia la segunda Emancipación (1959-)'
      },
      {
        actividad: 'ACD: Clase teórica con base en:',
        recurso: 'Borón, A. (1999). Pensamiento único y resignación política. En Tiempos violentos, CLACSO, pp. 138-156'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de la lectura de la sesión siguiente.'
  },
  {
    fecha: '2026-12-09',
    // N°10
    actividades_json: [
      {
        actividad: 'ACD: Clase teórica basada en:',
        recurso: 'Wallerstein, I. (2006). Análisis de Sistemas-Mundo. Una introducción, Cap. 5'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de la lectura de la sesión siguiente.'
  },
  {
    fecha: '2026-12-16',
    // N°11
    actividades_json: [
      {
        actividad: 'ACD: Clase con apoyo de:',
        recurso: 'ONU (2024). The Sustainable Development Goals Report'
      },
      {
        actividad: 'ACD: Inicio de Tarea (Aprendizaje Cooperativo): Mapa mental colaborativo: Desempeño del Ecuador en los ODS.',
        recurso: ''
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Culminación del mapa mental y revisión de la lectura siguiente.'
  },
  {
    fecha: '2027-01-06',
    // N°12
    actividades_json: [
      {
        actividad: 'ACD: Clase con base en:',
        recurso: 'Freidenberg, F. y Pachano, S. (2016). El sistema político ecuatoriano, Cap. 2. FLACSO Ecuador'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Revisión de la lectura de la sesión siguiente. — EAA: Evaluación formativa. Rúbrica para evaluar pertinencia y participación en el mapa mental de los ODS.'
  },
  {
    fecha: '2027-01-13',
    // N°13
    actividades_json: [
      {
        actividad: 'ACD: Discusión sobre:',
        recurso: 'Ordoñez, S. & Costa, M. (2022). Adaptación de políticas públicas para mitigar los efectos del cambio climático en Ecuador'
      },
      {
        actividad: 'ACD: Desarrollo de Ensayo académico: Cap. 2: El siglo XX (actualización con retroalimentación del Parcial 1).',
        recurso: ''
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Culminación del Ensayo (Cap. 2) y revisión de lecturas.'
  },
  {
    fecha: '2027-01-20',
    // N°14
    actividades_json: [
      {
        actividad: 'ACD: Clase con lecturas de base:',
        recurso: 'Cuvi, P. (2006). Ecuador en el mundo 1830-2006: La política exterior de la República. AFESE'
      },
      {
        actividad: 'ACD: Clase con lecturas de base:',
        recurso: 'Carrión Mena, F. (2024). La producción social de las violencias en Ecuador y América Latina. FLACSO'
      }
    ],
    materiales: SLIDE,
    observaciones: 'AA: Preparación para el Parcial 2. — EAA: Evaluación formativa. Rúbrica para evaluar el desempeño y participación en el ensayo (Cap. 2).'
  },
  {
    fecha: '2027-01-27',
    // N°15 - Evaluación Parcial 2
    actividades_json: [
      {
        actividad: 'ACD: Evaluación. Prueba escrita con preguntas abiertas.',
        recurso: ''
      }
    ],
    materiales: '',
    observaciones: 'AA: Preparación para la entrega final / examen final. — EAA: Evaluación sumativa. Rúbrica para evaluar el desempeño del estudiante en el examen escrito.'
  },
  {
    fecha: '2027-02-03',
    // N°16 - CORREGIDO: incluye "profundizado con retroalimentación de los Parciales 1 y 2"
    actividades_json: [
      {
        actividad: 'ACD: Evaluación sumativa. Entrega y defensa del Ensayo académico final: Análisis de la inserción de Ecuador en el mundo. Cap. 3: Relaciones Internacionales, seguridad y defensa del Ecuador (profundizado con retroalimentación de los Parciales 1 y 2).',
        recurso: ''
      }
    ],
    materiales: '',
    observaciones: 'EAA: Evaluación sumativa. Rúbrica para evaluar el ensayo académico integral.'
  }
];

async function run() {
  let ok = 0, err = 0;
  for (const s of sesiones) {
    const { error } = await sb.from('bitacora_clase')
      .update({
        actividades_json: s.actividades_json,
        materiales: s.materiales,
        observaciones: s.observaciones
      })
      .eq('curso_id', NEG)
      .eq('fecha', s.fecha);
    if (error) { console.log('ERROR ' + s.fecha + ':', JSON.stringify(error)); err++; }
    else { console.log('OK ' + s.fecha); ok++; }
  }
  console.log('\n✅ ' + ok + ' OK · ❌ ' + err + ' errores');
}
run().catch(console.error);
