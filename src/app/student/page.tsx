import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'
import { MisGrupos } from '@/components/student/MisGrupos'
import { AutodiagnosticoWidget } from '@/components/student/AutodiagnosticoWidget'
import { MiProgreso } from '@/components/student/MiProgreso'
import { RetroalimentacionWidget } from '@/components/student/RetroalimentacionWidget'
import { RegistrosCurso } from '@/components/student/RegistrosCurso'
import { getGruposAbiertosParaEstudiante } from '@/lib/actions/grupos'
import { getEstadoEncuestasParciales } from '@/lib/actions/encuesta-parcial'
import { getRegistrosActivosParaEstudiante } from '@/lib/actions/registros-trabajo'

type Estudiante = Tables<'estudiantes'>
type Curso = Tables<'cursos'>
type Trabajo = Tables<'trabajos_asignados'> & { urgente?: boolean | null }
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
  const [cursosRes, trabajosRes, asistenciaRes, reservasRes, gruposData, horasTutoriaRes, estadoEncuestas, registrosData] = await Promise.all([
    db.from('cursos').select('*, encuesta_parcial_habilitada').in('id', cursoIds),
    db.from('trabajos_asignados').select('*').in('estudiante_id', estudianteIds).order('fecha_asignacion', { ascending: false }),
    db.from('asistencia').select('estado, estudiante_id').in('estudiante_id', estudianteIds),
    db.from('reservas').select('*, horarios!inner(profesor_id)').eq('auth_user_id', user.id).eq('estado', 'completada').order('fecha', { ascending: false }),
    getGruposAbiertosParaEstudiante(cursoIds),
    db.from('tutor_horas_semana').select('curso_id, fecha_semana, horas').in('curso_id', cursoIds),
    getEstadoEncuestasParciales(cursoIds),
    getRegistrosActivosParaEstudiante(cursoIds),
  ])

  const cursos: Curso[] = cursosRes.data ?? []
  const trabajos: Trabajo[] = trabajosRes.data ?? []
  const asistenciaReg: (Asistencia & { estudiante_id: string })[] = asistenciaRes.data ?? []
  const reservasReg: any[] = reservasRes.data ?? []
  const estadoEncuestasParciales: Record<string, boolean> = estadoEncuestas ?? {}
  const { registros: registrosActivos, misEnvios } = registrosData

  // Horas de tutoría ofrecidas por curso
  const horasTutoria: { curso_id: string; fecha_semana: string; horas: number }[] = horasTutoriaRes.data ?? []
  const horasTutoriaPorCurso = cursoIds.reduce((acc, cid) => {
    const filas = horasTutoria.filter(h => h.curso_id === cid)
    acc[cid] = { totalHoras: filas.reduce((s, f) => s + f.horas, 0), semanas: filas.length }
    return acc
  }, {} as Record<string, { totalHoras: number; semanas: number }>)

  // Helper: ¿debe ver encuesta parcial?
  function debeVerEncuesta(curso: { fecha_inicio: string | null; fecha_fin: string | null; encuesta_parcial_habilitada?: boolean | null }): boolean {
    if (!curso.encuesta_parcial_habilitada || !curso.fecha_inicio || !curso.fecha_fin) return false
    const inicio = new Date(curso.fecha_inicio).getTime()
    const fin = new Date(curso.fecha_fin).getTime()
    const pct = (Date.now() - inicio) / (fin - inicio)
    return pct >= 0.5 && pct <= 1.0
  }

  // Mapas
  const cursosMap = Object.fromEntries(cursos.map(c => [c.id, c]))
  const trabajosPorEstudiante = new Map<string, Trabajo[]>()
  for (const t of trabajos) {
    if (!trabajosPorEstudiante.has(t.estudiante_id)) trabajosPorEstudiante.set(t.estudiante_id, [])
    trabajosPorEstudiante.get(t.estudiante_id)!.push(t)
  }

  // Separar cursos activos vs finalizados
  const estudiantesActivos = estudiantes.filter(est => {
    const c = cursosMap[est.curso_id] as any
    return !c || !c.estado || c.estado === 'activo'
  })
  const estudiantesFinalizados = estudiantes.filter(est => {
    const c = cursosMap[est.curso_id] as any
    return c && (c.estado === 'finalizado' || c.estado === 'archivado')
  })
  const soloFinalizados = estudiantesActivos.length === 0 && estudiantesFinalizados.length > 0

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

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/student/tutorias"
          className="card flex flex-col items-center justify-center py-4 hover:border-brand-600/50 transition-colors group">
          <svg className="w-6 h-6 text-brand-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-200 group-hover:text-white">Agendar Tutoría</span>
        </Link>
        <Link href="/student/perfil"
          className="card flex flex-col items-center justify-center py-4 hover:border-brand-600/50 transition-colors group">
          <svg className="w-6 h-6 text-brand-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-medium text-gray-200 group-hover:text-white">Mi Perfil</span>
        </Link>
        <Link href="/student/evidencias"
          className="card flex flex-col items-center justify-center py-4 hover:border-brand-600/50 transition-colors group col-span-2">
          <svg className="w-6 h-6 text-brand-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-200 group-hover:text-white">Armar Evidencias PDF</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Sube archivos y genera tu portafolio</span>
        </Link>
      </div>

      {/* Grupos de clase (afinidad) */}
      {gruposData.grupos.length > 0 && (
        <MisGrupos
          cursoIds={cursoIds}
          cursosMap={Object.fromEntries(cursos.map(c => [c.id, c.asignatura]))}
          gruposIniciales={gruposData.grupos}
          misMembresiasIniciales={gruposData.misMembresias}
          estudiantesByCurso={gruposData.estudiantesByCurso}
        />
      )}

      {/* Encuestas */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Encuestas</h2>
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-900/20 border border-emerald-800">
          <div>
            <p className="text-sm font-medium text-emerald-300">✓ Ficha inicial completada</p>
            <p className="text-xs text-gray-500 mt-0.5">Tus datos han sido registrados</p>
          </div>
        </div>
        {cursos.map(curso => {
          const respondio = estadoEncuestasParciales[curso.id]
          if (respondio) {
            return (
              <div key={`ep-${curso.id}`} className="flex items-center justify-between p-3 rounded-lg bg-emerald-900/20 border border-emerald-800">
                <div>
                  <p className="text-sm font-medium text-emerald-300">✓ Encuesta de progreso completada</p>
                  <p className="text-xs text-gray-500 mt-0.5">{curso.asignatura}</p>
                </div>
              </div>
            )
          }
          if (debeVerEncuesta(curso as any)) {
            return (
              <Link key={`ep-${curso.id}`} href={`/student/encuesta-parcial/${curso.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-900/20 border border-amber-700 hover:border-amber-500 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-amber-300 group-hover:text-amber-200">Encuesta de progreso pendiente</p>
                  <p className="text-xs text-gray-500 mt-0.5">{curso.asignatura} · ~5 min</p>
                </div>
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          }
          return null
        })}
      </div>

      {/* Banner período completado */}
      {soloFinalizados && (
        <div className="card border-emerald-800/40 bg-emerald-950/20 text-center py-8 space-y-3">
          <div className="text-4xl">🎓</div>
          <div>
            <p className="font-semibold text-emerald-300 mb-1">¡Período completado!</p>
            <p className="text-sm text-gray-400">Tus cursos de este período han finalizado. Aquí tienes tu historial.</p>
          </div>
          <Link href="/student/evidencias" className="btn-primary text-sm inline-flex items-center gap-2 mx-auto">
            Armar evidencias PDF
          </Link>
        </div>
      )}

      {/* Tarjeta por cada curso activo */}
      {estudiantesActivos.map(est => {
        const curso = cursosMap[est.curso_id]
        if (!curso) return null

        const ts = trabajosPorEstudiante.get(est.id) ?? []
        const activos = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso')
        const completados = ts.filter(t => t.estado === 'Aprobado' || t.estado === 'Entregado').length
        const trabajosTotal = ts.length
        const regAsis = asistenciaReg.filter(r => r.estudiante_id === est.id)
        const presentes = regAsis.filter(r => r.estado === 'Presente').length
        const pctAsistencia = regAsis.length > 0 ? Math.round(presentes / regAsis.length * 100) : null
        const misReservas = reservasReg.filter(r => r.horarios?.profesor_id === curso.profesor_id)
        const tutoriasAsistidas = misReservas.filter(r => r.asistio).length
        const tutoriasFaltadas = misReservas.filter(r => r.asistio === false).length
        const statTutoria = horasTutoriaPorCurso[est.curso_id]

        return (
          <div key={est.id} className="card space-y-4">
            {/* Curso header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{curso.codigo}</span>
                <h2 className="text-lg font-semibold text-white mt-1">{curso.asignatura}</h2>
                <p className="text-xs text-gray-500">{curso.periodo}</p>
                {(curso as any).aula && (
                  <p className="text-xs text-gray-400 mt-0.5">📍 {(curso as any).aula}</p>
                )}
              </div>
              {pctAsistencia !== null && (
                <div className="text-right">
                  <p className={`text-xl font-bold ${pctAsistencia >= 80 ? 'text-emerald-400' : pctAsistencia >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pctAsistencia}%
                  </p>
                  <p className="text-xs text-gray-500">Asistencia est.</p>
                  <p className="text-[9px] text-gray-600 leading-tight mt-0.5 max-w-[88px]">puede diferir del<br/>registro oficial</p>
                </div>
              )}
            </div>

            {/* Horas de tutoría ofrecidas por el profesor */}
            {statTutoria && statTutoria.totalHoras > 0 && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-teal-900/20 border border-teal-800/40 rounded-lg">
                <span className="text-teal-400 text-lg">🕐</span>
                <div>
                  <p className="text-sm text-teal-300 font-medium">
                    {statTutoria.totalHoras % 1 === 0 ? statTutoria.totalHoras : statTutoria.totalHoras.toFixed(1)} h de tutoría ofrecidas
                  </p>
                  <p className="text-xs text-gray-500">
                    en {statTutoria.semanas} {statTutoria.semanas === 1 ? 'semana' : 'semanas'} del curso
                  </p>
                </div>
              </div>
            )}

            {/* Tutoría */}
            {est.tutoria && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-800 rounded-lg">
                <span className="text-blue-400">📅</span>
                <p className="text-sm text-blue-300 font-medium">Estás citado a tutoría</p>
              </div>
            )}
            
            {/* Historial de Tutorías */}
            {misReservas.length > 0 && (
              <div className="flex gap-2 text-xs">
                {tutoriasAsistidas > 0 && (
                  <span className="bg-emerald-900/30 border border-emerald-800 text-emerald-400 px-2 py-1 rounded">
                    Tutorías asistidas: <span className="font-bold">{tutoriasAsistidas}</span>
                  </span>
                )}
                {tutoriasFaltadas > 0 && (
                  <span className="bg-red-900/30 border border-red-800 text-red-400 px-2 py-1 rounded">
                    Tutorías faltadas: <span className="font-bold">{tutoriasFaltadas}</span>
                  </span>
                )}
              </div>
            )}

            {/* Registros de trabajo activos */}
            <RegistrosCurso
              cursoId={est.curso_id}
              estudianteId={est.id}
              registros={registrosActivos.filter(r => r.curso_id === est.curso_id)}
              misEnvios={misEnvios}
            />

            {/* Trabajos activos */}
            {activos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2">Trabajos activos ({activos.length})</p>
                <div className="space-y-3">
                  {activos.map(t => (
                    <div key={t.id} className="py-2 border-b border-gray-800 last:border-0 border-l-2 pl-3 border-l-brand-600">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded-full">{t.tipo}</span>
                            {t.urgente && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border border-red-500/50 bg-red-950/60 text-red-500">
                                URGENTE
                              </span>
                            )}
                          </div>
                          {t.tema
                            ? <p className="text-sm font-medium text-gray-100 leading-snug line-clamp-2">{t.tema}</p>
                            : <p className="text-sm font-medium text-gray-500 italic">Sin título asignado</p>
                          }
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${ESTADO_TRABAJO_COLOR[t.estado] ?? ''}`}>
                          {t.estado}
                        </span>
                      </div>

                      {t.descripcion && <p className="text-xs text-gray-500 line-clamp-2 italic mt-0.5"><span className="text-gray-600">Instr:</span> {t.descripcion}</p>}
                      
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-semibold tracking-wide uppercase text-gray-500">Mi Progreso</span>
                          <span className="text-[10px] font-bold text-brand-400">{t.progreso ?? 0}%</span>
                        </div>
                        <div className="w-full bg-gray-900 border border-gray-800 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${t.progreso < 34 ? 'bg-red-500' : t.progreso < 67 ? 'bg-yellow-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${t.progreso ?? 0}%` }}
                          ></div>
                        </div>
                      </div>
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
                    <div key={t.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-gray-800/40 rounded transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-xs font-medium line-clamp-1">{t.tema || t.tipo}</p>
                        {t.tema && <p className="text-gray-600 text-[10px]">{t.tipo}</p>}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${ESTADO_TRABAJO_COLOR[t.estado] ?? ''}`}>{t.estado}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {ts.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">Sin trabajos asignados</p>
            )}

            {/* Mi Progreso longitudinal */}
            <MiProgreso
              asignatura={curso.asignatura}
              pctAsistencia={pctAsistencia}
              trabajosCompletados={completados}
              trabajosActivos={activos.length}
              trabajosTotal={trabajosTotal}
              tutoriasAsistidas={tutoriasAsistidas}
              tutoriasFaltadas={tutoriasFaltadas}
            />

            {/* Autodiagnóstico IA */}
            <AutodiagnosticoWidget
              asignatura={curso.asignatura}
              pctAsistencia={pctAsistencia}
              trabajosActivos={activos.length}
              trabajosCompletados={completados}
              tutoriasAsistidas={tutoriasAsistidas}
              tutoriasFaltadas={tutoriasFaltadas}
            />

            {/* Retroalimentación formativa IA */}
            <RetroalimentacionWidget
              asignatura={curso.asignatura}
              pctAsistencia={pctAsistencia}
              trabajosCompletados={completados}
              trabajosActivos={activos.length}
              trabajosTotal={trabajosTotal}
              tutoriasAsistidas={tutoriasAsistidas}
              tutoriasFaltadas={tutoriasFaltadas}
            />
          </div>
        )
      })}

      {/* Tarjetas de cursos finalizados (historial de solo lectura) */}
      {estudiantesFinalizados.length > 0 && (
        <details className="group" open={soloFinalizados}>
          <summary className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 cursor-pointer select-none mb-3 list-none">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Períodos anteriores ({estudiantesFinalizados.length})
          </summary>
          {estudiantesFinalizados.map(est => {
            const curso = cursosMap[est.curso_id]
            if (!curso) return null
            const regAsis = asistenciaReg.filter(r => r.estudiante_id === est.id)
            const presentes = regAsis.filter(r => r.estado === 'Presente').length
            const pctAsistencia = regAsis.length > 0 ? Math.round(presentes / regAsis.length * 100) : null
            const misReservas = reservasReg.filter(r => r.horarios?.profesor_id === curso.profesor_id)
            const tutoriasAsistidas = misReservas.filter(r => r.asistio).length
            const ts = trabajosPorEstudiante.get(est.id) ?? []
            const completados = ts.filter(t => t.estado === 'Aprobado' || t.estado === 'Entregado').length
            const cursoAny = curso as any
            return (
              <div key={est.id} className="card opacity-70 space-y-3 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{curso.codigo}</span>
                    <h2 className="text-base font-semibold text-gray-400 mt-1">{curso.asignatura}</h2>
                    <p className="text-xs text-gray-600">{curso.periodo}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 mt-1">
                    {(cursoAny).estado === 'archivado' ? 'Archivado' : 'Finalizado'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {pctAsistencia !== null && (
                    <span className="text-gray-500">Asistencia: <span className="font-semibold text-gray-400">{pctAsistencia}%</span></span>
                  )}
                  {tutoriasAsistidas > 0 && (
                    <span className="text-gray-500">Tutorías: <span className="font-semibold text-gray-400">{tutoriasAsistidas}</span></span>
                  )}
                  {completados > 0 && (
                    <span className="text-gray-500">Trabajos aprobados: <span className="font-semibold text-gray-400">{completados}</span></span>
                  )}
                </div>
                {cursoAny.link_publicacion && (
                  <a
                    href={cursoAny.link_publicacion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ver publicación del curso
                  </a>
                )}
              </div>
            )
          })}
        </details>
      )}
    </div>
  )
}
