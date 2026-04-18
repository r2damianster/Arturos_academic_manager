import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const cursoId = searchParams.get('cursoId')
  const fecha = searchParams.get('fecha')

  if (!cursoId || !fecha) {
    return NextResponse.json({ error: 'Faltan parámetros cursoId o fecha' }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [asisRes, partRes] = await Promise.all([
    db.from('asistencia')
      .select('estudiante_id, estado, atraso, horas, observacion_part')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha),
    db.from('participacion')
      .select('estudiante_id, nivel')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha),
  ])

  if (asisRes.error) {
    return NextResponse.json({ error: asisRes.error.message }, { status: 500 })
  }
  if (partRes.error) {
    return NextResponse.json({ error: partRes.error.message }, { status: 500 })
  }

  const participacionMap = new Map<string, number>()
  for (const item of partRes.data ?? []) {
    participacionMap.set(item.estudiante_id, item.nivel)
  }

  const registros: Record<string, {
    estado: 'Presente' | 'Ausente' | 'Atraso'
    atraso: boolean
    horas: number
    participacion: number | null
    observacion_part: string | null
  }> = {}

  for (const row of asisRes.data ?? []) {
    registros[row.estudiante_id] = {
      estado: row.estado,
      atraso: row.atraso,
      horas: row.horas ?? 0,
      participacion: participacionMap.get(row.estudiante_id) ?? null,
      observacion_part: row.observacion_part ?? null,
    }
  }

  return NextResponse.json({ registros })
}
