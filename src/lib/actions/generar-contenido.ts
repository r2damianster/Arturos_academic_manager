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
- Los encabezados deben aparecer solos en su línea, en mayúsculas, con dos puntos al final.`

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callGroq(messages: GroqMessage[]): Promise<{ content: string; error?: string }> {
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
      max_tokens: 2500,
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

export async function generarHtmlSemanal(params: {
  bitacoraIds: string[]
  asignatura: string
  semanaNum: number
  instruccionAdicional?: string
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

  const userPrompt = [
    `Genera el HTML completo para la semana ${params.semanaNum} de la asignatura "${params.asignatura}".`,
    'Los recursos, videos y materiales ya están incluidos en el campo "recurso" de cada actividad — úsalos para las secciones de Recursos y Multimedia.',
    '',
    'CLASES DE ESTA SEMANA:',
    clasesTexto,
    params.instruccionAdicional ? `\nINSTRUCCIÓN ADICIONAL DEL PROFESOR:\n${params.instruccionAdicional}` : '',
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

  const userPrompt = [
    `Crea la guía de estudio para la semana ${params.semanaNum} de la asignatura "${params.asignatura}".`,
    `Nivel del curso: ${nivelLabel}.`,
    params.logroDescripcion
      ? `\nLOGRO INSTITUCIONAL (usar exactamente en la sección "LOGRO/OBJETIVO DE APRENDIZAJE AL QUE APORTA"):\n${params.logroDescripcion}`
      : '',
    '',
    'CLASES DE ESTA SEMANA:',
    clasesTexto,
    params.instruccionAdicional ? `\nINSTRUCCIÓN ADICIONAL DEL PROFESOR:\n${params.instruccionAdicional}` : '',
  ].filter(Boolean).join('\n')

  const result = await callGroq([
    { role: 'system', content: SYSTEM_GUIA },
    { role: 'user', content: userPrompt },
  ])

  return { guia: result.content, error: result.error }
}

export async function mejorarContenido(params: {
  tipo: 'html' | 'guia'
  contenidoActual: string
  solicitud: string
}): Promise<{ content: string; error?: string }> {
  const systemPrompt = params.tipo === 'html' ? SYSTEM_HTML : SYSTEM_GUIA

  const userPrompt = params.tipo === 'html'
    ? `Aquí está el HTML actual:\n\n${params.contenidoActual}\n\nModificación solicitada: ${params.solicitud}\n\nDevuelve el HTML completo actualizado, sin explicaciones.`
    : `Aquí está la guía actual:\n\n${params.contenidoActual}\n\nModificación solicitada: ${params.solicitud}\n\nDevuelve la guía completa actualizada, sin explicaciones.`

  return callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}
