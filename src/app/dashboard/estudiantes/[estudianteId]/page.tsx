import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tables } from '@/types/database.types'

export const dynamic = 'force-dynamic'

type Estudiante    = Tables<'estudiantes'>
type Calificacion  = Tables<'calificaciones'>
type Asistencia    = Tables<'asistencia'>
type Participacion = Tables<'participacion'>
type Perfil        = Tables<'perfiles_estudiante'>
type Trabajo       = Tables<'trabajos_asignados'>
type Observacion   = Tables<'observaciones_trabajo'>
type Curso         = Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo' | 'periodo'> & { nombres_tareas?: any }

const ESTADO_RESERVA: Record<string, { label: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  confirmada:  { label: 'Confirmada',  color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  completada:  { label: 'Asistió',     color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800' },
  asistida:    { label: 'Asistió',     color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800' },
  'no_asistió':{ label: 'No asistió',  color: 'text-red-400 bg-red-900/30 border-red-800' },
  cancelado:   { label: 'Cancelada',   color: 'text-gray-400 bg-gray-800 border-gray-700' },
  cancelada:   { label: 'Cancelada',   color: 'text-gray-400 bg-gray-800 border-gray-700' },
}

const ESTADOS_TRABAJO: Record<string, string> = {
  'Pendiente':   'badge-amarillo',
  'En progreso': 'badge-azul',
  'Entregado':   'badge-verde',
  'Aprobado':    'badge-verde',
  'Reprobado':   'badge-rojo',
}

const DIAS: Record<number, string> = { 1:'Lun', 2:'Mar', 3:'Mié', 4:'Jue', 5:'Vie', 6:'Sáb' }

export default async function FichaEstudiantePage({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const estudianteRes = await db
    .from('estudiantes')
    .select('*, cursos(id, asignatura, codigo, periodo, nombres_tareas)')
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

  // Fetch tutorías reservas and encuesta_estudiante if student has an auth account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reservas: any[] = []
  let encuestaData: any = null
  if (estudiante.auth_user_id) {
    const [resVs, encVs] = await Promise.all([
      db.from('reservas')
        .select('id, fecha, estado, notas, horarios(dia_semana, hora_inicio, hora_fin)')
        .eq('auth_user_id', estudiante.auth_user_id)
        .order('fecha', { ascending: false })
        .limit(20),
      db.from('encuesta_estudiante')
        .select('modalidad_carrera, situacion_vivienda, es_foraneo')
        .eq('auth_user_id', estudiante.auth_user_id)
        .maybeSingle()
    ])
    reservas = resVs.data ?? []
    encuestaData = encVs.data ?? null
  }

  const calificaciones  = califRes.data as Calificacion | null
  const asistencia      = (asisRes.data ?? []) as Asistencia[]
  const participacion   = (partRes.data ?? []) as Participacion[]
  const trabajos        = (trabajosRes.data ?? []) as (Trabajo & { observaciones_trabajo: Observacion[] })[]
  const perfil          = perfilRes.data as Perfil | null

  // ── Asistencia stats ──────────────────────────────────────────────────────
  const totalSesiones   = asistencia.length
  const presentes       = asistencia.filter(r => r.estado === 'Presente').length
  const ausentes        = asistencia.filter(r => r.estado === 'Ausente').length
  const atrasos         = asistencia.filter(r => r.atraso).length
  const pctAsistencia   = totalSesiones > 0 ? Math.round((presentes / totalSesiones) * 100) : 0
  const horasAsistidas  = asistencia.reduce((s, r) => s + (r.horas ?? 0), 0)

  // ── Participación promedio ────────────────────────────────────────────────
  const promedioParticipacion = participacion.length > 0
    ? (participacion.reduce((s, p) => s + (p.nivel ?? 0), 0) / participacion.length).toFixed(1)
    : null

  // ── Promedio de notas ────────────────────────────────────────────────────
  let promedio: number | null = null
  let promedioC1: number | null = null
  let promedioC2: number | null = null
  if (calificaciones) {
    const c = calificaciones
    const anyC1 = [c.acd1, c.ta1, c.pe1, c.ex1].some(v => v != null && (v as number) > 0)
    const anyC2 = [c.acd2, c.ta2, c.pe2, c.ex2].some(v => v != null && (v as number) > 0)
    if (anyC1) {
      promedioC1 = Math.round(((c.acd1 ?? 0) * 0.3 + (c.ta1 ?? 0) * 0.1 + (c.pe1 ?? 0) * 0.2 + (c.ex1 ?? 0) * 0.4) * 10) / 10
    }
    if (anyC2) {
      promedioC2 = Math.round(((c.acd2 ?? 0) * 0.3 + (c.ta2 ?? 0) * 0.1 + (c.pe2 ?? 0) * 0.2 + (c.ex2 ?? 0) * 0.4) * 10) / 10
    }
    if (promedioC1 != null && promedioC2 != null) {
      promedio = Math.round(((promedioC1 + promedioC2) / 2) * 10) / 10
    } else if (promedioC1 != null) {
      promedio = promedioC1
    }
  }

  // ── Tutorías stats ────────────────────────────────────────────────────────
  const tutAsistidas  = reservas.filter(r => r.estado === 'completada' || r.estado === 'asistida' || r.estado === 'confirmada').length
  const tutNoAsistio  = reservas.filter(r => r.estado === 'no_asistió').length
  const tutPendientes = reservas.filter(r => r.estado === 'pendiente').length

  // ── Indicadores de riesgo ─────────────────────────────────────────────────
  const trabActivos   = trabajos.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso').length
  const enRiesgo      = (totalSesiones > 0 && pctAsistencia < 70) || (promedio != null && promedio < 5)
  const conAtencion   = !enRiesgo && ((totalSesiones > 0 && pctAsistencia < 80) || (promedio != null && promedio < 6))

  // ── Etiquetas de calificaciones ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nombresNota: string[] = (curso?.nombres_tareas as any) ?? ['ACD', 'TA', 'PE', 'EX']

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">

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
            {estudiante.tutoria && <span className="badge-azul">Citado a tutoría</span>}
            {enRiesgo && (
              <span className="text-xs font-semibold text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-full">
                En riesgo
              </span>
            )}
            {conAtencion && (
              <span className="text-xs font-semibold text-yellow-400 bg-yellow-950/60 border border-yellow-800 px-2 py-0.5 rounded-full">
                Atención
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">{estudiante.email}</p>
          {curso && (
            <p className="text-gray-500 text-xs mt-1">{curso.asignatura} · {curso.codigo} · {curso.periodo}</p>
          )}
        </div>
      </div>

      {/* Alerta de riesgo */}
      {(enRiesgo || conAtencion) && (
        <div className={`rounded-xl px-4 py-3 flex items-start gap-3 border ${
          enRiesgo
            ? 'bg-red-950/40 border-red-800'
            : 'bg-yellow-950/40 border-yellow-800'
        }`}>
          <span className="text-lg mt-0.5">{enRiesgo ? '🔴' : '🟡'}</span>
          <div>
            <p className={`text-sm font-medium ${enRiesgo ? 'text-red-300' : 'text-yellow-300'}`}>
              {enRiesgo ? 'Estudiante en riesgo académico' : 'Estudiante requiere atención'}
            </p>
            <p className={`text-xs mt-0.5 ${enRiesgo ? 'text-red-500' : 'text-yellow-600'}`}>
              {[
                totalSesiones > 0 && pctAsistencia < (enRiesgo ? 70 : 80) && `Asistencia ${pctAsistencia}%`,
                promedio != null && promedio < (enRiesgo ? 5 : 6) && `Promedio ${promedio}`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <div className="stat-card">
          <span className={`stat-value ${pctAsistencia >= 80 ? 'text-emerald-400' : pctAsistencia >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {totalSesiones > 0 ? `${pctAsistencia}%` : '—'}
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
          <span className={`stat-value ${promedio == null ? 'text-gray-500' : promedio >= 7 ? 'text-emerald-400' : promedio >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {promedio ?? '—'}
          </span>
          <span className="stat-label">Promedio</span>
        </div>
        <div className="stat-card">
          <span className={`stat-value ${trabActivos > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
            {trabActivos}
          </span>
          <span className="stat-label">Trab. activos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{horasAsistidas > 0 ? horasAsistidas : '—'}</span>
          <span className="stat-label">Horas asist.</span>
        </div>
      </div>

      {/* Perfil + Calificaciones */}
      <div className="grid md:grid-cols-2 gap-5">
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
              {encuestaData?.modalidad_carrera && (
                <div className="flex justify-between"><dt className="text-gray-500">Modalidad</dt><dd className="text-gray-200">{encuestaData.modalidad_carrera}</dd></div>
              )}
              {encuestaData?.situacion_vivienda && (
                <div className="flex justify-between"><dt className="text-gray-500">Vivienda</dt><dd className="text-gray-200">{encuestaData.situacion_vivienda}</dd></div>
              )}
              {encuestaData?.es_foraneo !== undefined && encuestaData?.es_foraneo !== null && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Foráneo</dt>
                  <dd>{encuestaData.es_foraneo ? <span className="badge-amarillo">Sí</span> : <span className="badge-verde">No</span>}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Calificaciones — siempre visible */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Calificaciones</h2>
            {promedio != null && (
              <span className={`text-sm font-bold ${promedio >= 7 ? 'text-emerald-400' : promedio >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                Prom. {promedio}
              </span>
            )}
          </div>
          {!calificaciones ? (
            <p className="text-gray-600 text-sm">Sin calificaciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {(
                [
                  ['1', 'acd1', 'ta1', 'pe1', 'ex1', promedioC1],
                  ['2', 'acd2', 'ta2', 'pe2', 'ex2', promedioC2],
                ] as const
              ).map(([ciclo, a, t, p, e, prom]) => (
                <div key={ciclo}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">Ciclo {ciclo}</p>
                    {prom != null && (
                      <p className={`text-xs font-semibold ${(prom as number) >= 7 ? 'text-emerald-400' : (prom as number) >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {prom}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {(
                      [
                        [nombresNota[0] ?? 'ACD', calificaciones[a as keyof Calificacion]],
                        [nombresNota[1] ?? 'TA',  calificaciones[t as keyof Calificacion]],
                        [nombresNota[2] ?? 'PE',  calificaciones[p as keyof Calificacion]],
                        [nombresNota[3] ?? 'EX',  calificaciones[e as keyof Calificacion]],
                      ] as [string, number | null][]
                    ).map(([label, val]) => (
                      <div key={label} className="bg-gray-800 rounded-lg py-2">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`font-mono font-bold text-sm ${
                          val == null ? 'text-gray-600'
                          : (val as number) >= 7 ? 'text-emerald-400'
                          : (val as number) >= 5 ? 'text-yellow-400'
                          : 'text-red-400'
                        }`}>
                          {val != null ? (val as number).toFixed(1) : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tutorías */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Tutorías</h2>
          {reservas.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-medium">{tutAsistidas} asistió</span>
              {tutNoAsistio > 0 && <span className="text-red-400 font-medium">{tutNoAsistio} no asistió</span>}
              {tutPendientes > 0 && <span className="text-yellow-400 font-medium">{tutPendientes} pendiente{tutPendientes !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>

        {!estudiante.auth_user_id ? (
          <p className="text-gray-600 text-sm">Estudiante sin cuenta vinculada — no puede reservar tutorías.</p>
        ) : reservas.length === 0 ? (
          <p className="text-gray-600 text-sm">Sin reservas de tutorías.</p>
        ) : (
          <div className="space-y-2">
            {reservas.map((r) => {
              const est = ESTADO_RESERVA[r.estado] ?? { label: r.estado, color: 'text-gray-400 bg-gray-800 border-gray-700' }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const h = r.horarios as any
              return (
                <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-medium">
                        {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      {h && (
                        <span className="text-xs text-gray-600">
                          {DIAS[h.dia_semana] ?? ''} {h.hora_inicio?.slice(0, 5)}–{h.hora_fin?.slice(0, 5)}
                        </span>
                      )}
                    </div>
                    {r.notas && <p className="text-xs text-gray-500 mt-0.5 truncate italic">&ldquo;{r.notas}&rdquo;</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${est.color}`}>
                    {est.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Asistencia historial */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Historial de asistencia</h2>
          {totalSesiones > 0 && (
            <span className="text-xs text-gray-500">{presentes}P · {atrasos}At · {ausentes}Au de {totalSesiones}</span>
          )}
        </div>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Participación</h2>
            {promedioParticipacion && (
              <span className="text-xs text-gray-400">Prom. {promedioParticipacion}</span>
            )}
          </div>
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
                      <span className={ESTADOS_TRABAJO[trabajo.estado ?? ''] ?? 'badge-azul'}>{trabajo.estado}</span>
                    </div>
                    {trabajo.tema && <p className="font-medium text-gray-200 text-sm">{trabajo.tema}</p>}
                    {trabajo.descripcion && <p className="text-xs text-gray-500 mt-1">{trabajo.descripcion}</p>}
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">
                    {new Date(trabajo.fecha_asignacion + 'T12:00:00').toLocaleDateString('es-ES')}
                  </p>
                </div>
                {trabajo.observaciones_trabajo?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {trabajo.observaciones_trabajo.map(obs => (
                      <div key={obs.id} className="pl-3 border-l border-gray-700 text-xs text-gray-400">
                        <span className="text-gray-600">{obs.fecha} — </span>{obs.observacion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
