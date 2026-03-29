import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type Estudiante = Tables<'estudiantes'>
type Curso = Tables<'cursos'>
type Trabajo = Tables<'trabajos_asignados'>
type Asistencia = Pick<Tables<'asistencia'>, 'estado'>

const ESTADO_TRABAJO_COLOR: Record<string, string> = {
  'Pendiente':   'text-yellow-400 bg-yellow-900/30 border-yellow-800',
  'En progreso': 'text-blue-400 bg-blue-900/30 border-blue-800',
  'Entregado':   'text-purple-400 bg-purple-900/30 border-purple-800',
  'Aprobado':    'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  'Reprobado':   'text-red-400 bg-red-900/30 border-red-800',
}

export default async function StudentPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Todos sus registros de estudiante (puede estar en varios cursos)
  const { data: estudiantesData } = await db
    .from('estudiantes')
    .select('*')
    .eq('auth_user_id', user.id)

  const estudiantes: Estudiante[] = estudiantesData ?? []
  if (estudiantes.length === 0) redirect('/auth/login')

  const nombre = estudiantes[0].nombre
  const estudianteIds = estudiantes.map(e => e.id)
  const cursoIds = estudiantes.map(e => e.curso_id)

  // Fetch paralelo de datos — RLS policy `student_read_own_cursos` covers the cursos query
  const [cursosRes, trabajosRes, asistenciaRes] = await Promise.all([
    db.from('cursos').select('*').in('id', cursoIds),
    db.from('trabajos_asignados').select('*').in('estudiante_id', estudianteIds).order('fecha_asignacion', { ascending: false }),
    db.from('asistencia').select('estado, estudiante_id').in('estudiante_id', estudianteIds),
  ])

  const cursos: Curso[] = cursosRes.data ?? []
  const trabajos: Trabajo[] = trabajosRes.data ?? []
  const asistenciaReg: (Asistencia & { estudiante_id: string })[] = asistenciaRes.data ?? []

  // Mapas
  const cursosMap = Object.fromEntries(cursos.map(c => [c.id, c]))
  const trabajosPorEstudiante = new Map<string, Trabajo[]>()
  for (const t of trabajos) {
    if (!trabajosPorEstudiante.has(t.estudiante_id)) trabajosPorEstudiante.set(t.estudiante_id, [])
    trabajosPorEstudiante.get(t.estudiante_id)!.push(t)
  }

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hola, {nombre.split(' ')[0]} 👋</h1>
        <p className="text-gray-400 text-sm mt-1">
          {estudiantes.length === 1 ? '1 curso matriculado' : `${estudiantes.length} cursos matriculados`}
        </p>
        <Link href="/student/perfil" className="text-xs text-brand-400 hover:text-brand-300">✏️ Editar perfil →</Link>
      </div>

      {/* Encuestas — only show if survey completed (always true here since layout redirects otherwise) */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Encuestas</h2>
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-900/20 border border-emerald-800">
          <div>
            <p className="text-sm font-medium text-emerald-300">✓ Ficha inicial completada</p>
            <p className="text-xs text-gray-500 mt-0.5">Tus datos han sido registrados</p>
          </div>
        </div>
      </div>

      {/* Tarjeta por cada curso */}
      {estudiantes.map(est => {
        const curso = cursosMap[est.curso_id]
        if (!curso) return null

        const ts = trabajosPorEstudiante.get(est.id) ?? []
        const activos = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso')
        const regAsis = asistenciaReg.filter(r => r.estudiante_id === est.id)
        const presentes = regAsis.filter(r => r.estado === 'Presente').length
        const pctAsistencia = regAsis.length > 0 ? Math.round(presentes / regAsis.length * 100) : null

        return (
          <div key={est.id} className="card space-y-4">
            {/* Curso header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{curso.codigo}</span>
                <h2 className="text-lg font-semibold text-white mt-1">{curso.asignatura}</h2>
                <p className="text-xs text-gray-500">{curso.periodo}</p>
              </div>
              {pctAsistencia !== null && (
                <div className="text-right">
                  <p className={`text-xl font-bold ${pctAsistencia >= 80 ? 'text-emerald-400' : pctAsistencia >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pctAsistencia}%
                  </p>
                  <p className="text-xs text-gray-500">Asistencia</p>
                </div>
              )}
            </div>

            {/* Tutoría */}
            {est.tutoria && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-800 rounded-lg">
                <span className="text-blue-400">📅</span>
                <p className="text-sm text-blue-300 font-medium">Estás citado a tutoría</p>
              </div>
            )}

            {/* Trabajos activos */}
            {activos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2">Trabajos activos ({activos.length})</p>
                <div className="space-y-2">
                  {activos.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200">{t.tipo}</p>
                        {t.tema && <p className="text-xs text-gray-500 truncate">{t.tema}</p>}
                        {t.descripcion && <p className="text-xs text-gray-600 truncate italic">{t.descripcion}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${ESTADO_TRABAJO_COLOR[t.estado] ?? ''}`}>
                        {t.estado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trabajos completados */}
            {ts.filter(t => t.estado === 'Aprobado' || t.estado === 'Reprobado' || t.estado === 'Entregado').length > 0 && (
              <details className="text-xs text-gray-500 cursor-pointer">
                <summary className="hover:text-gray-300 transition-colors">
                  Ver historial de trabajos ({ts.length - activos.length})
                </summary>
                <div className="mt-2 space-y-1 pl-2">
                  {ts.filter(t => !activos.includes(t)).map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">{t.tipo}{t.tema ? ` · ${t.tema}` : ''}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs border ${ESTADO_TRABAJO_COLOR[t.estado] ?? ''}`}>{t.estado}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {ts.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">Sin trabajos asignados</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
