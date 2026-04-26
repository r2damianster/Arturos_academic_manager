import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'
import { AsistenciaGridClient } from '@/components/cursos/asistencia-grid-client'
import { calcularHorasDesdeHorario } from '@/lib/moodle-csv'

type RegistroAsistencia = Tables<'asistencia'>
type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email'>

export default async function AsistenciaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, registrosRes, horariosRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email').eq('curso_id', cursoId).eq('estado', 'activo').order('nombre'),
    db.from('asistencia').select('*').eq('curso_id', cursoId).order('fecha'),
    db.from('horarios_clases').select('dia_semana, hora_inicio, hora_fin').eq('curso_id', cursoId),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const registros: RegistroAsistencia[] = registrosRes.data ?? []

  const fechas = Array.from(new Set(registros.map(r => r.fecha))).sort()

  type HorarioRow = { dia_semana: string; hora_inicio: string; hora_fin: string }
  const horasPorDia: Record<string, number> = {}
  for (const h of (horariosRes.data ?? []) as HorarioRow[]) {
    horasPorDia[h.dia_semana] = calcularHorasDesdeHorario(h.hora_inicio, h.hora_fin)
  }

  const mapaAsistencia: Record<string, Record<string, { estado: string }>> = {}
  for (const reg of registros) {
    if (!mapaAsistencia[reg.estudiante_id]) mapaAsistencia[reg.estudiante_id] = {}
    mapaAsistencia[reg.estudiante_id][reg.fecha] = { estado: reg.estado }
  }

  const totalRegistros = registros.length
  const totalPresentes = registros.filter(r => r.estado === 'Presente').length
  const totalAusentes  = registros.filter(r => r.estado === 'Ausente').length
  const pctGlobal = totalRegistros > 0 ? Math.round((totalPresentes / totalRegistros) * 100) : 0

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Reporte de Asistencia</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><span className="stat-value">{estudiantes.length}</span><span className="stat-label">Estudiantes</span></div>
        <div className="stat-card"><span className="stat-value">{fechas.length}</span><span className="stat-label">Sesiones</span></div>
        <div className="stat-card"><span className="stat-value">{pctGlobal}%</span><span className="stat-label">Asistencia global</span></div>
        <div className="stat-card"><span className="stat-value">{totalAusentes}</span><span className="stat-label">Total ausencias</span></div>
      </div>

      {fechas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-3">Aún no hay registros de asistencia</p>
          <Link href={`/dashboard/cursos/${cursoId}/pase-lista`} className="btn-primary text-sm">
            Tomar pase de lista
          </Link>
        </div>
      ) : (
        <AsistenciaGridClient
          cursoCodigo={curso.codigo}
          cursoId={cursoId}
          estudiantes={estudiantes}
          fechas={fechas}
          mapaAsistencia={mapaAsistencia}
          horasPorDia={horasPorDia}
        />
      )}
    </div>
  )
}
