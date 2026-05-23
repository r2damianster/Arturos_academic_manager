import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { messages: ChatMessage[] }
  const { messages } = body
  if (!messages?.length) return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })

  // Fetch student context
  const { data: estudiantesData } = await db
    .from('estudiantes')
    .select('id, nombre, curso_id, carrera, tutoria')
    .eq('auth_user_id', user.id)

  const estudiantes: { id: string; nombre: string; curso_id: string; carrera: string | null; tutoria: string | null }[] = estudiantesData ?? []

  let contexto = `Eres un asistente académico amigable para estudiantes universitarios. Responde SIEMPRE en español. Sé empático, conciso y útil. No inventes datos — solo usa la información proporcionada.`

  if (estudiantes.length > 0) {
    const nombre = estudiantes[0].nombre.split(' ')[0]
    const cursoIds = estudiantes.map(e => e.curso_id)

    const [cursosRes, asistenciaRes, trabajosRes, reservasRes] = await Promise.all([
      db.from('cursos').select('id, asignatura, codigo').in('id', cursoIds),
      db.from('asistencia').select('estado, estudiante_id').in('estudiante_id', estudiantes.map(e => e.id)),
      db.from('trabajos_asignados').select('estado, estudiante_id, titulo').in('estudiante_id', estudiantes.map(e => e.id)),
      db.from('reservas').select('estado, fecha, horario_id').eq('auth_user_id', user.id).order('fecha', { ascending: false }).limit(10),
    ])

    const cursos: { id: string; asignatura: string; codigo: string }[] = cursosRes.data ?? []
    const asistencias: { estado: string; estudiante_id: string }[] = asistenciaRes.data ?? []
    const trabajos: { estado: string; estudiante_id: string; titulo: string }[] = trabajosRes.data ?? []
    const reservas: { estado: string; fecha: string }[] = reservasRes.data ?? []

    const cursosInfo = estudiantes.map(est => {
      const curso = cursos.find(c => c.id === est.curso_id)
      if (!curso) return null
      const regAsis = asistencias.filter(a => a.estudiante_id === est.id)
      const presentes = regAsis.filter(a => a.estado === 'Presente').length
      const pct = regAsis.length > 0 ? Math.round(presentes / regAsis.length * 100) : null
      const ts = trabajos.filter(t => t.estudiante_id === est.id)
      const activos = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso')
      const completados = ts.filter(t => t.estado === 'Aprobado' || t.estado === 'Entregado')
      return `- ${curso.asignatura} (${curso.codigo}): asistencia ${pct !== null ? pct + '%' : 'sin registro'}, trabajos activos: ${activos.length}, completados: ${completados.length}`
    }).filter(Boolean).join('\n')

    const reservasActivas = reservas.filter(r => r.estado === 'pendiente' || r.estado === 'confirmada')

    contexto += `\n\nDATOS DEL ESTUDIANTE:
Nombre: ${nombre}
Carrera: ${estudiantes[0].carrera ?? 'no registrada'}
Modalidad de tutoría preferida: ${estudiantes[0].tutoria ?? 'no registrada'}

CURSOS MATRICULADOS:
${cursosInfo || '- Sin cursos registrados'}

TUTORÍAS:
- Reservas activas: ${reservasActivas.length}
- Últimas reservas registradas: ${reservas.length}

Usa estos datos para responder preguntas sobre asistencia, trabajos y tutorías. Si preguntan por algo no disponible aquí, sugiere que hablen con su profesor.`
  }

  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ reply: 'El asistente IA no está disponible en este momento. Revisa la sección de FAQ o contacta a tu profesor.' })

  const groqMessages = [
    { role: 'system' as const, content: contexto },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      temperature: 0.6,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ reply: 'No pude conectarme al asistente. Intenta de nuevo.' })
  }

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content ?? 'Sin respuesta.'
  return NextResponse.json({ reply })
}
