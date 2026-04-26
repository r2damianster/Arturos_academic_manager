'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { iniciarClase, actualizarActividadesEnVivo, finalizarClase, detenerClase } from '@/lib/actions/bitacora'
import { registrarAsistenciaMasiva } from '@/lib/actions/asistencia'
import type { ActividadPlanificada, ActividadTipo } from '@/types/domain'
import { Ruleta } from '@/components/herramientas/Ruleta'
import { Agrupacion } from '@/components/herramientas/Agrupacion'
import { buildMoodleCSV, downloadCSV } from '@/lib/moodle-csv'

type Student = { id: string; nombre: string; email: string }
type EstadoA = 'Presente' | 'Ausente' | 'Atraso' | null

type Props = {
  bitacoraId: string
  cursoId: string
  cursoNombre: string
  cursoCodigo: string
  fecha: string
  tema: string
  estadoClase: string
  horaInicioReal: string | null
  actividadesIniciales: ActividadPlanificada[]
  students: Student[]
  asistenciaInicial: { estudiante_id: string; estado: string; atraso: boolean }[]
  horasClase: number
}

function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

const TIPO_LABELS: Record<ActividadTipo, string> = {
  actividad: 'Actividad',
  ruleta: 'Ruleta',
  agrupacion: 'Agrupación',
}

const TIPO_COLORS: Record<ActividadTipo, string> = {
  actividad: 'badge-azul',
  ruleta: 'badge-amarillo',
  agrupacion: 'badge-verde',
}

// ─── Subcomponente: Form agregar/editar actividad ────────────────────────────

type ActividadFormProps = {
  initial?: ActividadPlanificada
  onSave: (a: ActividadPlanificada) => void
  onCancel: () => void
}

function ActividadForm({ initial, onSave, onCancel }: ActividadFormProps) {
  const [actividad, setActividad] = useState(initial?.actividad ?? '')
  const [recurso, setRecurso] = useState(initial?.recurso ?? '')
  const [tipo, setTipo] = useState<ActividadTipo>(initial?.tipo ?? 'actividad')
  const [duracion, setDuracion] = useState<string>(String(initial?.duracion_min ?? ''))
  const [notas, setNotas] = useState(initial?.notas ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!actividad.trim()) return
    onSave({
      ...initial,
      actividad: actividad.trim(),
      recurso: recurso.trim(),
      tipo,
      duracion_min: duracion ? Number(duracion) : undefined,
      notas: notas.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div>
        <label className="label">Actividad *</label>
        <input className="input" value={actividad} onChange={e => setActividad(e.target.value)} placeholder="Ej: Discusión grupal" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Recurso / material</label>
          <input className="input" value={recurso} onChange={e => setRecurso(e.target.value)} placeholder="Ej: Presentación, link…" />
        </div>
        <div>
          <label className="label">Tipo de herramienta</label>
          <select className="input" value={tipo} onChange={e => setTipo(e.target.value as ActividadTipo)}>
            <option value="actividad">Actividad</option>
            <option value="ruleta">Ruleta</option>
            <option value="agrupacion">Agrupación</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Duración estimada (min)</label>
          <input className="input" type="number" min={1} value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="15" />
        </div>
        <div>
          <label className="label">Notas de improvisación</label>
          <input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Cambios al plan original…" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost text-sm px-4 py-1.5">
          Cancelar
        </button>
        <button type="submit" className="btn-primary text-sm px-4 py-1.5">
          Guardar
        </button>
      </div>
    </form>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ModoClaseClient({
  bitacoraId, cursoId, cursoNombre, cursoCodigo,
  fecha, tema, estadoClase, horaInicioReal: horaInicialProp,
  actividadesIniciales, students, asistenciaInicial, horasClase,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [horaInicio, setHoraInicio] = useState(horaInicialProp)
  const [elapsed, setElapsed] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [elapsedAlPausar, setElapsedAlPausar] = useState(0)
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => {
    if (!horaInicio || pausado) return
    const start = new Date(horaInicio).getTime()
    setElapsed(Math.floor((Date.now() - start) / 1000))
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [horaInicio, pausado])

  function handlePausar() {
    setElapsedAlPausar(elapsed)
    setPausado(true)
  }

  function handleReanudar() {
    // Ajustar hora de inicio para que el contador continúe desde donde pausó
    const nuevaHora = new Date(Date.now() - elapsedAlPausar * 1000).toISOString()
    setHoraInicio(nuevaHora)
    setPausado(false)
  }

  async function handleIniciar() {
    setIniciando(true)
    await iniciarClase(bitacoraId)
    setHoraInicio(new Date().toISOString())
    setIniciando(false)
  }

  // ── Actividades ────────────────────────────────────────────────────────────
  const [actividades, setActividades] = useState<ActividadPlanificada[]>(actividadesIniciales)
  const [slideIdx, setSlideIdx] = useState(0)
  const [editando, setEditando] = useState<number | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [toolOpen, setToolOpen] = useState<ActividadTipo | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateActividades(next: ActividadPlanificada[]) {
    setActividades(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      startTransition(() => { actualizarActividadesEnVivo(bitacoraId, next) })
    }, 800)
  }

  function toggleCompletada(idx: number) {
    const next = actividades.map((a, i) =>
      i === idx ? { ...a, completada: !a.completada } : a
    )
    updateActividades(next)
  }

  function saveEdicion(idx: number, updated: ActividadPlanificada) {
    const next = actividades.map((a, i) => i === idx ? updated : a)
    updateActividades(next)
    setEditando(null)
  }

  function addActividad(nueva: ActividadPlanificada) {
    const next = [...actividades, { ...nueva, id: crypto.randomUUID() }]
    updateActividades(next)
    setSlideIdx(next.length - 1)
    setAgregando(false)
  }

  const slide = actividades[slideIdx] ?? null
  const completadas = actividades.filter(a => a.completada).length

  // ── Asistencia ─────────────────────────────────────────────────────────────
  const [asistencia, setAsistencia] = useState<Record<string, EstadoA>>(() => {
    const map: Record<string, EstadoA> = {}
    for (const s of students) map[s.id] = null
    for (const a of asistenciaInicial) map[a.estudiante_id] = a.estado as EstadoA
    return map
  })

  function marcarAsistencia(estudianteId: string, estado: 'Presente' | 'Ausente' | 'Atraso') {
    setAsistencia(prev => ({ ...prev, [estudianteId]: estado }))
    startTransition(() => {
      registrarAsistenciaMasiva(cursoId, fecha, [{
        estudiante_id: estudianteId,
        estado,
        atraso: estado === 'Atraso',
        horas: 1,
      }], bitacoraId)
    })
  }

  const marcados = Object.values(asistencia).filter(Boolean).length

  // ── Tab móvil ─────────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<'actividades' | 'asistencia'>('actividades')

  // ── Finalizar / Detener ────────────────────────────────────────────────────
  const [confirmando, setConfirmando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [confirmandoDetener, setConfirmandoDetener] = useState(false)
  const [deteniendo, setDeteniendo] = useState(false)
  const [claseGuardada, setClaseGuardada] = useState(false)

  async function handleFinalizar() {
    setFinalizando(true)
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      await actualizarActividadesEnVivo(bitacoraId, actividades)
    }
    await finalizarClase(bitacoraId)
    setFinalizando(false)
    setConfirmando(false)
    setClaseGuardada(true)
  }

  async function handleDetener() {
    setDeteniendo(true)
    await detenerClase(bitacoraId)
    router.push('/dashboard/planificacion')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* Overlay post-clase: exportar asistencia */}
      {claseGuardada && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-4xl mb-2">✓</div>
              <h2 className="text-xl font-bold text-white">Clase finalizada</h2>
              <p className="text-sm text-gray-400">Asistencia guardada correctamente</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Exportar asistencia
              </p>

              {/* Selector de plataforma */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-600 bg-brand-600/10 text-brand-400 text-sm font-medium">
                  <span>Moodle</span>
                  <span className="text-xs bg-brand-700/40 px-1.5 py-0.5 rounded text-brand-300">CSV</span>
                </div>
                {/* Aquí irán otras plataformas en el futuro */}
              </div>

              {/* Archivos a descargar */}
              <div className="flex flex-col gap-2">
                {Array.from({ length: horasClase }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const csv = buildMoodleCSV(students, asistencia, i)
                      downloadCSV(csv, `asistencia_${cursoCodigo}_${fecha}_hora${i + 1}.csv`)
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors text-left"
                  >
                    <span className="text-base leading-none flex-shrink-0">⬇</span>
                    <span className="flex-1">
                      Hora {i + 1}
                      {horasClase > 1 && (
                        <span className="text-gray-500 ml-2 text-xs">
                          {i === 0 ? '· atrasos = Ausente' : '· atrasos = Presente'}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-600 flex-shrink-0 hidden sm:block">
                      hora{i + 1}.csv
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                Columnas: email · estado (P / A) — una fila por estudiante, un archivo por hora
              </p>
            </div>

            <button
              onClick={() => router.push('/dashboard/planificacion')}
              className="w-full btn-primary py-2.5 text-sm"
            >
              Ir a Mis Clases →
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-3 md:px-6 py-3 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link
            href="/dashboard/planificacion"
            className="flex-shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Salir</span>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-sm md:text-base truncate">{cursoNombre}</h1>
              <span className="text-gray-500 text-xs hidden md:inline">{cursoCodigo}</span>
            </div>
            <p className="text-xs text-gray-500 truncate hidden md:block">{formatFecha(fecha)} · {tema}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {horaInicio ? (
            <div className="flex items-center gap-2">
              <div className="text-center">
                <p className="text-xs text-gray-500 leading-none mb-0.5 hidden md:block">Tiempo</p>
                <p className={`font-mono text-base md:text-lg font-bold ${pausado ? 'text-amber-400' : 'text-white'}`}>
                  {formatElapsed(pausado ? elapsedAlPausar : elapsed)}
                  {pausado && <span className="text-xs ml-1 text-amber-500">⏸</span>}
                </p>
              </div>
              {pausado ? (
                <button
                  onClick={handleReanudar}
                  className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-700 hover:bg-emerald-900/30 px-2 py-1.5 rounded-lg transition-colors"
                >
                  ▶ Reanudar
                </button>
              ) : (
                <button
                  onClick={handlePausar}
                  className="flex items-center gap-1 text-xs text-amber-400 border border-amber-700 hover:bg-amber-900/30 px-2 py-1.5 rounded-lg transition-colors"
                >
                  ⏸ Pausar
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleIniciar}
              disabled={iniciando}
              className="btn-primary px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm"
            >
              {iniciando ? 'Iniciando…' : 'Iniciar clase'}
            </button>
          )}

          {confirmandoDetener ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 hidden md:inline">¿Detener sin guardar?</span>
              <button
                onClick={handleDetener}
                disabled={deteniendo}
                className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {deteniendo ? 'Deteniendo…' : 'Sí, detener'}
              </button>
              <button onClick={() => setConfirmandoDetener(false)} className="btn-ghost text-xs px-2 py-1.5">
                No
              </button>
            </div>
          ) : confirmando ? (
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-xs md:text-sm text-gray-400 hidden md:inline">¿Finalizar y guardar?</span>
              <button
                onClick={handleFinalizar}
                disabled={finalizando}
                className="bg-red-600 hover:bg-red-500 text-white text-xs md:text-sm font-medium px-2.5 md:px-3 py-1.5 rounded-lg transition-colors"
              >
                {finalizando ? 'Guardando…' : 'Sí'}
              </button>
              <button onClick={() => setConfirmando(false)} className="btn-ghost text-xs md:text-sm px-2 md:px-3 py-1.5">
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmandoDetener(true)}
                className="bg-orange-900/40 hover:bg-orange-800/60 text-orange-400 border border-orange-800 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Detener
              </button>
              <button
                onClick={() => setConfirmando(true)}
                className="bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-800 text-xs md:text-sm font-medium px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors"
              >
                Finalizar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs — solo móvil */}
      <div className="flex-shrink-0 flex md:hidden border-b border-gray-800">
        <button
          onClick={() => setMobileTab('actividades')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === 'actividades' ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-600/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Actividades {actividades.length > 0 && `(${completadas}/${actividades.length})`}
        </button>
        <button
          onClick={() => setMobileTab('asistencia')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === 'asistencia' ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-600/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Asistencia ({marcados}/{students.length})
        </button>
      </div>

      {/* Body — dos columnas en desktop, tab en móvil */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Columna izquierda: Actividades ── */}
        <div className={`flex-1 flex-col overflow-hidden border-r border-gray-800 ${mobileTab === 'actividades' ? 'flex' : 'hidden md:flex'}`}>
          {/* Barra de progreso */}
          {actividades.length > 0 && (
            <div className="flex-shrink-0 px-6 pt-4 pb-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>{completadas} de {actividades.length} actividades completadas</span>
                <span>{Math.round((completadas / actividades.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{ width: `${actividades.length ? (completadas / actividades.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Navegación de slides */}
          {actividades.length > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-2">
              <button
                onClick={() => { setSlideIdx(i => Math.max(0, i - 1)); setEditando(null); setToolOpen(null) }}
                disabled={slideIdx === 0}
                className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-400">
                {slideIdx + 1} / {actividades.length}
              </span>
              <button
                onClick={() => { setSlideIdx(i => Math.min(actividades.length - 1, i + 1)); setEditando(null); setToolOpen(null) }}
                disabled={slideIdx === actividades.length - 1}
                className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* Slide actual */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {actividades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <p className="mb-3">No hay actividades planificadas para esta clase.</p>
              </div>
            ) : slide && editando !== slideIdx ? (
              <div className="card space-y-4">
                {/* Cabecera slide */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {slide.tipo && (
                        <span className={TIPO_COLORS[slide.tipo]}>{TIPO_LABELS[slide.tipo]}</span>
                      )}
                      {slide.duracion_min && (
                        <span className="text-xs text-gray-500">{slide.duracion_min} min</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white leading-snug">{slide.actividad}</h2>
                    {slide.recurso && (
                      <p className="text-sm text-gray-400 mt-1">{slide.recurso}</p>
                    )}
                    {slide.notas && (
                      <p className="text-xs text-amber-400 mt-2 italic">📝 {slide.notas}</p>
                    )}
                  </div>

                  {/* Completada */}
                  <button
                    onClick={() => toggleCompletada(slideIdx)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      slide.completada
                        ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-emerald-700 hover:text-emerald-400'
                    }`}
                  >
                    {slide.completada ? '✓ Completada' : 'Marcar completada'}
                  </button>
                </div>

                {/* Botones herramienta */}
                <div className="flex gap-2 flex-wrap">
                  {(slide.tipo === 'ruleta' || !slide.tipo) && (
                    <button
                      onClick={() => setToolOpen(toolOpen === 'ruleta' ? null : 'ruleta')}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        toolOpen === 'ruleta'
                          ? 'bg-indigo-900/50 border-indigo-600 text-indigo-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      🎡 {toolOpen === 'ruleta' ? 'Cerrar ruleta' : 'Abrir ruleta'}
                    </button>
                  )}
                  {(slide.tipo === 'agrupacion' || !slide.tipo) && (
                    <button
                      onClick={() => setToolOpen(toolOpen === 'agrupacion' ? null : 'agrupacion')}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        toolOpen === 'agrupacion'
                          ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      👥 {toolOpen === 'agrupacion' ? 'Cerrar grupos' : 'Crear grupos'}
                    </button>
                  )}
                  <button
                    onClick={() => setEditando(slideIdx)}
                    className="text-sm px-3 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    ✎ Editar actividad
                  </button>
                </div>

                {/* Panel herramienta */}
                {toolOpen === 'ruleta' && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <Ruleta students={students} />
                  </div>
                )}
                {toolOpen === 'agrupacion' && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <Agrupacion students={students} />
                  </div>
                )}
              </div>
            ) : null}

            {/* Formulario edición inline */}
            {editando === slideIdx && slide && (
              <ActividadForm
                initial={slide}
                onSave={updated => saveEdicion(slideIdx, updated)}
                onCancel={() => setEditando(null)}
              />
            )}

            {/* Miniaturas de todas */}
            {actividades.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-600 uppercase tracking-widest">Todas las actividades</p>
                {actividades.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { setSlideIdx(i); setEditando(null); setToolOpen(null) }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      i === slideIdx
                        ? 'bg-gray-800 border border-gray-700'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                      a.completada ? 'bg-emerald-900 text-emerald-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {a.completada ? '✓' : i + 1}
                    </span>
                    <span className="text-sm text-gray-300 truncate">{a.actividad}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Agregar actividad */}
            {agregando ? (
              <ActividadForm
                onSave={addActividad}
                onCancel={() => setAgregando(false)}
              />
            ) : (
              <button
                onClick={() => setAgregando(true)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:border-brand-600 hover:text-brand-400 transition-colors text-sm"
              >
                <span className="text-lg leading-none">+</span> Agregar actividad
              </button>
            )}
          </div>
        </div>

        {/* ── Columna derecha: Asistencia ── */}
        <div className={`w-full md:w-80 flex-shrink-0 flex-col overflow-hidden ${mobileTab === 'asistencia' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-200 text-sm">Asistencia en vivo</h2>
            <span className="text-xs text-gray-500">{marcados}/{students.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {students.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Sin estudiantes</p>
            ) : (
              students.map(s => {
                const estado = asistencia[s.id]
                return (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800/50">
                    <span className="flex-1 text-sm text-gray-300 truncate">
                      {s.nombre}
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => marcarAsistencia(s.id, 'Presente')}
                        title="Presente"
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          estado === 'Presente'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-800 text-gray-500 hover:bg-emerald-900 hover:text-emerald-400'
                        }`}
                      >P</button>
                      <button
                        onClick={() => marcarAsistencia(s.id, 'Atraso')}
                        title="Atraso"
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          estado === 'Atraso'
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-800 text-gray-500 hover:bg-amber-900 hover:text-amber-400'
                        }`}
                      >A</button>
                      <button
                        onClick={() => marcarAsistencia(s.id, 'Ausente')}
                        title="Ausente"
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          estado === 'Ausente'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-800 text-gray-500 hover:bg-red-900 hover:text-red-400'
                        }`}
                      >F</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Leyenda */}
          <div className="flex-shrink-0 border-t border-gray-800 px-4 py-2 flex gap-3 text-xs text-gray-600">
            <span className="text-emerald-600">P = Presente</span>
            <span className="text-amber-600">A = Atraso</span>
            <span className="text-red-600">F = Falta</span>
          </div>

          {/* Export Moodle — visible cuando la clase ya está cumplida (Ver resumen) */}
          {estadoClase === 'cumplido' && (
            <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Exportar asistencia
              </p>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-brand-600 bg-brand-600/10 text-brand-400 text-xs font-medium">
                  Moodle <span className="text-brand-500">CSV</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: horasClase }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const attendanceMap: Record<string, string> = {}
                      for (const s of students) {
                        attendanceMap[s.id] = asistencia[s.id] ?? 'Ausente'
                      }
                      const csv = buildMoodleCSV(students, attendanceMap, i)
                      downloadCSV(csv, `asistencia_${cursoCodigo}_${fecha}_hora${i + 1}.csv`)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors text-left"
                  >
                    <span>⬇</span>
                    <span className="flex-1">Hora {i + 1}</span>
                    {horasClase > 1 && (
                      <span className="text-gray-600 text-[10px]">
                        {i === 0 ? 'atrasos=A' : 'atrasos=P'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
