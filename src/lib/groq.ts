// Cliente único de Groq (API compatible con OpenAI). Solo servidor: lee GROQ_API_KEY.

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'
export const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | GroqContentPart[]
}

export interface GroqOptions {
  /** Modelo a usar; por defecto GROQ_MODEL. */
  model?: string
  temperature?: number
  /** Solo se envía a modelos gpt-oss (`low` | `medium` | `high`). */
  reasoningEffort?: 'low' | 'medium' | 'high'
  /** Pide `response_format: { type: 'json_object' }`. */
  jsonMode?: boolean
  /** Reintentos ante 429 (espera lo que indique la API). */
  retries?: number
}

export interface GroqResult {
  content: string
  error?: string
  finishReason?: string
}

export async function callGroq(
  messages: GroqMessage[],
  maxTokens = 2500,
  options: GroqOptions = {},
): Promise<GroqResult> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { content: '', error: 'GROQ_API_KEY no configurado en variables de entorno' }

  const model = options.model ?? GROQ_MODEL
  const retries = options.retries ?? 2

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: maxTokens,
  }
  if (options.reasoningEffort && model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = options.reasoningEffort
  }
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()

    // 429 TPM: Groq indica en el mensaje "Please try again in X.XXXs" — esperar ese tiempo y reintentar
    if (res.status === 429 && retries > 0) {
      const wait = errorText.match(/try again in ([\d.]+)s/)
      const waitMs = wait ? Math.ceil(parseFloat(wait[1]) * 1000) + 500 : 8000
      await new Promise(resolve => setTimeout(resolve, waitMs))
      return callGroq(messages, maxTokens, { ...options, retries: retries - 1 })
    }

    return { content: '', error: `Error Groq API (${res.status}): ${errorText.slice(0, 200)}` }
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const content: string = choice?.message?.content ?? ''
  const finishReason: string | undefined = choice?.finish_reason

  // Contabilidad de tokens: una línea por llamada, visible en los logs de Vercel.
  console.info('[groq]', JSON.stringify({
    model,
    prompt_tokens: data.usage?.prompt_tokens,
    completion_tokens: data.usage?.completion_tokens,
    finish_reason: finishReason,
  }))

  return { content, finishReason }
}
