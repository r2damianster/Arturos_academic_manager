import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

type Estudiante    = Tables<'estudiantes'>
type Calificacion  = Tables<'calificaciones'>
type Asistencia    = Tables<'asistencia'>
type Participacion = Tables<'participacion'>
type Perfil        = Tables<'perfiles_estudiante'>
type Trabajo       = Tables<'trabajos_asignados'>
type Observacion   = Tables<'observaciones_trabajo'>
type Curso         = Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo' | 'periodo'>

export default async function FichaEstudiantePage({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const estudianteRes = await db
    .from('estudiantes')
    .select('*, cursos(id, asignatura, codigo, periodo)')
    .eq('id', estudianteId)
    .single()

  if (!estudianteRes.data) notFound()

  const estudiante = estudianteRes.data as Estudiante & { cursos?: Curso }
  const curso = estudiante.cursos ?? null

  const [califRes, asisRes, partRes, trabajosRes, perfilRes] = await Promise.all([
    db.from('calificaciones').select('*').eq('estudiante_id', estudianteId).single(),
    db.from('asistencia').select('*').eq('estudiante_id', estudianteId).order('fecha'),
    db.from('participacion').select('*').eq('estudiante_id', estudianteId).order('fecha'),
    db.from('trabajos_asignados').select('*, observaciones_trabajo(*)').eq('estudiante_id', estudianteId).order('created_at'),
    db.from('perfiles_estudiante').select('*').eq('estudiante_id', estudianteId).single(),
  ])

  const calificaciones  = califRes.data as Calificacion | null
  const asistencia      = (asisRes.data ?? []) as Asistencia[]
  const participacion   = (partRes.data ?? []) as Participacion[]
  const trabajos        = (trabajosRes.data ?? []) as (Trabajo & { observaciones_trabajo: Observacion[] })[]
  const perfil          = perfilRes.data as Perfil | null

  const totalSesiones   = asistencia.length
  const presentes       = asistencia.filter(r => r.estado === 'Presente').length
  const ausentes        = asistencia.filter(r => r.estado === 'Ausente').length
  const atrasos         = asistencia.filter(r => r.atraso).length
  const pctAsistencia   = totalSesiones > 0 ? Math.round((presentes / totalSesiones) * 100) : 0
  const promedioParticipacion = participacion.length > 0
    ? (participacion.reduce((s, p) => s + (p.nivel ?? 0), 0) / participacion.length).toFixed(1)
    : null

  const ESTADOS_COLOR: Record<string, string> = {
    'Pendiente':    'badge-amarillo',
    'En progreso':  'badge-azul',
    'Entregado':    'badge-verde',
    'Aprobado':     'badge-verde',
    'Reprobado':    'badge-rojo',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        {curso && (
          <Link href={`/dashboard/cursos/${curso.id}`} className="btn-ghost p-2 mt-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-white">{estudiante.nombre}</h1>
            {estudiante.tutoria && <span className="badge-azul">Tutoría</span>}
          </div>
          <p className="text-gray-400 text-sm">{estudiante.email}</p>
          {curso && (
            <p className="text-gray-500 text-xs mt-1">{curso.asignatura} · {curso.codigo} · {curso.periodo}</p>
          )}
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className={`stat-value ${pctAsistencia >= 80 ? 'text-emerald-400' : pctAsistencia >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {pctAsistencia}%
          </span>
          <span className="stat-label">Asistencia</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{ausentes}</span>
          <span className="stat-label">Ausencias</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{atrasos}</span>
          <span className="stat-label">Atrasos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{promedioParticipacion ?? '—'}</span>
          <span className="stat-label">Participación prom.</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Perfil */}
        {perfil && (
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Perfil</h2>
            <dl className="space-y-2 text-sm">
              {perfil.carrera && (
                <div className="flex justify-between"><dt className="text-gray-500">Carrera</dt><dd className="text-gray-200">{perfil.carrera}</dd></div>
              )}
              {perfil.edad && (
                <div className="flex justify-between"><dt className="text-gray-500">Edad</dt><dd className="text-gray-200">{perfil.edad} años</dd></div>
              )}
              {perfil.genero && (
                <div className="flex justify-between"><dt className="text-gray-500">Género</dt><dd className="text-gray-200">{perfil.genero}</dd></div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Trabaja</dt>
                <dd>{perfil.trabaja ? <span className="badge-amarillo">Sí</span> : <span className="badge-verde">No</span>}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Laptop</dt>
                <dd>{perfil.laptop ? <span className="badge-verde">Sí</span> : <span className="badge-rojo">No</span>}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Calificaciones */}
        {calificaciones && (
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Calificaciones</h2>
            <div className="space-y-3">
              {(
                [
                  ['1', 'acd1', 'ta1', 'pe1', 'ex1'],
                  ['2', 'acd2', 'ta2', 'pe2', 'ex2'],
                ] as const
              ).map(([ciclo, a, t, p, e]) => (
                <div key={ciclo}>
                  <p className="text-xs text-gray-500 mb-1">Ciclo {ciclo}</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {(
                      [
                        ['ACD', calificaciones[a as keyof Calificacion]],
                        ['TA',  calificaciones[t as keyof Calificacion]],
                        ['PE',  calificaciones[p as keyof Calificacion]],
                        ['EX',  calificaciones[e as keyof Calificacion]],
                      ] as [string, number][]
                    ).map(([label, val]) => (
                      <div key={label} className="bg-gray-800 rounded-lg py-2">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`font-mono font-bold text-sm ${val >= 7 ? 'text-emerald-400' : val >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {typeof val === 'number' ? val.toFixed(1) : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Asistencia historial */}
      <div className="card">
        <h2 className="font-semibold text-white mb-3">Historial de asistencia</h2>
        {totalSesiones === 0 ? (
          <p className="text-gray-500 text-sm">Sin registros de asistencia.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {asistencia.map(reg => (
              <div
                key={reg.id}
                title={`${reg.fecha} — ${reg.estado}${reg.atraso ? ' (Atraso)' : ''}`}
                className={`w-7 h-7 rounded flex items-center justify-center text-xs cursor-default
                  ${reg.estado === 'Presente'
                    ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800'
                    : reg.estado === 'Atraso'
                    ? 'bg-yellow-900/60 text-yellow-400 border border-yellow-800'
                    : 'bg-red-900/60 text-red-400 border border-red-800'}`}
              >
                {reg.estado === 'Presente' ? '●' : reg.estado === 'Atraso' ? '◑' : '○'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participación */}
      {participacion.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Participación</h2>
          <div className="space-y-2">
            {participacion.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                  {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold
                      ${n <= (p.nivel ?? 0) ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                      {n}
                    </div>
                  ))}
                </div>
                {p.observacion && <span className="text-xs text-gray-400">{p.observacion}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trabajos */}
      {trabajos.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Trabajos asignados</h2>
          <div className="space-y-3">
            {trabajos.map(trabajo => (
              <div key={trabajo.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                        {trabajo.tipo}
                      </span>
                      <span className={ESTADOS_COLOR[trabajo.estado] ?? 'badge-azul'}>{trabajo.estado}</span>
                    </div>
                    {trabajo.tema && <p className="font-medium text-gray-200 text-sm">{trabajo.tema}</p>}
                    {trabajo.descripcion && <p className="text-xs text-gray-500 mt-1">{trabajo.descripcion}</p>}
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">
                    {new Date(trabajo.fecha_asignacion + 'T12:00:00').toLocaleDateString('es-ES')}
                  </p>
                </div>
                {trabajo.observaciones_trabajo?.map(obs => (
                  <div key={obs.id} className="mt-2 pl-3 border-l border-gray-700 text-xs text-gray-400">
                    <span className="text-gray-600">{obs.fecha} — </span>{obs.observacion}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
