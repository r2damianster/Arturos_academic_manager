import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getResultadosEncuestaParcial, getDetalleEncuestaParcial, getComparativaAutopercepcion } from '@/lib/actions/encuesta-parcial'
import { EncuestaTabsHeader } from '@/components/cursos/EncuestaTabsHeader'
import { LABELS_DIFICULTADES, LABELS_IA, colorProm } from '@/lib/encuesta-parcial-labels'

function promedioClaves(obj: Record<string, number | null> | undefined, keys: string[]): number | null {
  if (!obj) return null
  const vals = keys.map(k => obj[k]).filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

export default async function ReporteEncuestaParcialPage({
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

  const pctResp = resultados?.porcentaje_respuesta ?? 0
  const kpiRespColor = pctResp >= 75 ? 'text-emerald-400' : pctResp >= 40 ? 'text-amber-400' : 'text-red-400'

  // Satisfacción = docente + tutorías + evaluación (lo que el estudiante opina del servicio recibido,
  // separado de autopercepción/carrera que son sobre el propio estudiante)
  const satDocente = promedioClaves(resultados?.promedios.docente, ['puntualidad_docente', 'trato_docente', 'dominio_tema', 'estrategias_didacticas', 'disponibilidad_docente'])
  const satEvaluacion = promedioClaves(resultados?.promedios.evaluacion, ['justicia_evaluacion', 'retroalimentacion_recibida'])
  const satTutorias = promedioClaves(resultados?.promedios.tutorias, ['satisfaccion_tutorias', 'facilidad_reserva_tutoria'])
  const satGlobalVals = [satDocente, satEvaluacion, satTutorias].filter((v): v is number => v !== null)
  const satGlobal = satGlobalVals.length > 0
    ? Math.round(satGlobalVals.reduce((a, b) => a + b, 0) / satGlobalVals.length * 10) / 10
    : null

  // Max para barras de dificultades
  const maxDific = resultados?.distribucion_dificultades
    ? Math.max(...Object.values(resultados.distribucion_dificultades), 1)
    : 1

  // Comentarios de estudiantes — testimonios de satisfacción (fortalezas/sugerencias)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comentarios = (detalle as any[])
    .filter(e => e.fortalezas_curso || e.sugerencias_mejora)
    .map(e => ({
      nombre: e.estudiantes?.nombre ?? 'Estudiante',
      fortalezas: e.fortalezas_curso as string | null,
      sugerencias: e.sugerencias_mejora as string | null,
    }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <EncuestaTabsHeader
        cursoId={cursoId}
        active="reporte"
        title="Reporte de Progreso"
        subtitle={curso.asignatura}
        aside={resultados && (
          <>
            <p className={`text-3xl font-bold ${kpiRespColor}`}>{resultados.porcentaje_respuesta}%</p>
            <p className="text-xs text-gray-500">de respuesta</p>
          </>
        )}
      />

      {sinRespuestas && (
        <div className="card text-center py-12 space-y-2">
          <p className="text-4xl">📋</p>
          <p className="text-gray-300 font-medium">Aún no hay respuestas</p>
          <p className="text-gray-500 text-sm">La encuesta se activa al 50% del curso.</p>
        </div>
      )}

      {resultados && !sinRespuestas && (
        <>
          {/* Satisfacción */}
          <div className="space-y-3 border-l-2 pl-4 border-amber-800/50">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>⭐</span> Satisfacción
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <span className={`stat-value ${colorProm(satGlobal)}`}>{satGlobal ?? '—'}</span>
                <span className="stat-label">Satisfacción global</span>
              </div>
              <div className="stat-card">
                <span className={`stat-value ${colorProm(satDocente)}`}>{satDocente ?? '—'}</span>
                <span className="stat-label">Docente</span>
              </div>
              <div className="stat-card">
                <span className={`stat-value ${colorProm(satEvaluacion)}`}>{satEvaluacion ?? '—'}</span>
                <span className="stat-label">Evaluación</span>
              </div>
              <div className="stat-card">
                <span className={`stat-value ${colorProm(satTutorias)}`}>{satTutorias ?? '—'}</span>
                <span className="stat-label">Tutorías</span>
              </div>
            </div>
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
                            <span className={`font-medium ${colorProm(ini)}`}>
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
                            <span className={`font-medium ${colorProm(par)}`}>
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

          {/* Distribución de dificultades — temas relevantes */}
          {resultados.distribucion_dificultades && Object.keys(resultados.distribucion_dificultades).length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-200 text-sm">Temas relevantes — dificultades reportadas</h3>
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

          {/* Comentarios de estudiantes */}
          {comentarios.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-200 text-sm">Comentarios de estudiantes</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {comentarios.map((c, i) => (
                  <div key={i} className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/50 space-y-1.5">
                    <p className="text-xs text-gray-500 font-medium">{c.nombre}</p>
                    {c.fortalezas && (
                      <p className="text-xs text-gray-300 italic">
                        <span className="text-emerald-400 not-italic font-medium">Fortalezas: </span>"{c.fortalezas}"
                      </p>
                    )}
                    {c.sugerencias && (
                      <p className="text-xs text-gray-300 italic">
                        <span className="text-amber-400 not-italic font-medium">Sugerencias: </span>"{c.sugerencias}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
