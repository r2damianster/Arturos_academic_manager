import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL
  return NextResponse.json({
    groq_key_set: !!key,
    groq_key_length: key?.length ?? 0,
    groq_key_prefix: key ? key.slice(0, 8) + '...' : null,
    groq_model: model ?? 'NOT SET',
    node_env: process.env.NODE_ENV,
  })
}
