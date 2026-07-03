import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getResultadosEncuestaParcial, getDetalleEncuestaParcial } from '@/lib/actions/encuesta-parcial'
import { EncuestaParcialDetalleClient } from './encuesta-parcial-detail-client'
import { EncuestaTabsHeader } from '@/components/cursos/EncuestaTabsHeader'
import { LABELS_DIFICULTADES, colorProm } from '@/lib/encuesta-parcial-labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  const [resultados, detalle] = await Promise.all([
    getResultadosEncuestaParcial(cursoId),
    getDetalleEncuestaParcial(cursoId),
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <EncuestaTabsHeader
        cursoId={cursoId}
        active="progreso"
        title="Encuesta de Progreso"
        subtitle={curso.asignatura}
        aside={resultados && (
          <>
            <p className={`text-3xl font-bold ${kpiRespColor}`}>{resultados.porcentaje_respuesta}%</p>
            <p className="text-xs text-gray-500">de respuesta</p>
          </>
        )}
      />

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

          {/* Comparativas, temas relevantes y satisfacción → ver pestaña "Reporte" */}
          <div className="card flex items-center justify-between gap-3 bg-indigo-950/20 border-indigo-800/40">
            <p className="text-xs text-gray-400">
              Comparativas (uso de IA, autopercepción), satisfacción y temas/dificultades más frecuentes se muestran en la pestaña <span className="text-white font-medium">Reporte</span>.
            </p>
            <Link
              href={`/dashboard/cursos/${cursoId}/encuesta-parcial/reporte`}
              className="text-indigo-400 text-xs font-medium hover:text-indigo-300 whitespace-nowrap flex-shrink-0"
            >
              Ver Reporte →
            </Link>
          </div>

          {/* Tabla de detalle por estudiante — client component (colapsable) */}
          <EncuestaParcialDetalleClient detalle={detalle} />
        </>
      )}
    </div>
  )
}
