import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getResultadosEncuestaParcial, getDetalleEncuestaParcial, getComparativaAutopercepcion } from '@/lib/actions/encuesta-parcial'
import { EncuestaParcialDetalleClient } from './encuesta-parcial-detail-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LABELS_DIFICULTADES: Record<string, string> = {
  comprension_temas: 'Dificultad para entender los temas',
  falta_tiempo: 'Falta de tiempo',
  carga_trabajo_externo: 'Trabajo/prácticas afectan el estudio',
  problemas_tecnologicos: 'Problemas de conectividad o equipo',
  dificultades_personales: 'Situación personal o familiar',
  carga_otras_materias: 'Carga académica alta',
  metodologia: 'No se adapta a la metodología',
  bajo_rendimiento: 'Bajo rendimiento previo',
  ninguna: 'Sin dificultades significativas',
}

const LABELS_IA: Record<string, string> = {
  comprension: 'Comprensión de texto',
  resumen: 'Resumir información',
  ideas: 'Generación de ideas',
  redaccion: 'Redacción',
  tareas: 'Resolución de tareas',
  verificacion: 'Verificación',
  critico: 'Análisis crítico',
  traduccion: 'Traducción',
  idiomas: 'Idiomas',
}

const DIMENSIONES = [
  {
    key: 'autopercepcion' as const,
    label: 'Autopercepción del estudiante',
    campos: [
      { key: 'autopercepcion_aprendizaje', label: 'Nivel de aprendizaje' },
      { key: 'esfuerzo_dedicado', label: 'Esfuerzo dedicado' },
      { key: 'comprension_temas_propia', label: 'Comprensión de temas' },
      { key: 'preparacion_evaluacion', label: 'Preparación para evaluaciones' },
      { key: 'cumplimiento_entregas', label: 'Cumplimiento de entregas' },
    ],
  },
  {
    key: 'carrera' as const,
    label: 'Percepción sobre la carrera',
    campos: [
      { key: 'carrera_sigue_deseada', label: '¿Sigue deseando esta carrera?' },
    ],
  },
  {
    key: 'relevancia' as const,
    label: 'Relevancia profesional de la asignatura',
    campos: [
      { key: 'utilidad_profesional', label: 'Utilidad profesional' },
      { key: 'aplicacion_practica', label: 'Aplicación práctica' },
      { key: 'actualidad_contenidos', label: 'Actualidad de contenidos' },
      { key: 'motivacion_post_curso', label: 'Motivación para continuar' },
    ],
  },
  {
    key: 'contenido' as const,
    label: 'Contenido y metodología',
    campos: [
      { key: 'claridad_explicaciones', label: 'Claridad de explicaciones' },
      { key: 'pertinencia_tareas', label: 'Pertinencia de tareas' },
      { key: 'claridad_instrucciones', label: 'Claridad de instrucciones' },
      { key: 'ritmo_clase', label: 'Ritmo de clase' },
      { key: 'calidad_recursos', label: 'Calidad de recursos' },
    ],
  },
  {
    key: 'evaluacion' as const,
    label: 'Evaluación',
    campos: [
      { key: 'justicia_evaluacion', label: 'Justicia en la evaluación' },
      { key: 'retroalimentacion_recibida', label: 'Retroalimentación recibida' },
    ],
  },
  {
    key: 'docente' as const,
    label: 'Puntualidad, trato, dominio, estrategias, disponibilidad',
    campos: [
      { key: 'puntualidad_docente', label: 'Puntualidad' },
      { key: 'trato_docente', label: 'Trato al estudiante' },
      { key: 'dominio_tema', label: 'Dominio del tema' },
      { key: 'estrategias_didacticas', label: 'Estrategias didácticas' },
      { key: 'disponibilidad_docente', label: 'Disponibilidad' },
    ],
  },
  {
    key: 'tutorias' as const,
    label: 'Tutorías',
    campos: [
      { key: 'satisfaccion_tutorias', label: 'Satisfacción con tutorías' },
      { key: 'facilidad_reserva_tutoria', label: 'Facilidad de reserva' },
    ],
  },
]

// Agrupación de alto nivel: separa visualmente qué es del ESTUDIANTE,
// qué es del CURSO y qué es evaluación específica al DOCENTE — pedido
// explícito del profesor tras confundir "feedback curso" con "docente".
const GRUPOS = [
  {
    titulo: 'Estudiante — autopercepción y carrera',
    icono: '🎓',
    color: 'border-indigo-800/50',
    dims: ['autopercepcion', 'carrera'] as const,
  },
  {
    titulo: 'Curso — relevancia, contenido y evaluación',
    icono: '📘',
    color: 'border-teal-800/50',
    dims: ['relevancia', 'contenido', 'evaluacion'] as const,
  },
  {
    titulo: 'Evaluación al Docente',
    icono: '👨‍🏫',
    color: 'border-amber-800/50',
    dims: ['docente'] as const,
  },
  {
    titulo: 'Tutorías',
    icono: '🗓️',
    color: 'border-violet-800/50',
    dims: ['tutorias'] as const,
  },
]

function colorProm(v: number | null): string {
  if (v === null) return 'text-gray-500'
  if (v <= 2.5) return 'text-red-400'
  if (v <= 3.5) return 'text-amber-400'
  return 'text-emerald-400'
}

function barColor(v: number | null): string {
  if (v === null) return 'bg-gray-700'
  if (v <= 2.5) return 'bg-red-500'
  if (v <= 3.5) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function promDimension(obj: Record<string, number | null>): number | null {
  const vals = Object.values(obj).filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EncuestaParcialProfesorPage({
  params,
}: {
  params: Promise<{ cursoId: string }>
}) {
  const { cursoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: curso } = await db
    .from('cursos')
    .select('asignatura, encuesta_parcial_habilitada')
    .eq('id', cursoId)
    .eq('profesor_id', user.id)
    .single()

  if (!curso) redirect('/dashboard/cursos')

  const [resultados, detalle, comparativaAuto] = await Promise.all([
    getResultadosEncuestaParcial(cursoId),
    getDetalleEncuestaParcial(cursoId),
    getComparativaAutopercepcion(cursoId),
  ])

  const sinRespuestas = !resultados || resultados.total_respondieron === 0

  // KPI semáforo respuesta
  const pctResp = resultados?.porcentaje_respuesta ?? 0
  const kpiRespColor = pctResp >= 75 ? 'text-emerald-400' : pctResp >= 40 ? 'text-amber-400' : 'text-red-400'

  // Promedio general (media de todos los promedios de todas las dimensiones)
  let promGeneral: number | null = null
  if (resultados) {
    const todos: number[] = []
    for (const dim of DIMENSIONES) {
      const obj = resultados.promedios[dim.key]
      if (obj) {
        Object.values(obj).forEach(v => { if (v !== null) todos.push(v) })
      }
    }
    if (todos.length > 0) {
      promGeneral = Math.round(todos.reduce((a, b) => a + b, 0) / todos.length * 10) / 10
    }
  }

  // Dificultad más frecuente
  let dificultadFrecuente: string | null = null
  if (resultados?.distribucion_dificultades) {
    const entries = Object.entries(resultados.distribucion_dificultades)
      .filter(([k]) => k !== 'ninguna')
      .sort((a, b) => b[1] - a[1])
    if (entries.length > 0) {
      dificultadFrecuente = LABELS_DIFICULTADES[entries[0][0]] ?? entries[0][0]
    }
  }

  // Max para barras de dificultades
  const maxDific = resultados?.distribucion_dificultades
    ? Math.max(...Object.values(resultados.distribucion_dificultades), 1)
    : 1

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/cursos/${cursoId}`}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al curso
          </Link>
          <h1 className="text-2xl font-bold text-white">Encuesta de Progreso</h1>
          <p className="text-gray-400 text-sm mt-0.5">{curso.asignatura}</p>
        </div>
        {resultados && (
          <div className="text-right flex-shrink-0">
            <p className={`text-3xl font-bold ${kpiRespColor}`}>{resultados.porcentaje_respuesta}%</p>
            <p className="text-xs text-gray-500">de respuesta</p>
          </div>
        )}
      </div>

      {/* Tabs — mismo espacio que la encuesta inicial */}
      <div className="flex gap-2 border-b border-gray-800">
        <Link
          href={`/dashboard/cursos/${cursoId}/encuesta`}
          className="px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Encuesta Inicial
        </Link>
        <span className="px-3 py-2 text-sm font-medium text-white border-b-2 border-indigo-500">
          Encuesta de Progreso
        </span>
      </div>

      {/* Sin respuestas */}
      {sinRespuestas && (
        <div className="card text-center py-12 space-y-2">
          <p className="text-4xl">📋</p>
          <p className="text-gray-300 font-medium">Aún no hay respuestas</p>
          <p className="text-gray-500 text-sm">La encuesta se activa al 50% del curso.</p>
        </div>
      )}

      {/* KPI cards */}
      {resultados && !sinRespuestas && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card">
              <span className={`stat-value ${kpiRespColor}`}>
                {resultados.total_respondieron}/{resultados.total_activos}
              </span>
              <span className="stat-label">Respondieron</span>
            </div>
            <div className="stat-card">
              <span className={`stat-value ${colorProm(promGeneral)}`}>
                {promGeneral ?? '—'}
              </span>
              <span className="stat-label">Promedio general</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{resultados.cambios_situacion}</span>
              <span className="stat-label">Cambios de situación</span>
            </div>
            <div className="stat-card">
              <span className="stat-value text-sm text-amber-400 leading-tight">
                {dificultadFrecuente ?? '—'}
              </span>
              <span className="stat-label">Dificultad frecuente</span>
            </div>
          </div>

          {/* Dimensiones — agrupadas por Estudiante / Curso / Docente / Tutorías */}
          <div className="space-y-6">
            {GRUPOS.map(grupo => {
              const dimsDelGrupo = DIMENSIONES.filter(d => (grupo.dims as readonly string[]).includes(d.key))
              const todosValoresGrupo: number[] = []
              for (const dim of dimsDelGrupo) {
                const obj = resultados.promedios[dim.key]
                if (obj) Object.values(obj).forEach(v => { if (v !== null) todosValoresGrupo.push(v as number) })
              }
              const promGrupo = todosValoresGrupo.length > 0
                ? Math.round(todosValoresGrupo.reduce((a, b) => a + b, 0) / todosValoresGrupo.length * 10) / 10
                : null

              return (
                <div key={grupo.titulo} className={`space-y-3 border-l-2 pl-4 ${grupo.color}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{grupo.icono}</span> {grupo.titulo}
                    </h2>
                    {promGrupo !== null && (
                      <span className={`text-sm font-bold ${colorProm(promGrupo)}`}>{promGrupo}/5</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {dimsDelGrupo.map(dim => {
                      const obj = resultados.promedios[dim.key]
                      if (!obj) return null
                      const promDim = promDimension(obj as Record<string, number | null>)
                      return (
                        <div key={dim.key} className="card space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-200 text-sm">{dim.label}</h3>
                            {promDim !== null && (
                              <span className={`text-sm font-bold ${colorProm(promDim)}`}>{promDim}/5</span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {dim.campos.map(campo => {
                              const val = (obj as Record<string, number | null>)[campo.key] ?? null
                              return (
                                <div key={campo.key} className="flex items-center gap-3">
                                  <span className={`text-xs w-48 flex-shrink-0 ${val !== null && val <= 2.5 ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                                    {campo.label}
                                  </span>
                                  <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-0">
                                    <div
                                      className={`h-1.5 rounded-full transition-all ${barColor(val)}`}
                                      style={{ width: val !== null ? `${(val / 5) * 100}%` : '0%' }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium w-8 text-right flex-shrink-0 ${colorProm(val)}`}>
                                    {val ?? '—'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Comparativa uso IA */}
          {resultados.comparativa_ia && Object.values(resultados.comparativa_ia).some(v => v.anterior !== null || v.actual !== null) && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-200 text-sm">Comparativa uso de IA</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 font-medium">Dimensión</th>
                      <th className="text-center pb-2 font-medium w-24">Inicio</th>
                      <th className="text-center pb-2 font-medium w-8"></th>
                      <th className="text-center pb-2 font-medium w-24">Ahora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {Object.entries(resultados.comparativa_ia).map(([k, vals]) => {
                      const diff = vals.anterior !== null && vals.actual !== null
                        ? vals.actual - vals.anterior
                        : null
                      return (
                        <tr key={k} className="py-1">
                          <td className="py-1.5 text-gray-400">{LABELS_IA[k] ?? k}</td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium ${colorProm(vals.anterior)}`}>
                              {vals.anterior ?? '—'}
                            </span>
                          </td>
                          <td className="py-1.5 text-center">
                            {diff === null ? (
                              <span className="text-gray-600">=</span>
                            ) : diff > 0.1 ? (
                              <span className="text-emerald-400">↑</span>
                            ) : diff < -0.1 ? (
                              <span className="text-red-400">↓</span>
                            ) : (
                              <span className="text-gray-500">=</span>
                            )}
                          </td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium ${colorProm(vals.actual)}`}>
                              {vals.actual ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comparativa Autopercepción — Inicial vs Parcial */}
          {comparativaAuto && comparativaAuto.campos.length > 0 && (
            <div className="card space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-200 text-sm">Autopercepción Lingüística — Evolución</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Object.values(comparativaAuto.inicial).some(v => v !== null)
                      ? 'Encuesta inicial → Encuesta de progreso (mitad del curso)'
                      : 'Solo datos de encuesta de progreso — no hay datos iniciales para comparar'}
                  </p>
                </div>
                <span className="text-xs bg-indigo-900/30 text-indigo-400 border border-indigo-800/40 px-2 py-0.5 rounded-full flex-shrink-0">KEYHOLE</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 font-medium">Dimensión</th>
                      <th className="text-center pb-2 font-medium w-20">Inicial</th>
                      <th className="text-center pb-2 font-medium w-8"></th>
                      <th className="text-center pb-2 font-medium w-20">Parcial</th>
                      <th className="text-center pb-2 font-medium w-16">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {comparativaAuto.campos.map(({ key, label }) => {
                      const ini = comparativaAuto.inicial[key]
                      const par = comparativaAuto.parcial[key]
                      const diff = ini !== null && par !== null ? Math.round((par - ini) * 10) / 10 : null
                      return (
                        <tr key={key} className="py-1">
                          <td className="py-1.5 text-gray-400">{label}</td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium ${ini !== null && ini <= 2.5 ? 'text-red-400' : ini !== null && ini <= 3.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {ini ?? <span className="text-gray-600">—</span>}
                            </span>
                          </td>
                          <td className="py-1.5 text-center">
                            {diff === null ? (
                              <span className="text-gray-600">=</span>
                            ) : diff > 0.1 ? (
                              <span className="text-emerald-400">↑</span>
                            ) : diff < -0.1 ? (
                              <span className="text-red-400">↓</span>
                            ) : (
                              <span className="text-gray-500">=</span>
                            )}
                          </td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium ${par !== null && par <= 2.5 ? 'text-red-400' : par !== null && par <= 3.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {par ?? <span className="text-gray-600">—</span>}
                            </span>
                          </td>
                          <td className="py-1.5 text-center">
                            {diff !== null ? (
                              <span className={`font-mono text-xs font-bold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Distribución de dificultades */}
          {resultados.distribucion_dificultades && Object.keys(resultados.distribucion_dificultades).length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-200 text-sm">Distribución de dificultades</h3>
              <div className="space-y-2">
                {Object.entries(resultados.distribucion_dificultades)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-52 flex-shrink-0">
                        {LABELS_DIFICULTADES[key] ?? key}
                      </span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${key === 'ninguna' ? 'bg-emerald-600' : 'bg-amber-600'}`}
                          style={{ width: `${(count / maxDific) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tabla de detalle por estudiante — client component (colapsable) */}
          <EncuestaParcialDetalleClient detalle={detalle} />
        </>
      )}
    </div>
  )
}
