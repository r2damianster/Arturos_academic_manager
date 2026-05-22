'use client'

import { useEffect, useState, useTransition } from 'react'
import { getFichaEstudiante, type FichaEstudianteData } from '@/lib/actions/ficha-estudiante'
import { saveNotaIncidencia, clearProblemas } from '@/lib/actions/encuesta-actions'
import { citarEstudiante } from '@/lib/actions/citaciones'
import { useSensibleToggle } from '@/lib/hooks/use-sensible-toggle'

type Tab = 'resumen' | 'trabajos' | 'participacion' | 'encuesta'

const RAZONES_CITACION = [
  { value: 'inasistencia', label: 'Inasistencia' },
  { value: 'bajo_desempeño', label: 'Bajo desempeño' },
  { value: 'asignacion_trabajo', label: 'Asignación de trabajo' },
  { value: 'otro', label: 'Otro' },
]

const NIVEL_LABELS = ['', '1 · Nula', '2 · Baja', '3 · Media', '4 · Alta', '5 · Excelente']
const NIVEL_COLORS = ['', 'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 'bg-lime-600', 'bg-emerald-600']

interface Props {
  estudianteId: string
  cursoId: string
  bitacoraId?: string
  onClose: () => void
}

export function FichaEstudianteDrawer({ estudianteId, cursoId, bitacoraId, onClose }: Props) {
  const [data, setData] = useState<FichaEstudianteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('resumen')
  const [sensibleOn, toggleSensible] = useSensibleToggle()

  // Nota incidencia editing
  const [nota, setNota] = useState('')
  const [notaGuardando, setNotaGuardando] = useState(false)
  const [notaMsg, setNotaMsg] = useState<string | null>(null)

  // Limpiar problemas — confirmación inline
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false)
  const [, startLimpiarTransition] = useTransition()
  const [limpiarMsg, setLimpiarMsg] = useState<string | null>(null)

  // Citar a tutoría
  const [citarOpen, setCitarOpen] = useState(false)
  const [citarRazon, setCitarRazon] = useState('inasistencia')
  const [citarDetalle, setCitarDetalle] = useState('')
  const [citarGuardando, setCitarGuardando] = useState(false)
  const [citarMsg, setCitarMsg] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getFichaEstudiante(estudianteId, cursoId, bitacoraId)
      .then(result => {
        if ('error' in result) {
          setError(result.error)
        } else {
          setData(result)
          setNota((result.estudiante.nota_incidencia as string | null) ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [estudianteId, cursoId, bitacoraId])

  async function guardarNota() {
    if (!data) return
    setNotaGuardando(true)
    const res = await saveNotaIncidencia(data.estudiante.id, nota, cursoId)
    if (res?.error) {
      setNotaMsg(`Error: ${res.error}`)
    } else {
      setNotaMsg('Guardado')
      setData(prev => prev ? { ...prev, estudiante: { ...prev.estudiante, nota_incidencia: nota.trim() || null } } : prev)
      setTimeout(() => setNotaMsg(null), 2000)
    }
    setNotaGuardando(false)
  }

  function iniciarLimpiarProblemas() {
    setConfirmarLimpiar(true)
    setLimpiarMsg(null)
  }

  function cancelarLimpiar() {
    setConfirmarLimpiar(false)
  }

  function confirmarLimpiarProblemas() {
    if (!data?.estudiante.auth_user_id) return
    startLimpiarTransition(async () => {
      const res = await clearProblemas(data.estudiante.auth_user_id!, cursoId)
      if (res?.error) {
        setLimpiarMsg(`Error: ${res.error}`)
      } else {
        setLimpiarMsg('Problema marcado como resuelto.')
        setData(prev => prev && prev.encuesta
          ? { ...prev, encuesta: { ...prev.encuesta, problemas_reportados: null } }
          : prev
        )
        setConfirmarLimpiar(false)
      }
    })
  }

  async function guardarCitacion() {
    if (!data) return
    setCitarGuardando(true)
    setCitarMsg(null)
    const res = await citarEstudiante({
      cursoId,
      estudianteId: data.estudiante.id,
      razon: citarRazon,
      detalleRazon: citarDetalle.trim() || undefined,
    })
    if (res.error) {
      setCitarMsg(`Error: ${res.error}`)
    } else {
      setCitarMsg('Citación registrada.')
      setData(prev => prev
        ? {
            ...prev,
            estudiante: { ...prev.estudiante, tutoria: true },
            citaciones: {
              pendientes: prev.citaciones.pendientes + 1,
              ultima: { razon: citarRazon, detalle_razon: citarDetalle.trim() || null, estado: 'pendiente' },
            },
          }
        : prev
      )
      setCitarDetalle('')
      setCitarOpen(false)
    }
    setCitarGuardando(false)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderLikert(val: number | null | undefined, max = 5) {
    if (val == null) return <span className="text-gray-600 text-xs italic">No especificado</span>
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < val ? 'bg-brand-500' : 'bg-gray-800'}`} />
          ))}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{val}/{max}</span>
      </div>
    )
  }

  function renderBool(val: boolean | null | undefined) {
    if (val === true) return <span className="text-emerald-400">Sí</span>
    if (val === false) return <span className="text-red-400">No</span>
    return <span className="text-gray-600">N/A</span>
  }

  function pctColor(pct: number | null) {
    if (pct == null) return 'text-gray-400'
    if (pct >= 80) return 'text-emerald-400'
    if (pct >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  // ── TAB: Resumen ────────────────────────────────────────────────────────────

  function TabResumen() {
    if (!data) return null
    const { asistencia, trabajos, participacion, estudiante } = data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enc = data.encuesta as Record<string, any> | null
    return (
      <div className="space-y-5">
        {/* Asistencia y rendimiento */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asistencia y rendimiento</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Asistencia', value: asistencia.pct != null ? `${asistencia.pct}%` : '—', color: pctColor(asistencia.pct) },
              { label: 'Presentes', value: String(asistencia.presentes), color: 'text-emerald-400' },
              { label: 'Ausencias', value: String(asistencia.ausentes + asistencia.atrasos), color: asistencia.ausentes + asistencia.atrasos > 0 ? 'text-red-400' : 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="text-center bg-gray-800/40 rounded-lg py-2">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
          {asistencia.ultimaObs && !sensibleOn && (
            <p className="text-xs text-gray-600 italic text-center">Observación de clase oculta (info sensible)</p>
          )}
          {asistencia.ultimaObs && sensibleOn && (
            <div className="border-l-2 border-blue-800 pl-2">
              <p className="text-[10px] text-gray-500 mb-0.5">
                Última obs. de clase
                <span className="text-gray-600 ml-1">({fmtFecha(asistencia.ultimaObs.fecha)})</span>
              </p>
              <p className="text-xs text-gray-300 italic">"{asistencia.ultimaObs.obs}"</p>
            </div>
          )}
        </section>

        {/* Carrera y perfil académico */}
        {enc && (
          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perfil académico</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoRow label="Carrera" value={enc.carrera as string} />
              <InfoRow label="Modalidad" value={enc.modalidad_carrera as string} />
              <InfoRow label="Nivel" value={enc.nivel_estudio as string} />
            </div>
            <div className="space-y-1 mt-1">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Satisfacción inicial con la carrera</p>
                {renderLikert(enc.carrera_inicio_deseada as number)}
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Satisfacción actual</p>
                {renderLikert(enc.carrera_actual_deseada as number)}
              </div>
            </div>
          </section>
        )}

        {/* Participación reciente */}
        {participacion.ultimas.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Participación reciente</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {participacion.ultimas.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.nivel ? NIVEL_COLORS[p.nivel] : 'bg-gray-700'}`}>
                    {p.nivel ?? '—'}
                  </span>
                  <span className="text-[9px] text-gray-600">{fmtFecha(p.fecha)}</span>
                </div>
              ))}
              {participacion.promedio != null && (
                <span className="ml-auto text-xs text-gray-400">
                  Prom. <span className="text-brand-400 font-medium">{participacion.promedio}</span>/5
                </span>
              )}
            </div>
          </section>
        )}

        {/* Grupo actual */}
        {data.grupoActual && (
          <section className="space-y-1">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grupo en esta sesión</h3>
            <p className="text-sm text-gray-300">
              <span className="font-medium">{data.grupoActual.nombre}</span>
              {data.grupoActual.categoria && (
                <span className="text-gray-500 ml-1">({data.grupoActual.categoria})</span>
              )}
            </p>
          </section>
        )}

        {/* Citaciones vigentes */}
        {data.citaciones.pendientes > 0 && (
          <section>
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <span className="text-blue-400 text-sm">📘</span>
              <div className="text-xs">
                <span className="text-blue-300 font-medium">
                  {data.citaciones.pendientes} citación{data.citaciones.pendientes > 1 ? 'es' : ''} vigente{data.citaciones.pendientes > 1 ? 's' : ''}
                </span>
                {data.citaciones.ultima && (
                  <p className="text-blue-400/60 mt-0.5">
                    Última: {RAZONES_CITACION.find(r => r.value === data.citaciones.ultima?.razon)?.label ?? data.citaciones.ultima.razon}
                    {' — '}<span className="capitalize">{data.citaciones.ultima.estado}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Info sensible — nota y problemas */}
        {sensibleOn && (
          <section className="space-y-3 border border-gray-700/60 rounded-xl p-3 bg-gray-900/40">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <span>🔒</span> Info sensible
            </h3>

            {/* Nota privada editable */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 flex items-center gap-1">
                <span>📝</span> Nota privada del profesor
              </label>
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                onBlur={guardarNota}
                rows={3}
                maxLength={500}
                placeholder="Recuerda hablar con él/ella sobre..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
              {notaMsg && (
                <p className={`text-[10px] ${notaMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {notaGuardando ? 'Guardando...' : notaMsg}
                </p>
              )}
              {notaGuardando && !notaMsg && <p className="text-[10px] text-gray-500">Guardando...</p>}
            </div>

            {/* Problema reportado */}
            {enc?.problemas_reportados && (
              <div className="space-y-2">
                <div className="p-2.5 bg-yellow-900/10 border border-yellow-800/40 rounded-lg">
                  <p className="text-[10px] text-yellow-500 font-medium mb-1">⚠ Problema reportado por el estudiante</p>
                  <p className="text-xs text-yellow-200/70 italic">"{enc.problemas_reportados as string}"</p>
                </div>
                {!confirmarLimpiar ? (
                  <button
                    onClick={iniciarLimpiarProblemas}
                    className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    ✕ Marcar como resuelto
                  </button>
                ) : (
                  <div className="border border-red-800/50 rounded-lg p-2.5 bg-red-900/10 space-y-2">
                    <p className="text-xs text-red-300 font-medium">¿Borrar el problema reportado?</p>
                    <p className="text-[10px] text-red-400/70">Esta acción no se puede deshacer.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmarLimpiarProblemas}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-red-900/40 border border-red-700 text-red-300 hover:bg-red-900/60 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={cancelarLimpiar}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {limpiarMsg && <p className="text-[10px] text-emerald-400">{limpiarMsg}</p>}
              </div>
            )}

            {/* Datos demográficos sensibles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Género" value={enc?.genero as string} />
              <InfoRow label="Foráneo/a" valueEl={renderBool(enc?.es_foraneo as boolean)} />
              <InfoRow label="Vivienda" value={enc?.situacion_vivienda as string} />
              <InfoRow label="Dispositivo" value={enc?.dispositivo_movil as string} />
              <InfoRow label="Trabaja" valueEl={renderBool(enc?.trabaja as boolean)} />
              {enc?.trabaja && (
                <>
                  <InfoRow label="Tipo trabajo" value={enc?.tipo_trabajo as string} />
                  <InfoRow label="Horas/día" value={enc?.horas_trabajo_diarias != null ? `${enc.horas_trabajo_diarias}h` : undefined} />
                </>
              )}
            </div>
          </section>
        )}

        {!sensibleOn && estudiante.nota_incidencia && (
          <p className="text-[10px] text-gray-600 italic text-center">
            Hay una nota privada del profesor (activa info sensible para verla)
          </p>
        )}
      </div>
    )
  }

  // ── TAB: Trabajos ───────────────────────────────────────────────────────────

  function TabTrabajos() {
    if (!data) return null
    const { trabajos } = data
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Trabajos activos</span>
          <span className={`text-sm font-bold ${trabajos.activos > 0 ? 'text-brand-400' : 'text-gray-500'}`}>
            {trabajos.activos}
          </span>
        </div>
        {trabajos.ultimo ? (
          <div className="border border-gray-700 rounded-xl p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200">{trabajos.ultimo.tipo}</p>
                {trabajos.ultimo.tema && <p className="text-xs text-gray-400">{trabajos.ultimo.tema}</p>}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] border font-medium ${estadoTrabajoClases(trabajos.ultimo.estado)}`}>
                {trabajos.ultimo.estado ?? '—'}
              </span>
            </div>
            {trabajos.ultimo.progreso > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Progreso</span>
                  <span className="text-[10px] text-gray-400">{trabajos.ultimo.progreso}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${trabajos.ultimo.progreso}%` }} />
                </div>
              </div>
            )}
            {sensibleOn && trabajos.ultimo.ultimaObs && (
              <div className="border-l-2 border-gray-700 pl-2">
                <p className="text-[10px] text-gray-500 mb-0.5">Última observación</p>
                <p className="text-xs text-gray-400 italic">"{trabajos.ultimo.ultimaObs}"</p>
              </div>
            )}
            {!sensibleOn && trabajos.ultimo.ultimaObs && (
              <p className="text-[10px] text-gray-600 italic">Observación oculta (info sensible)</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600 text-center py-4">Sin trabajos asignados</p>
        )}
      </div>
    )
  }

  // ── TAB: Participación ──────────────────────────────────────────────────────

  function TabParticipacion() {
    if (!data) return null
    const { participacion } = data
    if (participacion.ultimas.length === 0) {
      return <p className="text-sm text-gray-600 text-center py-8">Sin registros de participación</p>
    }
    return (
      <div className="space-y-3">
        {participacion.promedio != null && (
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-brand-400">{participacion.promedio}</p>
            <p className="text-xs text-gray-500">promedio / 5</p>
          </div>
        )}
        <div className="space-y-2">
          {participacion.ultimas.map((p, i) => (
            <div key={i} className="flex items-start gap-3 px-2 py-1.5 rounded-lg bg-gray-800/30">
              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.nivel ? NIVEL_COLORS[p.nivel] : 'bg-gray-700'}`}>
                {p.nivel ?? '—'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{NIVEL_LABELS[p.nivel ?? 0] ?? '—'}</span>
                  <span className="text-[10px] text-gray-600">{fmtFecha(p.fecha)}</span>
                </div>
                {p.observacion && sensibleOn && (
                  <p className="text-[11px] text-gray-500 italic mt-0.5">"{p.observacion}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── TAB: Encuesta ───────────────────────────────────────────────────────────

  function TabEncuesta() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enc = data?.encuesta as Record<string, any> | null
    if (!enc) return (
      <div className="text-center py-10 space-y-2">
        <p className="text-gray-500">Sin encuesta completada</p>
        <p className="text-xs text-gray-600">El estudiante aún no ha completado el onboarding</p>
      </div>
    )
    return (
      <div className="space-y-5">
        {/* Acceso a tecnología */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acceso a tecnología</h3>
          <div className="space-y-1.5">
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Nivel tecnológico</p>
              {renderLikert(enc.nivel_tecnologia as number)}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {enc.tiene_laptop && <Chip>Laptop</Chip>}
              {enc.tiene_pc_escritorio && <Chip>PC Escritorio</Chip>}
              {enc.comparte_pc && <Chip>PC Compartida</Chip>}
              {enc.sin_computadora && <Chip danger>Sin Computadora</Chip>}
            </div>
          </div>
        </section>

        {/* Hábitos de lectura */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hábitos de estudio</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/30 p-2 rounded-lg text-center">
              <p className="text-lg font-bold text-gray-200">{enc.libros_anio ?? '—'}</p>
              <p className="text-[10px] text-gray-500">libros / año</p>
            </div>
            <div className="bg-gray-800/30 p-2 rounded-lg">
              <p className="text-[10px] text-gray-500 mb-0.5">Gusto escritura</p>
              {renderLikert(enc.gusto_escritura as number)}
            </div>
          </div>
        </section>

        {/* Uso de IA — sensible */}
        {sensibleOn ? (
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Uso de IA (frecuencia 1-5)</h3>
            <div className="space-y-2">
              {[
                { label: 'Resolución de tareas', key: 'uso_ia_tareas' },
                { label: 'Redacción', key: 'uso_ia_redaccion' },
                { label: 'Resumir información', key: 'uso_ia_resumen' },
                { label: 'Generación de ideas', key: 'uso_ia_ideas' },
                { label: 'Análisis crítico', key: 'uso_ia_critico' },
                { label: 'Comprensión de texto', key: 'uso_ia_comprension' },
                { label: 'Verificación', key: 'uso_ia_verificacion' },
                { label: 'Traducción', key: 'uso_ia_traduccion' },
              ].map(item => (
                <div key={item.key}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-gray-500">{enc[item.key] as number ?? '—'}</span>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full">
                    <div
                      className="bg-brand-500 h-1.5 rounded-full"
                      style={{ width: `${(((enc[item.key] as number) || 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-[10px] text-gray-600 italic text-center">Datos de uso de IA ocultos (info sensible)</p>
        )}

        {/* Datos demográficos sensibles en la tab de encuesta también */}
        {sensibleOn && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Datos socioeconómicos</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoRow label="Género" value={enc.genero as string} />
              <InfoRow label="Vivienda" value={enc.situacion_vivienda as string} />
              <InfoRow label="Foráneo/a" valueEl={renderBool(enc.es_foraneo as boolean)} />
              <InfoRow label="Dispositivo" value={enc.dispositivo_movil as string} />
              <InfoRow label="Trabaja" valueEl={renderBool(enc.trabaja as boolean)} />
              {enc.trabaja && (
                <InfoRow label="Horas trabajo/día" value={enc.horas_trabajo_diarias != null ? `${enc.horas_trabajo_diarias}h` : undefined} />
              )}
            </div>
          </section>
        )}
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="shrink-0 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 -ml-1 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              {data ? (
                <>
                  <p className="text-white font-semibold text-sm truncate">{data.estudiante.nombre}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-500 text-[11px] truncate">{data.estudiante.email}</p>
                    {data.estudiante.tutoria && (
                      <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-800 rounded text-[10px] text-blue-400">
                        📘 Citado
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
              )}
            </div>
            <button
              onClick={toggleSensible}
              title={sensibleOn ? 'Ocultar info sensible' : 'Mostrar info sensible'}
              className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors ${
                sensibleOn
                  ? 'bg-amber-900/30 border-amber-700 text-amber-400'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {sensibleOn ? '👁' : '👁‍🗨'} {sensibleOn ? 'Sensible' : 'Sensible'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 pb-2">
            {(['resumen', 'trabajos', 'participacion', 'encuesta'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  tab === t
                    ? 'bg-brand-900/60 border border-brand-700 text-brand-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'resumen' ? 'Resumen' : t === 'trabajos' ? 'Trabajos' : t === 'participacion' ? 'Participación' : 'Encuesta'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm text-center py-8">{error}</div>
          )}
          {!loading && !error && data && (
            <>
              {tab === 'resumen' && <TabResumen />}
              {tab === 'trabajos' && <TabTrabajos />}
              {tab === 'participacion' && <TabParticipacion />}
              {tab === 'encuesta' && <TabEncuesta />}
            </>
          )}
        </div>

        {/* Footer — Citar a tutoría */}
        {!loading && !error && data && (
          <div className="shrink-0 border-t border-gray-800 p-3">
            {!citarOpen ? (
              <button
                onClick={() => { setCitarOpen(true); setCitarMsg(null) }}
                className="w-full py-2 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>📌</span> Citar a tutoría
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 font-medium">Nueva citación a tutoría</p>
                <select
                  value={citarRazon}
                  onChange={e => setCitarRazon(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {RAZONES_CITACION.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <textarea
                  value={citarDetalle}
                  onChange={e => setCitarDetalle(e.target.value)}
                  placeholder="Detalle (opcional)..."
                  rows={2}
                  maxLength={300}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
                {citarMsg && (
                  <p className={`text-[10px] ${citarMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{citarMsg}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCitarOpen(false); setCitarMsg(null) }}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarCitacion}
                    disabled={citarGuardando}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-brand-700/40 border border-brand-700 text-brand-300 hover:bg-brand-700/60 disabled:opacity-40 transition-colors"
                  >
                    {citarGuardando ? 'Guardando...' : 'Guardar citación'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────────

function InfoRow({ label, value, valueEl }: { label: string; value?: string; valueEl?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500">{label}</p>
      {valueEl ?? <p className="text-gray-300 text-xs capitalize">{value || 'N/A'}</p>}
    </div>
  )
}

function Chip({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] ${danger ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
      {children}
    </span>
  )
}

function fmtFecha(fecha: string) {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return fecha
  }
}

function estadoTrabajoClases(estado: string | null) {
  switch (estado) {
    case 'Pendiente': return 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
    case 'En progreso': return 'text-blue-400 bg-blue-900/30 border-blue-800'
    case 'Entregado': return 'text-purple-400 bg-purple-900/30 border-purple-800'
    case 'Aprobado': return 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
    default: return 'text-red-400 bg-red-900/30 border-red-800'
  }
}
