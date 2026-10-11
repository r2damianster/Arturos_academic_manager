import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGroq, GROQ_VISION_MODEL, type GroqMessage } from '@/lib/groq'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 })

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  if (!image) return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })

  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowed.includes(image.type)) {
    return NextResponse.json({ error: 'Formato no soportado. Usa PNG, JPG o WEBP.' }, { status: 400 })
  }
  if (image.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagen demasiado grande (máx 5 MB)' }, { status: 400 })
  }

  const bytes = await image.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = image.type === 'image/jpg' ? 'image/jpeg' : image.type
  const dataUrl = `data:${mimeType};base64,${base64}`

  const prompt = `Analiza esta imagen y extrae todos los logros o resultados de aprendizaje que aparezcan.

Devuelve ÚNICAMENTE un objeto JSON con este formato exacto:
{"logros": ["Logro 1 corregido", "Logro 2 corregido"]}

Reglas:
- Transcribe cada logro tal como aparece en la imagen
- Corrige errores tipográficos, ortografía y signos de puntuación obvios
- Capitaliza correctamente (primera letra mayúscula por logro)
- Si el logro tiene un indicador propio (número como 1. 2. 3., letra como a) b) c), número romano, o cualquier otro marcador que forme parte del enunciado), consérvalo al inicio del texto del logro tal como aparece
- Elimina SOLO viñetas decorativas sin valor semántico (•, -, *) que no sean parte del enunciado
- Si no encuentras logros de aprendizaje claros, devuelve: {"logros": []}
- Responde SOLO con el JSON, sin texto adicional`

  const messages: GroqMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: prompt },
      ],
    },
  ]

  // Modo JSON de Groq; si el modelo de visión lo rechaza (400), reintenta con el prompt solo.
  let result = await callGroq(messages, 1024, { model: GROQ_VISION_MODEL, temperature: 0.1, jsonMode: true })
  if (result.error?.includes('(400)')) {
    result = await callGroq(messages, 1024, { model: GROQ_VISION_MODEL, temperature: 0.1 })
  }

  if (result.error) {
    return NextResponse.json({ error: `Error del modelo de visión: ${result.error}` }, { status: 500 })
  }

  const content = result.content

  try {
    const jsonMatch = content.match(/\{[\s\S]*"logros"[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    const parsed = JSON.parse(jsonMatch[0])
    const logros: string[] = Array.isArray(parsed.logros)
      ? parsed.logros.filter((l: unknown): l is string => typeof l === 'string' && l.trim().length > 0)
      : []
    return NextResponse.json({ logros })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo interpretar la respuesta de la IA. Intenta con otra imagen.' },
      { status: 500 }
    )
  }
}
