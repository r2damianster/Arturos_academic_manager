import { pingSupabase } from '@/lib/supabase/keepalive'
import { NextResponse } from 'next/server'

export async function GET() {
  const result = await pingSupabase()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
