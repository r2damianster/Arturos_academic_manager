'use server'

import { createClient } from '@/lib/supabase/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

const SYSTEM_HTML = `Eres un arquitecto experto en HTML educativo para LMS (Moodle, Canvas, Blackboard).

Genera código HTML optimizado para dispositivos móviles con:
- Contenedor máximo 900px centrado, fuentes Segoe UI o Arial
- Estilos 100% inline (sin <script>)
- Paleta de colores pastel suave: encabezados #d1e9ff, recursos #e8f6f3, actividades #fef9e7
- Bordes redondeados (10-15px) y sombras muy sutiles (box-shadow: 0 2px 8px rgba(0,0,0,0.08))
- Estructura de scroll vertical — sin pestañas, sin acordeones, todo visible al hacer scroll

Secciones en orden:
1. ENCABEZADO: título del tema + número de semana + nombre de la asignatura
2. INTRODUCCIÓN: contexto del tema (3-4 párrafos)
3. REFERENCIA: incluir ÚNICAMENTE si el profesor ya proporcionó alguna referencia bibliográfica real en los materiales o instrucción adicional. Si no hay ninguna referencia concreta, OMITIR esta sección completamente. NUNCA inventar ni generar citas APA propias.
4. RECURSOS: si se proporcionan links o materiales (que no sean video ni presentación Google Slides), crear cards con botón CTA azul que abra el link en pestaña nueva.
5. MULTIMEDIA — seguir estas reglas en orden de prioridad:
   a) Google Slides: si hay una URL de Google Slides (docs.google.com/presentation), incrustarla como <iframe> con src en formato embed. Conversión: reemplazar /edit, /view o /pub por /embed (si ya tiene /pub, agregar ?start=false&loop=false). Atributos: width="100%" height="480" frameborder="0" allowfullscreen="true" style="border-radius:10px;border:none;display:block;margin:12px 0". Los <iframe> de Google Slides SÍ están permitidos.
   b) Video YouTube/Vimeo: crear botón CTA rojo que abra el video en pestaña nueva. Texto: "▶ Ver video". NUNCA usar iframe para videos.
   Si NO existe ningún recurso de tipo multimedia en los datos del profesor, OMITIR esta sección completamente. NO inventar videos ni presentaciones.
6. ACTIVIDADES: solo si hay tareas o actividades registradas
7. CIERRE: tip pedagógico breve o reflexión final

REGLAS CRÍTICAS — NUNCA VIOLAR:
- PROHIBIDO: etiquetas <script>, <object>, <embed>
- PROHIBIDO: atributos onclick, onload
- <iframe> SOLO para Google Slides/Google Drive presentations (dominio docs.google.com). Para cualquier otro dominio, PROHIBIDO.
- Solo estilos inline con style=""
- Videos YouTube/Vimeo: <a href="URL" target="_blank" rel="noopener noreferrer"> con estilo botón rojo. NUNCA iframe para video.
- Si el prompt incluye "INSTRUCCIÓN PRIORITARIA DEL PROFESOR", esa instrucción tiene MÁXIMA PRIORIDAD y puede modificar, limitar o filtrar las secciones descritas arriba. Aplícala estrictamente.

Responde ÚNICAMENTE con el código HTML completo listo para copiar, sin explicaciones, sin bloques markdown, sin texto fuera del HTML.`

const SYSTEM_GUIA = `Eres un experto pedagogo especializado en diseñar guías de aprendizaje universitarias.

Crea una guía de aprendizaje completa en español basándote en las clases proporcionadas.
Identifica el tema central unificador y organiza el contenido siguiendo EXACTAMENTE esta estructura.

Usa exactamente estos encabezados (en MAYÚSCULAS, con dos puntos al final):

GUÍA DE APRENDIZAJE - SEMANA [N]: [TEMA PRINCIPAL]
ASIGNATURA: [nombre]

CONTENIDO QUE ABARCA LA ACTIVIDAD:
(describe el tema o contenido específico que cubre esta guía, en 2-3 oraciones)

TIEMPO DE LA ACTIVIDAD:
(estimación realista en horas de trabajo autónomo del estudiante, ej: "4 horas de trabajo autónomo distribuidas en la semana")

LOGRO/OBJETIVO DE APRENDIZAJE AL QUE APORTA:
(si se proporciona un LOGRO INSTITUCIONAL en los datos del profesor, úsalo exactamente sin parafrasear; si no se proporciona, redacta uno concreto y medible con verbos de Bloom basándote en las actividades: "Al finalizar el estudiante será capaz de...")

COMPETENCIA TÉCNICA Y/O HABILIDAD BLANDA A DESARROLLAR:
(seleccionar 1 a 3 habilidades blandas de la siguiente lista cerrada que mejor se ajusten a la actividad; indicar nombre y categoría; NO inventar habilidades fuera de esta lista:

INTERPERSONALES: Comunicación efectiva | Trabajo en equipo | Liderazgo | Empatía | Escucha activa | Manejo de conflictos
INTRAPERSONALES: Inteligencia emocional | Gestión del tiempo | Resiliencia | Autogestión | Proactividad | Motivación intrínseca
COGNITIVAS: Pensamiento crítico | Resolución de problemas | Toma de decisiones | Creatividad | Capacidad de aprendizaje
DE GESTIÓN: Gestión de proyectos | Negociación | Adaptabilidad | Planeación estratégica | Delegación
SOCIALES Y ÉTICAS: Asertividad | Networking | Diversidad e inclusión | Ética profesional | Trabajo en ambientes multiculturales
CONTEXTUALES: Cultura organizacional | Servicio al cliente | Manejo del estrés | Habilidades digitales transversales
ESPECÍFICAS: Observación | Análisis de datos | Atención al detalle | Precisión | Organización | Compromiso | Autonomía

Formato de respuesta: "- [Habilidad] ([Categoría]): [breve justificación de por qué aplica a esta actividad]")

DESCRIPCIÓN DE LA ACTIVIDAD:
(explicación clara de en qué consiste la actividad y cómo debe prepararse el estudiante para realizarla, 3-5 oraciones)

MATERIALES NECESARIOS:
(listar con guiones los materiales físicos, digitales y/o bibliográficos necesarios; incluir únicamente los que aparecen en los datos del profesor; si hay recursos o links concretos en las actividades, listarlos aquí)

INSTRUCCIONES O PASOS A EJECUTAR:
(numerados del 1 en adelante, concretos, ordenados y ejecutables por el estudiante de forma autónoma)

RÚBRICA:
(crear criterios de evaluación; si hay suficiente contexto, incluir 4 niveles: Excelente / Satisfactorio / En desarrollo / Insuficiente con descripción breve por nivel y ponderación; si no hay suficiente información, incluir al menos 3 criterios con su descripción y ponderación estimada)

RECOMENDACIONES DEL PROFESOR:
(opcional: incluir solo si hay observaciones concretas en los datos del profesor o si el contexto amerita advertencias importantes; si no hay información relevante, escribir "No hay recomendaciones adicionales para esta actividad.")

REGLAS:
- Responde con el texto completo en texto plano estructurado.
- No uses markdown (sin **, sin ##, sin *).
- Usa solo encabezados en MAYÚSCULAS como se indica arriba.
- Los encabezados deben aparecer solos en su línea, en mayúsculas, con dos puntos al final.
- Si el prompt incluye "INSTRUCCIÓN PRIORITARIA DEL PROFESOR", esa instrucción tiene MÁXIMA PRIORIDAD y puede modificar, limitar o filtrar las secciones o el contenido. Aplícala estrictamente antes de procesar los datos.`

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callGroq(messages: GroqMessage[], maxTokens = 2500): Promise<{ content: string; error?: string }> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { content: '', error: 'GROQ_API_KEY no configurado en variables de entorno' }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { content: '', error: `Error Groq API (${res.status}): ${err.slice(0, 200)}` }
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return { content }
}

interface BitacoraRaw {
  fecha: string
  tema: string | null
  actividades_json: unknown
  observaciones: string | null
}

function formatBitacorasParaPrompt(bitacoras: BitacoraRaw[]): string {
  return bitacoras.map(b => {
    const acts = Array.isArray(b.actividades_json)
      ? (b.actividades_json as { actividad: string; recurso: string }[])
          .map(a => `  - ${a.actividad}${a.recurso ? ` (recurso: ${a.recurso})` : ''}`)
          .join('\n')
      : ''
    return [
      `Fecha: ${b.fecha}`,
      `Tema: ${b.tema ?? 'Sin definir'}`,
      `Actividades:\n${acts || '  (ninguna registrada)'}`,
      `Observaciones: ${b.observaciones ?? 'ninguna'}`,
    ].join('\n')
  }).join('\n\n---\n\n')
}

async function fetchHistorialClases(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoId: string,
  excludeIds: string[]
): Promise<string> {
  const { data } = await supabase
    .from('bitacora_clase')
    .select('fecha, tema, actividades_json, observaciones')
    .eq('curso_id', cursoId)
    .eq('estado', 'cumplido')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('fecha', { ascending: false })
    .limit(2)

  if (!data?.length) return ''
  return formatBitacorasParaPrompt([...data].reverse())
}

export async function generarHtmlSemanal(params: {
  bitacoraIds: string[]
  asignatura: string
  semanaNum: number
  instruccionAdicional?: string
  cursoId?: string
}): Promise<{ html: string; error?: string }> {
  const supabase = await createClient()

  const { data: bitacoras, error: dbErr } = await supabase
    .from('bitacora_clase')
    .select('fecha, tema, actividades_json, observaciones')
    .in('id', params.bitacoraIds)
    .order('fecha', { ascending: true })

  if (dbErr) return { html: '', error: `Error de base de datos: ${dbErr.message}` }
  if (!bitacoras?.length) return { html: '', error: 'No se encontraron las clases seleccionadas' }

  const clasesTexto = formatBitacorasParaPrompt(bitacoras)

  let historialTexto = ''
  if (params.cursoId) {
    historialTexto = await fetchHistorialClases(supabase, params.cursoId, params.bitacoraIds)
  }

  const userPrompt = [
    params.instruccionAdicional ? `INSTRUCCIÓN PRIORITARIA DEL PROFESOR (aplicar con máxima prioridad — puede filtrar, limitar o enfocar el contenido generado; si dice "únicamente" o "solo", ignorar todo lo demás):\n${params.instruccionAdicional}\n` : '',
    `Genera el HTML completo para la semana ${params.semanaNum} de la asignatura "${params.asignatura}".`,
    'Los recursos, videos y materiales ya están incluidos en el campo "recurso" de cada actividad — úsalos para las secciones de Recursos y Multimedia.',
    historialTexto ? `\nCONTEXTO DE CLASES ANTERIORES (solo como referencia para no repetir temas — NO incluir en el HTML):\n${historialTexto}` : '',
    '',
    'CLASES DE ESTA SEMANA:',
    clasesTexto,
  ].filter(Boolean).join('\n')

  const result = await callGroq([
    { role: 'system', content: SYSTEM_HTML },
    { role: 'user', content: userPrompt },
  ])

  return { html: result.content, error: result.error }
}

export async function generarGuiaSemanal(params: {
  bitacoraIds: string[]
  asignatura: string
  semanaNum: number
  nivel: 'basico' | 'avanzado'
  instruccionAdicional?: string
  logroDescripcion?: string
  cursoId?: string
}): Promise<{ guia: string; error?: string }> {
  const supabase = await createClient()

  const { data: bitacoras, error: dbErr } = await supabase
    .from('bitacora_clase')
    .select('fecha, tema, actividades_json, observaciones')
    .in('id', params.bitacoraIds)
    .order('fecha', { ascending: true })

  if (dbErr) return { guia: '', error: `Error de base de datos: ${dbErr.message}` }
  if (!bitacoras?.length) return { guia: '', error: 'No se encontraron las clases seleccionadas' }

  const clasesTexto = formatBitacorasParaPrompt(bitacoras)
  const nivelLabel = params.nivel === 'avanzado' ? 'universitario avanzado (último año)' : 'universitario básico / introductorio'

  let historialTexto = ''
  if (params.cursoId) {
    historialTexto = await fetchHistorialClases(supabase, params.cursoId, params.bitacoraIds)
  }

  const userPrompt = [
    params.instruccionAdicional ? `INSTRUCCIÓN PRIORITARIA DEL PROFESOR (aplicar con máxima prioridad — puede filtrar, limitar o enfocar el contenido generado; si dice "únicamente" o "solo", ignorar todo lo demás):\n${params.instruccionAdicional}\n` : '',
    `Crea la guía de estudio para la semana ${params.semanaNum} de la asignatura "${params.asignatura}".`,
    `Nivel del curso: ${nivelLabel}.`,
    params.logroDescripcion
      ? `\nLOGRO INSTITUCIONAL (usar exactamente en la sección "LOGRO/OBJETIVO DE APRENDIZAJE AL QUE APORTA"):\n${params.logroDescripcion}`
      : '',
    historialTexto ? `\nCONTEXTO DE CLASES ANTERIORES (solo para evitar repetir temas ya cubiertos — NO mencionar en la guía):\n${historialTexto}` : '',
    '',
    'CLASES DE ESTA SEMANA:',
    clasesTexto,
  ].filter(Boolean).join('\n')

  const result = await callGroq([
    { role: 'system', content: SYSTEM_GUIA },
    { role: 'user', content: userPrompt },
  ])

  return { guia: result.content, error: result.error }
}

export async function generarPrepTutoria(params: {
  nombreProfesor: string
  carreraEstudiante: string | null
}): Promise<{ sugerencias: string; error?: string }> {
  const result = await callGroq([
    {
      role: 'system',
      content: `Eres un asistente académico. El estudiante acaba de reservar una tutoría.
Genera exactamente 3 sugerencias concretas y breves para aprovechar al máximo la sesión.
Formato: lista numerada (1. 2. 3.), una oración por punto, sin introducción ni conclusión.
Tono motivador pero directo. En español.`,
    },
    {
      role: 'user',
      content: `Tutoría con: ${params.nombreProfesor}. Carrera del estudiante: ${params.carreraEstudiante ?? 'universitaria'}.`,
    },
  ])
  return { sugerencias: result.content, error: result.error }
}

export async function generarAutodiagnostico(params: {
  asignatura: string
  pctAsistencia: number | null
  trabajosActivos: number
  trabajosCompletados: number
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}): Promise<{ mensaje: string; error?: string }> {
  const { asignatura, pctAsistencia, trabajosActivos, trabajosCompletados, tutoriasAsistidas, tutoriasFaltadas } = params

  const contexto = [
    `Asignatura: ${asignatura}`,
    pctAsistencia !== null ? `Asistencia estimada: ${pctAsistencia}%` : 'Asistencia: sin registros aún',
    `Trabajos activos (pendiente/en progreso): ${trabajosActivos}`,
    `Trabajos completados (entregado/aprobado): ${trabajosCompletados}`,
    `Tutorías asistidas: ${tutoriasAsistidas} | Tutorías faltadas: ${tutoriasFaltadas}`,
  ].join('\n')

  const result = await callGroq([
    {
      role: 'system',
      content: `Eres un tutor universitario empático. Con los datos del estudiante, escribe exactamente 2-3 oraciones motivacionales y concretas.

REGLAS ESTRICTAS:
- Solo 2-3 oraciones. Ni más ni menos.
- Tono positivo y alentador, nunca alarmista ni condescendiente
- Menciona algo concreto basado en los datos (no frases genéricas)
- Si la asistencia es < 75%, sugiere mejorarla con tacto
- Si tiene tutorías faltadas, mencionarlo con amabilidad
- Si trabajos activos > 3, reconoce la carga
- Sin saludos, sin títulos, sin listas. Solo párrafo corrido.
- En español, tono de tutor cercano`,
    },
    { role: 'user', content: contexto },
  ])

  return { mensaje: result.content, error: result.error }
}

export async function generarPerfilPedagogico(params: {
  contexto: string
  asignatura: string
}): Promise<{ perfil: string; error?: string }> {
  const result = await callGroq([
    {
      role: 'system',
      content: `Eres un pedagogo universitario experto en diseño instruccional.
Recibirás datos socioeconómicos y de comportamiento digital de un grupo de estudiantes universitarios.
Genera exactamente 3 párrafos (sin numeración, sin encabezados) con una estrategia pedagógica concreta:

Párrafo 1 — PERFIL DEL GRUPO: describe brevemente quiénes son los estudiantes según los datos (situación económica, acceso a tecnología, relación con la lectura/escritura y la IA).

Párrafo 2 — OPORTUNIDADES: identifica 2-3 fortalezas o características aprovechables pedagógicamente.

Párrafo 3 — RECOMENDACIONES: sugiere 3 estrategias concretas y accionables adaptadas a este perfil específico (metodologías, tipos de actividades, evaluaciones). Sé directo y específico.

REGLAS:
- Solo texto plano, sin markdown, sin asteriscos, sin encabezados
- Español universitario formal
- Máximo 250 palabras en total
- Basarte SOLO en los datos proporcionados, no inventar`,
    },
    {
      role: 'user',
      content: `Asignatura: ${params.asignatura}\n\n${params.contexto}`,
    },
  ])

  return { perfil: result.content, error: result.error }
}

export async function corregirPlan(params: {
  texto: string
}): Promise<{ corregido: string; error?: string }> {
  const result = await callGroq([
    {
      role: 'system',
      content: `Eres un corrector ortográfico minimalista. Tu ÚNICA tarea:
1. Corregir errores ortográficos y de puntuación
2. Agregar conectores lógicos (por tanto, sin embargo, además, luego, etc.) SOLO donde la frase quede entrecortada o ambigua sin ellos

PROHIBIDO:
- Reescribir frases
- Cambiar el significado
- Agregar contenido nuevo
- Eliminar contenido
- Cambiar el estilo o vocabulario

Devuelve ÚNICAMENTE el texto corregido, sin explicaciones, sin comillas, sin prefijos.`,
    },
    {
      role: 'user',
      content: params.texto,
    },
  ])

  return { corregido: result.content, error: result.error }
}

const SYSTEM_MOODLE_XML = `Eres un generador experto de bancos de preguntas en formato Moodle XML.

Tu salida DEBE cumplir estrictamente estas reglas:

FORMATO DE SALIDA:
- Responde ÚNICAMENTE con el XML completo, empezando exactamente con <?xml version="1.0" encoding="UTF-8"?>
- PROHIBIDO: texto antes del XML, markdown, fences de código (triple backtick), explicaciones, comentarios fuera del XML
- El XML debe terminar con </quiz>

ESTRUCTURA OBLIGATORIA:
<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <!-- primer nodo: categoría -->
  <question type="category">
    <category>
      <text>$course$/NOMBRE_CATEGORIA</text>
    </category>
  </question>
  <!-- luego las preguntas -->
</quiz>

REGLAS DE CONTENIDO:
1. Todo texto dentro de <name>, <questiontext>, <text> de respuestas y <feedback> DEBE estar en bloques <![CDATA[ ... ]]>
2. <questiontext> siempre con atributo format="html"
3. Usar español formal y pedagógico; feedback explicativo por cada opción

PLANTILLAS POR TIPO:

multichoice (opción múltiple, respuesta única):
<question type="multichoice">
  <name><text><![CDATA[COD_01]]></text></name>
  <questiontext format="html"><text><![CDATA[Enunciado de la pregunta]]></text></questiontext>
  <single>true</single>
  <shuffleanswers>1</shuffleanswers>
  <answernumbering>abc</answernumbering>
  <answer fraction="100"><text><![CDATA[Respuesta correcta]]></text><feedback><text><![CDATA[Correcto. Justificación.]]></text></feedback></answer>
  <answer fraction="0"><text><![CDATA[Distractor 1]]></text><feedback><text><![CDATA[Incorrecto. Explicación.]]></text></feedback></answer>
  <answer fraction="0"><text><![CDATA[Distractor 2]]></text><feedback><text><![CDATA[Incorrecto. Explicación.]]></text></feedback></answer>
  <answer fraction="0"><text><![CDATA[Distractor 3]]></text><feedback><text><![CDATA[Incorrecto. Explicación.]]></text></feedback></answer>
</question>

truefalse (verdadero/falso):
<question type="truefalse">
  <name><text><![CDATA[COD_02]]></text></name>
  <questiontext format="html"><text><![CDATA[Afirmación a evaluar.]]></text></questiontext>
  <answer fraction="100"><text><![CDATA[verdadero]]></text><feedback><text><![CDATA[Correcto. Justificación.]]></text></feedback></answer>
  <answer fraction="0"><text><![CDATA[falso]]></text><feedback><text><![CDATA[Incorrecto. Explicación.]]></text></feedback></answer>
</question>

matching (emparejamiento):
<question type="matching">
  <name><text><![CDATA[COD_03]]></text></name>
  <questiontext format="html"><text><![CDATA[Relacione cada concepto con su definición.]]></text></questiontext>
  <shuffleanswers>true</shuffleanswers>
  <subquestion><text><![CDATA[Concepto A]]></text><answer><text><![CDATA[Definición A]]></text></answer></subquestion>
  <subquestion><text><![CDATA[Concepto B]]></text><answer><text><![CDATA[Definición B]]></text></answer></subquestion>
  <subquestion><text><![CDATA[Concepto C]]></text><answer><text><![CDATA[Definición C]]></text></answer></subquestion>
</question>

shortanswer (respuesta corta):
<question type="shortanswer">
  <name><text><![CDATA[COD_04]]></text></name>
  <questiontext format="html"><text><![CDATA[Pregunta de respuesta corta.]]></text></questiontext>
  <usecase>0</usecase>
  <answer fraction="100"><text><![CDATA[respuesta exacta esperada]]></text><feedback><text><![CDATA[Correcto. Justificación.]]></text></feedback></answer>
</question>

VALIDACIONES CRÍTICAS:
- En multichoice: exactamente UNA respuesta con fraction="100", las demás con fraction="0"
- En truefalse: los textos deben ser "verdadero" y "falso" en minúsculas
- Cada pregunta debe tener <name> con código único (COD_01, COD_02, etc.)
- Cierre correcto de todas las etiquetas: cada <question> cierra con </question>`

function sanitizeXml(raw: string): string {
  const idx = raw.indexOf('<?xml')
  if (idx === -1) return ''
  return raw.slice(idx).trim()
}

type TipoPregunta = 'multichoice' | 'truefalse' | 'matching' | 'shortanswer'

const TIPO_LABELS: Record<TipoPregunta, string> = {
  multichoice: 'opción múltiple (respuesta única con distractores)',
  truefalse: 'verdadero/falso',
  matching: 'emparejamiento (relacionar columnas)',
  shortanswer: 'respuesta corta',
}

const TOKENS_POR_TIPO: Record<TipoPregunta, number> = {
  multichoice: 260,
  truefalse: 120,
  matching: 200,
  shortanswer: 130,
}

// Cuenta de tokens estimada del XML de salida + margen, acotada al límite de TPM de la cuenta Groq (12000)
function estimarMaxTokensEvaluacion(total: number, tipos: TipoPregunta[]): number {
  if (tipos.length === 0) return 2000
  const promedio = tipos.reduce((sum, t) => sum + TOKENS_POR_TIPO[t], 0) / tipos.length
  const estimado = Math.round(total * promedio + 80)
  return Math.min(8000, Math.max(2000, Math.round(estimado * 1.3)))
}

export async function generarEvaluacionMoodle(params: {
  bitacoraIds: string[]
  asignatura: string
  semanaNum: number
  tipos: TipoPregunta[]
  totalPreguntas: number
  categoria?: string
  instruccionAdicional?: string
  cursoId?: string
}): Promise<{ xml: string; error?: string }> {
  const supabase = await createClient()

  const { data: bitacoras, error: dbErr } = await supabase
    .from('bitacora_clase')
    .select('fecha, tema, actividades_json, observaciones')
    .in('id', params.bitacoraIds)
    .order('fecha', { ascending: true })

  if (dbErr) return { xml: '', error: `Error de base de datos: ${dbErr.message}` }
  if (!bitacoras?.length) return { xml: '', error: 'No se encontraron las clases seleccionadas' }

  const clasesTexto = formatBitacorasParaPrompt(bitacoras)

  let historialTexto = ''
  if (params.cursoId) {
    historialTexto = await fetchHistorialClases(supabase, params.cursoId, params.bitacoraIds)
  }

  const categoria = params.categoria?.trim() || `$course$/Semana ${params.semanaNum} - ${params.asignatura}`
  const tiposTexto = params.tipos.map(t => TIPO_LABELS[t]).join(', ')

  const userPrompt = [
    params.instruccionAdicional ? `INSTRUCCIÓN PRIORITARIA DEL PROFESOR (máxima prioridad — puede enfocar o limitar el contenido):\n${params.instruccionAdicional}\n` : '',
    `Genera un banco de preguntas en formato Moodle XML para la semana ${params.semanaNum} de la asignatura "${params.asignatura}".`,
    ``,
    `Configuración:`,
    `- Total de preguntas: ${params.totalPreguntas}`,
    `- Tipos de pregunta a usar: ${tiposTexto}`,
    `- Reparte las preguntas equilibradamente entre los tipos indicados`,
    `- Categoría Moodle: ${categoria}`,
    ``,
    historialTexto ? `CONTEXTO DE CLASES ANTERIORES (solo para evitar repetir temas ya evaluados):\n${historialTexto}\n` : '',
    `CLASES DE ESTA SEMANA (base de contenido para las preguntas):`,
    clasesTexto,
  ].filter(Boolean).join('\n')

  const maxTokens = estimarMaxTokensEvaluacion(params.totalPreguntas, params.tipos)

  const result = await callGroq([
    { role: 'system', content: SYSTEM_MOODLE_XML },
    { role: 'user', content: userPrompt },
  ], maxTokens)

  if (result.error) return { xml: '', error: result.error }

  const xml = sanitizeXml(result.content)
  if (!xml) return { xml: '', error: 'La IA no generó un XML válido. Intenta de nuevo.' }
  if (!xml.includes('</quiz>')) return { xml: '', error: 'El XML quedó incompleto (límite de tokens alcanzado). Reduce el número de preguntas o selecciona menos tipos.' }

  return { xml }
}

export async function mejorarContenido(params: {
  tipo: 'html' | 'guia' | 'evaluacion'
  contenidoActual: string
  solicitud: string
}): Promise<{ content: string; error?: string }> {
  if (params.tipo === 'evaluacion') {
    // El XML actualizado ronda el tamaño del actual; acotar al límite de TPM de la cuenta Groq (12000)
    const maxTokens = Math.min(8000, Math.max(2000, Math.round(params.contenidoActual.length / 3)))
    const result = await callGroq([
      { role: 'system', content: SYSTEM_MOODLE_XML },
      {
        role: 'user',
        content: `INSTRUCCIÓN PRIORITARIA: ${params.solicitud}\n\nAquí está el XML actual:\n\n${params.contenidoActual}\n\nDevuelve el XML completo actualizado. Mantén formato Moodle XML válido. Sin explicaciones, sin markdown, sin fences.`,
      },
    ], maxTokens)
    if (result.error) return result
    const sanitized = sanitizeXml(result.content)
    if (!sanitized) return { content: '', error: 'La IA no devolvió un XML válido. Intenta de nuevo.' }
    return { content: sanitized }
  }

  const systemPrompt = params.tipo === 'html' ? SYSTEM_HTML : SYSTEM_GUIA

  const userPrompt = params.tipo === 'html'
    ? `INSTRUCCIÓN PRIORITARIA (aplicar con máxima prioridad; si dice "únicamente" o "solo", ignorar secciones no relacionadas): ${params.solicitud}\n\nAquí está el HTML actual:\n\n${params.contenidoActual}\n\nDevuelve el HTML completo actualizado según la instrucción, sin explicaciones.`
    : `INSTRUCCIÓN PRIORITARIA (aplicar con máxima prioridad; si dice "únicamente" o "solo", ignorar secciones no relacionadas): ${params.solicitud}\n\nAquí está la guía actual:\n\n${params.contenidoActual}\n\nDevuelve la guía completa actualizada según la instrucción, sin explicaciones.`

  return callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}

export async function generarRetroalimentacionFormativa(params: {
  asignatura: string
  pctAsistencia: number | null
  trabajosCompletados: number
  trabajosActivos: number
  trabajosTotal: number
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}): Promise<{ retroalimentacion: string; error?: string }> {
  const {
    asignatura,
    pctAsistencia,
    trabajosCompletados,
    trabajosActivos,
    trabajosTotal,
    tutoriasAsistidas,
    tutoriasFaltadas,
  } = params

  const context = [
    `Asignatura: ${asignatura}`,
    `Asistencia: ${pctAsistencia !== null ? `${pctAsistencia}%` : 'sin datos'}`,
    `Trabajos: ${trabajosCompletados} completados de ${trabajosTotal} total, ${trabajosActivos} en progreso`,
    `Tutorías: ${tutoriasAsistidas} asistidas, ${tutoriasFaltadas} no asistidas`,
  ].join('. ')

  const result = await callGroq([
    {
      role: 'system',
      content: `Eres un tutor académico empático. Generas retroalimentación formativa breve (máximo 180 palabras) basada SOLO en datos reales. Estructura: exactamente 3 párrafos cortos. Párrafo 1 (Fortalezas): destaca lo positivo observable. Párrafo 2 (Oportunidades): señala UN área concreta de mejora. Párrafo 3 (Estrategias): sugiere DOS acciones específicas para las próximas semanas. Tono: constructivo, motivador, nunca peyorativo. Sin saludos, sin despedidas, sin listas con viñetas, solo prosa.`,
    },
    {
      role: 'user',
      content: `Genera retroalimentación formativa para un estudiante con estos datos: ${context}`,
    },
  ])

  if (result.error || !result.content) {
    return { retroalimentacion: '', error: result.error ?? 'Sin respuesta' }
  }

  return { retroalimentacion: result.content.trim() }
}
