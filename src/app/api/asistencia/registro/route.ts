import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const [asisRes, partRes, bitRes] = await Promise.all([
    db.from('asistencia')
      .select('estudiante_id, estado, atraso, horas, observacion_part')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha),
    db.from('participacion')
      .select('estudiante_id, nivel')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha),
    db.from('bitacora_clase')
      .select('tema, actividades, materiales, actividades_json, observaciones')
      .eq('curso_id', cursoId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  let bitacora = null
  if (bitRes?.data) {
    // Preferir texto libre (actividades) sobre el plan estructurado (actividades_json).
    // Si solo existe actividades_json (clase planificada pero nunca editada en pase-lista),
    // formatearlo como lista legible en lugar de serializar el JSON crudo.
    const actividadesTexto = bitRes.data.actividades ||
      (Array.isArray(bitRes.data.actividades_json)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (bitRes.data.actividades_json as any[]).map((a: any) => `• ${a.actividad ?? a}`).join('\n')
        : '')

    bitacora = {
      tema: bitRes.data.tema ?? '',
      actividades: actividadesTexto,
      materiales: bitRes.data.materiales ?? '',
      observaciones: bitRes.data.observaciones ?? '',
    }
  }

  return NextResponse.json({ registros, bitacora })
}
