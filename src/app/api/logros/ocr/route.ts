import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

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
- Elimina numeración o viñetas que sean parte del formato (1., •, -)
- Si no encuentras logros de aprendizaje claros, devuelve: {"logros": []}
- Responde SOLO con el JSON, sin texto adicional`

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: `Error del modelo de visión (${response.status})` }, { status: 500 })
  }

  const result = await response.json()
  const content: string = result.choices?.[0]?.message?.content ?? ''

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
