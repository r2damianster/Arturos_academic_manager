'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarClase, actualizarActividadesEnVivo, confirmarCumplido, detenerClase, getClasesFuturas, trasladarActividades } from '@/lib/actions/bitacora'
import { registrarAsistenciaMasiva, registrarParticipacion } from '@/lib/actions/asistencia'
import { guardarParticipacion, getGruposDeSesion } from '@/lib/actions/grupos'
import type { GrupoBase, PlantillaGrupo } from '@/lib/actions/grupos'
import type { ActividadPlanificada, ActividadTipo } from '@/types/domain'
import { Ruleta } from '@/components/herramientas/Ruleta'
import { Agrupacion } from '@/components/herramientas/Agrupacion'
import { buildMoodleCSV, downloadCSV } from '@/lib/moodle-csv'
import { formatNombreCorto } from '@/lib/format'
import { FichaEstudianteDrawer } from '@/components/ficha-estudiante/FichaEstudianteDrawer'
import { getFichaEstudiante, type FichaEstudianteData } from '@/lib/actions/ficha-estudiante'
import { saveNotaIncidencia, clearProblemas } from '@/lib/actions/encuesta-actions'
import { useSensibleToggle } from '@/lib/hooks/use-sensible-toggle'
import EnCursoVistaClase from '@/components/modo-clase/EnCursoVistaClase'
import { upsertItemEnCurso } from '@/lib/actions/calificaciones-items'

type Student = { id: string; nombre: string; email: string; tutoria: boolean }
type EstadoA = 'Presente' | 'Ausente' | 'Atraso' | null
type GrupoIntegrante = { id: string; estudiante_id: string; estudiantes: { id: string; nombre: string } | null }
type GrupoItem = { id: string; nombre: string; categoria: string | null; orden: number; grupo_integrantes: GrupoIntegrante[] }
type Categoria = { id: string; nombre: string; valores: string[] }

const GRUPO_DOT_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500',
]

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
  gruposIniciales: GrupoItem[]
  categorias: Categoria[]
  gruposUltimaSesion?: GrupoBase[] | null
  plantillas?: PlantillaGrupo[]
  itemsEnCurso?: { estudiante_id: string; parcial: number; nombre_item: string; nota: number | null }[]
  numParciales?: number
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

// ─── Ruleta de grupos (mini slot machine) ────────────────────────────────────

function RuletaGrupos({
  grupos, excluidos, onExcluirChange, autoExcluir, onAutoExcluirChange, onSeleccionar,
}: {
  grupos: GrupoItem[]
  excluidos: Set<string>
  onExcluirChange: (s: Set<string>) => void
  autoExcluir: boolean
  onAutoExcluirChange: (v: boolean) => void
  onSeleccionar: (id: string) => void
}) {
  const [girando, setGirando] = useState(false)
  const [ticker, setTicker] = useState('')
  const [ganadorId, setGanadorId] = useState<string | null>(null)

  const activos = grupos.filter(g => !excluidos.has(g.id))

  function girar() {
    if (girando || activos.length === 0) return
    setGirando(true)
    setGanadorId(null)

    let count = 0
    const total = 22
    const id = setInterval(() => {
      const r = activos[Math.floor(Math.random() * activos.length)]
      setTicker(r.nombre)
      count++
      if (count >= total) {
        clearInterval(id)
        const winner = activos[Math.floor(Math.random() * activos.length)]
        setTicker(winner.nombre)
        setGanadorId(winner.id)
        setGirando(false)
        if (autoExcluir) onExcluirChange(new Set([...excluidos, winner.id]))
        onSeleccionar(winner.id)
      }
    }, 75)
  }

  return (
    <div className="space-y-3">
      {/* Display */}
      <div
        className={`h-14 flex items-center justify-center rounded-xl border text-lg font-bold transition-colors ${
          ganadorId
            ? 'border-indigo-600 bg-indigo-900/30 text-indigo-200'
            : 'border-gray-700 bg-gray-800/60 text-gray-400'
        }`}
      >
        {ticker || (activos.length === 0 ? 'Todos excluidos' : '— girar —')}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2">
        <button
          onClick={girar}
          disabled={girando || activos.length === 0}
          className="btn-primary flex-1 py-2 text-sm disabled:opacity-40"
        >
          {girando ? 'Girando…' : '🎡 Girar ruleta'}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={autoExcluir}
            onChange={e => onAutoExcluirChange(e.target.checked)}
            className="accent-indigo-500"
          />
          Auto-excluir
        </label>
      </div>

      {/* Chips de grupos */}
      <div className="flex flex-wrap gap-1.5">
        {grupos.map(g => {
          const excluido = excluidos.has(g.id)
          const esGanador = ganadorId === g.id
          return (
            <button
              key={g.id}
              onClick={() => {
                const next = new Set(excluidos)
                if (next.has(g.id)) next.delete(g.id)
                else next.add(g.id)
                onExcluirChange(next)
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                excluido
                  ? 'bg-gray-800 text-gray-600 line-through'
                  : esGanador
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {g.nombre}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista de foco de un grupo ────────────────────────────────────────────────

const NIVEL_LABELS = ['', '1', '2', '3', '4', '5']

function VistGrupo({
  grupo, students, asistencia, onAsistencia, cursoId, fecha, onVolver, isSaved, onSaved,
  ecActividades, ecIndex, ecEditando, setEcEditando, guardarEcNota, ecPending,
}: {
  grupo: GrupoItem
  students: Student[]
  asistencia: Record<string, EstadoA>
  onAsistencia: (id: string, estado: 'Presente' | 'Ausente' | 'Atraso') => void
  cursoId: string
  fecha: string
  onVolver: () => void
  isSaved: boolean
  onSaved: () => void
  ecActividades?: string[]
  ecIndex?: Map<string, { nota: number | null; parcial: number }>
  ecEditando?: { estudianteId: string; nombreItem: string; parcial: number; nota: string } | null
  setEcEditando?: (v: { estudianteId: string; nombreItem: string; parcial: number; nota: string } | null) => void
  guardarEcNota?: (estudianteId: string, nombreItem: string, parcial: number, notaStr: string) => void
  ecPending?: boolean
}) {
  const [partActivo, setPartActivo] = useState<Set<string>>(new Set())
  const [partMap, setPartMap] = useState<Record<string, { nivel: number | null; obs: string }>>({})
  const [isPending, startTransition] = useTransition()
  const [expositTicker, setExpositTicker] = useState('')
  const [expositGirando, setExpositGirando] = useState(false)
  const [expositElegidoId, setExpositElegidoId] = useState<string | null>(null)

  const miembros = grupo.grupo_integrantes
    .map(gi => students.find(s => s.id === gi.estudiante_id))
    .filter(Boolean) as Student[]

  function sortearExpositor() {
    if (expositGirando || miembros.length === 0) return
    setExpositGirando(true)
    setExpositElegidoId(null)
    let count = 0
    const total = 20
    const id = setInterval(() => {
      const r = miembros[Math.floor(Math.random() * miembros.length)]
      setExpositTicker(formatNombreCorto(r.nombre))
      count++
      if (count >= total) {
        clearInterval(id)
        const winner = miembros[Math.floor(Math.random() * miembros.length)]
        setExpositTicker(formatNombreCorto(winner.nombre))
        setExpositElegidoId(winner.id)
        setExpositGirando(false)
      }
    }, 75)
  }

  function togglePart(id: string) {
    setPartActivo(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setNivel(id: string, nivel: number) {
    setPartMap(prev => ({ ...prev, [id]: { ...prev[id], nivel, obs: prev[id]?.obs ?? '' } }))
  }

  function setObs(id: string, obs: string) {
    setPartMap(prev => ({ ...prev, [id]: { nivel: prev[id]?.nivel ?? null, obs } }))
  }

  function guardar() {
    startTransition(async () => {
      const datos = miembros
        .filter(s => partActivo.has(s.id))
        .map(s => ({
          estudianteId: s.id,
          nivel: partMap[s.id]?.nivel ?? null,
          observacion: partMap[s.id]?.obs || null,
        }))
      if (datos.length > 0) {
        const { registrarParticipacion } = await import('@/lib/actions/asistencia')
        await registrarParticipacion(cursoId, fecha, datos)
      }
      onSaved()
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <button onClick={onVolver} className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-0.5 block">
            ← Grupos
          </button>
          <h3 className="font-bold text-white text-base">{grupo.nombre}</h3>
        </div>
        {isSaved && (
          <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/50 px-2 py-1 rounded-lg">
            ✓ Guardado
          </span>
        )}
      </div>

      {/* Sortear expositor */}
      {miembros.length > 0 && (
        <div className="mb-3 space-y-2">
          <div
            className={`h-11 flex items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
              expositElegidoId
                ? 'border-amber-600 bg-amber-900/30 text-amber-200'
                : 'border-gray-700 bg-gray-800/60 text-gray-500'
            }`}
          >
            {expositTicker || '— sortear expositor —'}
          </div>
          <button
            onClick={sortearExpositor}
            disabled={expositGirando}
            className="w-full py-2 rounded-lg border border-amber-700/60 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 text-xs font-medium transition-colors disabled:opacity-40"
          >
            {expositGirando ? 'Sorteando…' : '🎲 Sortear expositor'}
          </button>
        </div>
      )}

      {/* Lista de miembros */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {miembros.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">Sin integrantes asignados</p>
        ) : (
          miembros.map(s => {
            const estado = asistencia[s.id]
            const conPart = partActivo.has(s.id)
            const esElegido = expositElegidoId === s.id
            return (
              <div key={s.id} className={`p-2.5 rounded-lg border space-y-2 transition-colors ${
                esElegido
                  ? 'bg-amber-900/20 border-amber-600/60'
                  : 'bg-gray-800/60 border-gray-700/50'
              }`}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium flex-1 truncate flex items-center gap-1.5">
                    {esElegido && <span className="text-amber-400">🎤</span>}
                    <span className={esElegido ? 'text-amber-200' : 'text-gray-200'}>{formatNombreCorto(s.nombre)}</span>
                  </p>
                  {/* P/A/F */}
                  <div className="flex gap-1 shrink-0">
                    {(['Presente', 'Atraso', 'Ausente'] as const).map(e => (
                      <button key={e} onClick={() => onAsistencia(s.id, e)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          estado === e
                            ? e === 'Presente' ? 'bg-emerald-600 text-white'
                              : e === 'Atraso' ? 'bg-amber-600 text-white'
                              : 'bg-red-600 text-white'
                            : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                        }`}>
                        {e === 'Presente' ? 'P' : e === 'Atraso' ? 'A' : 'F'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Checkbox participación */}
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={conPart} onChange={() => togglePart(s.id)} className="accent-indigo-500" />
                  Calificar participación
                </label>
                {/* Notas en curso del miembro */}
                {(ecActividades ?? []).length > 0 && (() => {
                  const pendientes = (ecActividades ?? []).filter(a => (ecIndex?.get(`${s.id}|${a}`)?.nota ?? null) === null)
                  if (pendientes.length === 0) return (
                    <p className="text-[10px] text-emerald-400 pl-1">📊 Notas al día</p>
                  )
                  return (
                    <div className="pl-1 space-y-1">
                      <p className="text-[10px] text-gray-500">📊 Notas pend.: <span className="text-violet-400">{pendientes.join(', ')}</span></p>
                      <div className="flex flex-wrap gap-1">
                        {pendientes.map(a => {
                          const entry = ecIndex?.get(`${s.id}|${a}`)
                          const parcial = entry?.parcial ?? 1
                          const esteEditando = ecEditando?.estudianteId === s.id && ecEditando?.nombreItem === a
                          return (
                            <div key={a} className="flex items-center gap-0.5">
                              <span className="text-[10px] text-gray-500">{a}:</span>
                              {esteEditando ? (
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number" min={0} max={10} step={0.1}
                                    value={ecEditando!.nota}
                                    onChange={e => setEcEditando?.(ecEditando ? { ...ecEditando, nota: e.target.value } : null)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') guardarEcNota?.(s.id, a, parcial, ecEditando!.nota)
                                      if (e.key === 'Escape') setEcEditando?.(null)
                                    }}
                                    className="w-10 text-center text-[10px] rounded border border-gray-600 bg-gray-800 text-gray-100 px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    autoFocus
                                  />
                                  <button onClick={() => guardarEcNota?.(s.id, a, parcial, ecEditando!.nota)} disabled={ecPending} className="text-green-400 text-[10px]">✓</button>
                                  <button onClick={() => setEcEditando?.(null)} className="text-gray-600 text-[10px]">✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEcEditando?.({ estudianteId: s.id, nombreItem: a, parcial, nota: '' })}
                                  className="text-[10px] text-gray-600 hover:text-violet-400 font-mono"
                                  title="Clic para calificar"
                                >—</button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
                {conPart && (
                  <div className="pl-4 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setNivel(s.id, n)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            partMap[s.id]?.nivel === n
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}>
                          {NIVEL_LABELS[n]}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={partMap[s.id]?.obs ?? ''}
                      onChange={e => setObs(s.id, e.target.value)}
                      placeholder="Observación (opcional)"
                      className="input text-xs w-full"
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Guardar participación */}
      <button
        onClick={guardar}
        disabled={isPending || isSaved || partActivo.size === 0}
        className="w-full btn-primary py-2.5 text-sm disabled:opacity-40"
      >
        {isPending ? 'Guardando…' : isSaved ? '✓ Participación guardada' : `Guardar participación (${partActivo.size})`}
      </button>
    </div>
  )
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
  gruposIniciales, categorias, gruposUltimaSesion, plantillas = [],
  itemsEnCurso = [], numParciales = 2,
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
    for (const s of students) map[s.id] = 'Presente'
    for (const a of asistenciaInicial) map[a.estudiante_id] = a.estado as EstadoA
    return map
  })

  // Estado de participación inline
  const [partAbierto, setPartAbierto] = useState<Set<string>>(new Set())
  const [partData, setPartData] = useState<Record<string, { nivel: number | null; obs: string }>>({})

  // En Curso expandible por estudiante (inline, como participación)
  const [ecAbierto, setEcAbierto] = useState<Set<string>>(new Set())
  const [ecEditando, setEcEditando] = useState<{ estudianteId: string; nombreItem: string; parcial: number; nota: string } | null>(null)
  const [ecPending, startEcTransition] = useTransition()
  const ecItems = itemsEnCurso ?? []
  const ecActividades = [...new Set(ecItems.map(i => i.nombre_item))].sort()
  const ecIndex = new Map<string, { nota: number | null; parcial: number }>()
  for (const item of ecItems) {
    const key = `${item.estudiante_id}|${item.nombre_item}`
    if (!ecIndex.has(key)) ecIndex.set(key, { nota: item.nota, parcial: item.parcial })
  }
  const ecTotal = ecActividades.length
  function guardarEcNota(estudianteId: string, nombreItem: string, parcial: number, notaStr: string) {
    const nota = notaStr === '' ? null : parseFloat(notaStr)
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) return
    startEcTransition(async () => {
      await upsertItemEnCurso({ cursoId, estudianteId, parcial, nombreItem, nota })
      setEcEditando(null)
    })
  }
  function toggleEc(id: string) {
    setEcAbierto(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleTodosEc() {
    setEcAbierto(prev => prev.size === students.length ? new Set() : new Set(students.map(s => s.id)))
  }

  // Ficha del estudiante (drawer)
  const [fichaId, setFichaId] = useState<string | null>(null)

  // Vista de asistencia: todos (compacto) | uno (focalizado)
  const [asistenciaVista, setAsistenciaVista] = useState<'todos' | 'uno'>('todos')
  const [unoIdx, setUnoIdx] = useState(0)

  // Cache de fichas cargadas para la vista Uno por uno
  const [fichaCache, setFichaCache] = useState<Record<string, FichaEstudianteData>>({})
  const [fichaLoading, setFichaLoading] = useState(false)

  // Toggle info sensible + estado inline
  const [sensibleOn, toggleSensible] = useSensibleToggle()
  const [sensibleAbierto, setSensibleAbierto] = useState(false)
  const [notaUno, setNotaUno] = useState('')
  const [notaGuardando, setNotaGuardando] = useState(false)
  const [confirmarLimpiarUno, setConfirmarLimpiarUno] = useState(false)
  const [limpiarMsg, setLimpiarMsg] = useState<string | null>(null)
  const [, startLimpiarT] = useTransition()

  const NIVEL_COLORS_A = ['', 'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 'bg-lime-600', 'bg-emerald-600']
  const NIVEL_LABELS_A = ['', '1·Nula', '2·Baja', '3·Media', '4·Alta', '5·Excel']
  const safeIdx = Math.min(unoIdx, Math.max(0, students.length - 1))
  const estudianteUno = students[safeIdx] ?? null

  // Cargar ficha del estudiante enfocado en vista Uno por uno (con caché)
  useEffect(() => {
    if (asistenciaVista !== 'uno' || !estudianteUno) return
    if (fichaCache[estudianteUno.id]) {
      setNotaUno((fichaCache[estudianteUno.id].estudiante.nota_incidencia as string | null) ?? '')
      setConfirmarLimpiarUno(false)
      setLimpiarMsg(null)
      return
    }
    setFichaLoading(true)
    getFichaEstudiante(estudianteUno.id, cursoId, bitacoraId).then(res => {
      if ('error' in res) return
      setFichaCache(prev => ({ ...prev, [estudianteUno.id]: res }))
      setNotaUno((res.estudiante.nota_incidencia as string | null) ?? '')
      setConfirmarLimpiarUno(false)
      setLimpiarMsg(null)
    }).finally(() => setFichaLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asistenciaVista, estudianteUno?.id])

  function togglePart(estudianteId: string) {
    setPartAbierto(prev => {
      const next = new Set(prev)
      if (next.has(estudianteId)) next.delete(estudianteId)
      else next.add(estudianteId)
      return next
    })
  }

  function setNivelPart(estudianteId: string, nivel: number) {
    setPartData(prev => ({ ...prev, [estudianteId]: { ...prev[estudianteId], nivel, obs: prev[estudianteId]?.obs ?? '' } }))
    startTransition(() => {
      registrarParticipacion(cursoId, fecha, [{
        estudianteId,
        nivel,
        observacion: partData[estudianteId]?.obs ?? null,
      }])
    })
  }

  function setObsPart(estudianteId: string, obs: string) {
    setPartData(prev => ({ ...prev, [estudianteId]: { ...prev[estudianteId], obs, nivel: prev[estudianteId]?.nivel ?? null } }))
  }

  function guardarObsPart(estudianteId: string) {
    const d = partData[estudianteId]
    if (!d?.obs?.trim() && d?.nivel == null) return
    startTransition(() => {
      registrarParticipacion(cursoId, fecha, [{
        estudianteId,
        nivel: d?.nivel ?? null,
        observacion: d?.obs?.trim() || null,
      }])
    })
  }

  function toggleTodosParticipacion() {
    const allOpen = students.every(s => partAbierto.has(s.id))
    setPartAbierto(allOpen ? new Set() : new Set(students.map(s => s.id)))
  }

  function marcarAsistencia(estudianteId: string, estado: 'Presente' | 'Ausente' | 'Atraso') {
    setAsistencia(prev => ({ ...prev, [estudianteId]: estado }))
    const partEntry = partData[estudianteId]
    const horas = estado === 'Ausente'
      ? 0
      : estado === 'Atraso'
        ? Math.max(1, Math.round(horasClase / 2))
        : horasClase

    startTransition(() => {
      registrarAsistenciaMasiva(cursoId, fecha, [{
        estudiante_id: estudianteId,
        estado,
        atraso: estado === 'Atraso',
        horas,
        participacion: partEntry?.nivel ?? null,
        observacion_participacion: partEntry?.obs?.trim() || null,
      }], bitacoraId)
    })
  }

  const marcados = Object.values(asistencia).filter(Boolean).length

  // ── Grupos ─────────────────────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<GrupoItem[]>(gruposIniciales)
  const [grupoActivoId, setGrupoActivoId] = useState<string | null>(null)
  const [gruposExcluidos, setGruposExcluidos] = useState<Set<string>>(new Set())
  const [autoExcluirGrupo, setAutoExcluirGrupo] = useState(true)
  const [savedGrupos, setSavedGrupos] = useState<Set<string>>(new Set())
  const [ordenGrupos, setOrdenGrupos] = useState<string[]>([])

  async function refreshGrupos() {
    const data = await getGruposDeSesion(bitacoraId, cursoId)
    setGrupos(data.grupos as GrupoItem[])
  }
  const [tabDerecha, setTabDerecha] = useState<'asistencia' | 'grupos' | 'en_curso'>('asistencia')

  // ── Tab móvil ─────────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<'actividades' | 'asistencia' | 'grupos' | 'en_curso'>('actividades')

  function setMobileAndDerecha(tab: 'actividades' | 'asistencia' | 'grupos' | 'en_curso') {
    setMobileTab(tab)
    if (tab === 'asistencia' || tab === 'grupos') {
      setTabDerecha(tab)
      if (tab === 'grupos') refreshGrupos()
    }
  }

  function switchToGrupos() {
    setTabDerecha('grupos')
    setMobileTab('grupos')
    refreshGrupos()
  }

  // ── Traslado de actividades ───────────────────────────────────────────────
  type ClaseDestinoInfo = { id: string; fecha: string; tema: string | null }
  const [trasladandoPanel, setTrasladandoPanel] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<Set<number>>(new Set())
  const [clasesDestino, setClasesDestino] = useState<ClaseDestinoInfo[] | 'loading' | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move')
  const [trasladandoSaving, setTrasladandoSaving] = useState(false)
  const [trasladandoError, setTrasladandoError] = useState<string | null>(null)
  const [trasladandoOk, setTrasladandoOk] = useState(false)

  async function abrirTrasladar() {
    setTrasladandoPanel(true)
    setSelectedTransfer(new Set())
    setTrasladandoOk(false)
    setTrasladandoError(null)
    setClasesDestino('loading')
    setSelectedTargetId(null)
    setTransferMode('move')
    const futuras = await getClasesFuturas(bitacoraId)
    setClasesDestino(futuras.length > 0 ? futuras : null)
    if (futuras.length > 0) setSelectedTargetId(futuras[0].id)
  }

  async function confirmarTrasladar() {
    if (selectedTransfer.size === 0 || !selectedTargetId) return
    setTrasladandoSaving(true)
    setTrasladandoError(null)
    const result = await trasladarActividades(bitacoraId, Array.from(selectedTransfer), selectedTargetId, transferMode)
    if (result.error) {
      setTrasladandoError(result.error)
      setTrasladandoSaving(false)
      return
    }
    if (transferMode === 'move') {
      const remaining = actividades.filter((_, i) => !selectedTransfer.has(i))
      updateActividades(remaining)
    }
    setTrasladandoSaving(false)
    setTrasladandoOk(true)
    setTimeout(() => {
      setTrasladandoPanel(false)
      setTrasladandoOk(false)
    }, 2000)
  }

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
    // Flush completo antes de finalizar — evita pérdida por requests fire-and-forget
    // aún en vuelo cuando el usuario navega después del overlay.
    const registrosFlush = students.map(s => {
      const estado = asistencia[s.id] ?? 'Ausente'
      const partEntry = partData[s.id]
      const horas = estado === 'Ausente'
        ? 0
        : estado === 'Atraso'
          ? Math.max(1, Math.round(horasClase / 2))
          : horasClase
      return {
        estudiante_id: s.id,
        estado,
        atraso: estado === 'Atraso',
        horas,
        participacion: partEntry?.nivel ?? null,
        observacion_participacion: partEntry?.obs?.trim() || null,
      }
    })
    await registrarAsistenciaMasiva(cursoId, fecha, registrosFlush, bitacoraId)
    await confirmarCumplido(bitacoraId)
    setFinalizando(false)
    setConfirmando(false)
    setClaseGuardada(true)
  }

  async function handleDetener() {
    setDeteniendo(true)
    await detenerClase(bitacoraId)
    router.back()
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
              onClick={() => router.back()}
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
          <button
            onClick={() => router.back()}
            className="flex-shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Salir</span>
          </button>
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
          onClick={() => setMobileAndDerecha('actividades')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'actividades' ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-600/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Actividades {actividades.length > 0 && `(${completadas}/${actividades.length})`}
        </button>
        <button
          onClick={() => setMobileAndDerecha('asistencia')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'asistencia' ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-600/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Asistencia ({marcados}/{students.length})
        </button>
        <button
          onClick={() => setMobileAndDerecha('grupos')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'grupos' ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-600/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Grupos {grupos.length > 0 && `(${grupos.length})`}
        </button>
        {itemsEnCurso.length > 0 && (
          <button
            onClick={() => setMobileAndDerecha('en_curso')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'en_curso' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-600/5' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Notas en curso
          </button>
        )}
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
                    <Agrupacion
                      students={students}
                      cursoId={cursoId}
                      bitacoraId={bitacoraId}
                      categorias={categorias}
                      gruposUltimaSesion={gruposUltimaSesion}
                      plantillas={plantillas}
                      onSaved={refreshGrupos}
                    />
                    <button
                      onClick={() => { setToolOpen(null); switchToGrupos() }}
                      className="mt-3 w-full text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-800 hover:border-emerald-600 rounded-lg py-1.5 transition-colors"
                    >
                      ✓ Listo — ir a tomar asistencia por grupos →
                    </button>
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

            {/* Trasladar actividad a siguiente clase */}
            {actividades.length > 0 && !trasladandoPanel && (
              <button
                onClick={abrirTrasladar}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-amber-700/50 text-amber-600 hover:border-amber-600 hover:text-amber-400 hover:bg-amber-900/10 transition-colors text-sm"
              >
                <span className="text-base leading-none">→</span> Trasladar actividades a otro plan
              </button>
            )}

            {/* Panel de traslado */}
            {trasladandoPanel && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-900/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-300">Trasladar actividades</p>
                  <button
                    onClick={() => setTrasladandoPanel(false)}
                    className="text-gray-500 hover:text-gray-300 text-sm leading-none"
                  >
                    ✕
                  </button>
                </div>

                {clasesDestino === 'loading' && (
                  <p className="text-xs text-gray-500">Buscando clases futuras…</p>
                )}
                {clasesDestino === null && (
                  <p className="text-xs text-red-400">No hay clases futuras planificadas. Crea un plan primero.</p>
                )}
                {clasesDestino && clasesDestino !== 'loading' && (
                  <>
                    {/* Selector de destino */}
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Destino:</p>
                      <select
                        value={selectedTargetId ?? ''}
                        onChange={e => setSelectedTargetId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-600"
                      >
                        {clasesDestino.map(c => (
                          <option key={c.id} value={c.id}>
                            {formatFecha(c.fecha)}{c.tema ? ` · ${c.tema.slice(0, 40)}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Toggle copiar / mover */}
                    <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 w-fit">
                      {(['move', 'copy'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setTransferMode(m)}
                          className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${
                            transferMode === m
                              ? 'bg-amber-700 text-white'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {m === 'move' ? 'Mover' : 'Copiar'}
                        </button>
                      ))}
                    </div>
                    {transferMode === 'copy' && (
                      <p className="text-[10px] text-gray-500">La actividad queda también en este plan.</p>
                    )}

                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Selecciona las actividades:</p>
                      {actividades.map((a, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-800/40 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTransfer.has(i)}
                            onChange={e => {
                              const next = new Set(selectedTransfer)
                              if (e.target.checked) next.add(i)
                              else next.delete(i)
                              setSelectedTransfer(next)
                            }}
                            className="accent-amber-500 w-4 h-4 flex-shrink-0"
                          />
                          <span className={`text-sm flex-1 truncate ${a.completada ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                            {a.actividad}
                          </span>
                          {a.completada && (
                            <span className="text-xs text-emerald-600 flex-shrink-0">✓</span>
                          )}
                        </label>
                      ))}
                    </div>

                    {trasladandoError && (
                      <p className="text-xs text-red-400">{trasladandoError}</p>
                    )}
                    {trasladandoOk && (
                      <p className="text-xs text-emerald-400 text-center">✓ {transferMode === 'move' ? 'Actividades movidas' : 'Actividades copiadas'}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={confirmarTrasladar}
                        disabled={selectedTransfer.size === 0 || trasladandoSaving || !selectedTargetId}
                        className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        {trasladandoSaving
                          ? (transferMode === 'move' ? 'Moviendo…' : 'Copiando…')
                          : `${transferMode === 'move' ? 'Mover' : 'Copiar'}${selectedTransfer.size > 0 ? ` (${selectedTransfer.size})` : ''}`}
                      </button>
                      <button
                        onClick={() => setTrasladandoPanel(false)}
                        className="btn-ghost text-xs px-3 py-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
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

        {/* ── Columna derecha: Asistencia / Grupos ── */}
        <div className={`w-full md:w-96 flex-shrink-0 flex-col overflow-hidden ${mobileTab !== 'actividades' ? 'flex' : 'hidden md:flex'}`}>
          {/* Tabs de la columna derecha */}
          <div className="flex-shrink-0 flex border-b border-gray-800">
            <button
              onClick={() => setTabDerecha('asistencia')}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${tabDerecha === 'asistencia' ? 'text-gray-200 border-b-2 border-gray-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Asistencia ({marcados}/{students.length})
            </button>
            <button
              onClick={() => setTabDerecha('grupos')}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${tabDerecha === 'grupos' ? 'text-gray-200 border-b-2 border-gray-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Grupos {grupos.length > 0 && `(${grupos.length})`}
            </button>
            {itemsEnCurso.length > 0 && (
              <button
                onClick={() => setTabDerecha(tabDerecha === 'en_curso' ? 'asistencia' : 'en_curso')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${tabDerecha === 'en_curso' ? 'text-violet-300 border-b-2 border-violet-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Notas en curso
              </button>
            )}
          </div>

          {/* Panel Asistencia */}
          {tabDerecha === 'asistencia' && (<>
          {/* Toolbar: toggle vista + acción masiva */}
          <div className="flex-shrink-0 px-3 pt-2 pb-2 border-b border-gray-800/60 space-y-2">
            {/* Toggle vista */}
            <div className="flex gap-1 bg-gray-800/60 rounded-lg p-0.5">
              <button
                onClick={() => setAsistenciaVista('todos')}
                className={`flex-1 text-xs py-1 rounded-md transition-colors font-medium ${asistenciaVista === 'todos' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Lista
              </button>
              <button
                onClick={() => { setAsistenciaVista('uno'); setUnoIdx(0) }}
                className={`flex-1 text-xs py-1 rounded-md transition-colors font-medium ${asistenciaVista === 'uno' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Uno por uno
              </button>
            </div>
            {/* Acciones masivas solo en vista lista */}
            {asistenciaVista === 'todos' && (
              <div className="flex gap-1.5">
                <button
                  onClick={toggleTodosParticipacion}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                    students.every(s => partAbierto.has(s.id))
                      ? 'border-brand-600 text-brand-400 bg-brand-900/20 hover:bg-brand-900/10'
                      : 'border-gray-700 text-gray-500 hover:border-brand-600/60 hover:text-brand-400 hover:bg-brand-900/10'
                  }`}
                >
                  ★ {students.every(s => partAbierto.has(s.id)) ? 'Cerrar participación' : 'Abrir participación'}
                </button>
                {ecTotal > 0 && (
                  <button
                    onClick={() => toggleTodosEc()}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                      ecAbierto.size === students.length
                        ? 'border-violet-600 text-violet-400 bg-violet-900/20'
                        : 'border-gray-700 text-gray-500 hover:border-violet-600/60 hover:text-violet-400 hover:bg-violet-900/10'
                    }`}
                  >
                    📊 {ecAbierto.size === students.length ? 'Cerrar notas' : 'Notas en curso'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── VISTA LISTA (compacta) ── */}
          {asistenciaVista === 'todos' && (() => {
            return (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {students.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Sin estudiantes</p>
              ) : (
                students.map(s => {
                  const estado = asistencia[s.id]
                  const abierto = partAbierto.has(s.id)
                  const ecOpen = ecAbierto.has(s.id)
                  const pd = partData[s.id]
                  const nivelActual = pd?.nivel ?? null
                  return (
                    <div key={s.id} className="rounded-lg hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="flex-1 text-sm text-gray-300 truncate flex items-center gap-2">
                          {formatNombreCorto(s.nombre)}
                          {s.tutoria && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300 border border-blue-700">
                              📘
                            </span>
                          )}
                        </span>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => marcarAsistencia(s.id, 'Presente')} title="Presente"
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${estado === 'Presente' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-emerald-900 hover:text-emerald-400'}`}>P</button>
                          <button onClick={() => marcarAsistencia(s.id, 'Atraso')} title="Atraso"
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${estado === 'Atraso' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-amber-900 hover:text-amber-400'}`}>A</button>
                          <button onClick={() => marcarAsistencia(s.id, 'Ausente')} title="Ausente"
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${estado === 'Ausente' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-red-900 hover:text-red-400'}`}>F</button>
                          <button onClick={() => togglePart(s.id)} title="Participación"
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${abierto || nivelActual ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-brand-900 hover:text-brand-400'}`}>
                            {nivelActual ?? '★'}
                          </button>
                          <button onClick={() => setFichaId(s.id)} title="Ver ficha del estudiante"
                            className="w-7 h-7 rounded text-xs font-bold transition-colors bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-brand-400">
                            ⓘ
                          </button>
                          {ecActividades.length > 0 && (
                            <button onClick={() => toggleEc(s.id)} title="Ver En Curso"
                              className={`w-7 h-7 rounded text-xs font-bold transition-colors ${ecOpen ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-500 hover:bg-violet-900 hover:text-violet-400'}`}>
                              📊
                            </button>
                          )}
                        </div>
                      </div>
                      {abierto && (
                        <div className="px-2 pb-2 space-y-1.5">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => setNivelPart(s.id, n)} title={NIVEL_LABELS_A[n]}
                                className={`flex-1 h-6 rounded text-[10px] font-bold transition-colors ${nivelActual === n ? `${NIVEL_COLORS_A[n]} text-white` : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={pd?.obs ?? ''}
                            onChange={e => setObsPart(s.id, e.target.value)}
                            onBlur={() => guardarObsPart(s.id)}
                            placeholder="Observación…"
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-600"
                          />
                        </div>
                      )}
                      {/* ── En Curso expandible ── */}
                      {ecOpen && ecActividades.length > 0 && (() => {
                        const pendientes = ecActividades.filter(a => (ecIndex.get(`${s.id}|${a}`)?.nota ?? null) === null)
                        if (pendientes.length === 0) return (
                          <div className="px-2 pb-2 text-[10px] text-emerald-400">✓ Todas las actividades calificadas</div>
                        )
                        return (
                          <div className="px-2 pb-2">
                            <table className="w-full text-[10px] border-collapse">
                              <thead>
                                <tr>
                                  {pendientes.map(a => (
                                    <th key={a} className="px-1 py-0.5 text-center text-gray-500 font-medium border border-gray-800 max-w-[60px]">
                                      <span className="truncate block max-w-[56px]" title={a}>{a}</span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {pendientes.map(a => {
                                    const entry = ecIndex.get(`${s.id}|${a}`)
                                    const parcial = entry?.parcial ?? 1
                                    const esteEditando = ecEditando?.estudianteId === s.id && ecEditando?.nombreItem === a
                                    return (
                                      <td key={a} className="px-1 py-0.5 text-center border border-gray-800">
                                        {esteEditando ? (
                                          <div className="flex items-center gap-0.5 justify-center">
                                            <input
                                              type="number" min={0} max={10} step={0.1}
                                              value={ecEditando!.nota}
                                              onChange={e => setEcEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') guardarEcNota(s.id, a, parcial, ecEditando!.nota)
                                                if (e.key === 'Escape') setEcEditando(null)
                                              }}
                                              className="w-10 text-center text-[10px] rounded border border-gray-600 bg-gray-800 text-gray-100 px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                              autoFocus
                                            />
                                            <button onClick={() => guardarEcNota(s.id, a, parcial, ecEditando!.nota)} disabled={ecPending}
                                              className="text-green-400 hover:text-green-300 text-[10px]">✓</button>
                                            <button onClick={() => setEcEditando(null)} className="text-gray-600 hover:text-gray-400 text-[10px]">✕</button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setEcEditando({ estudianteId: s.id, nombreItem: a, parcial, nota: '' })}
                                            className="text-gray-600 hover:text-violet-400 font-mono w-full text-center"
                                            title="Clic para calificar"
                                          >
                                            —
                                          </button>
                                        )}
                                      </td>
                                    )
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })
              )}
            </div>
            )
          })()}

          {/* ── VISTA UNO POR UNO ── */}
          {asistenciaVista === 'uno' && estudianteUno && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mini dots de progreso */}
              <div className="flex-shrink-0 px-3 py-2 flex flex-wrap gap-1 justify-center">
                {students.map((s, i) => {
                  const est = asistencia[s.id]
                  return (
                    <button
                      key={s.id}
                      onClick={() => setUnoIdx(i)}
                      title={s.nombre}
                      className={`w-3 h-3 rounded-sm transition-all ${
                        i === safeIdx ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-950' : ''
                      } ${
                        est === 'Presente' ? 'bg-emerald-600/70'
                        : est === 'Atraso'  ? 'bg-amber-600/70'
                        : est === 'Ausente' ? 'bg-red-600/70'
                        : 'bg-gray-700'
                      }`}
                    />
                  )
                })}
              </div>

              {/* Tarjeta focalizada */}
              <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-3">

                {/* ── Cabecera: nombre + botón drawer completo ── */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white leading-tight">{estudianteUno.nombre}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {safeIdx + 1} de {students.length}
                      {estudianteUno.tutoria && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-900/40 border border-blue-800 rounded text-[10px] text-blue-400">📘</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setFichaId(estudianteUno.id)}
                    title="Abrir ficha completa"
                    className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-800 border border-gray-700 text-gray-400 hover:text-brand-400 hover:border-brand-700 rounded-full transition-colors"
                  >
                    ⓘ Ficha
                  </button>
                </div>

                {/* ── Botones P / A / F ── */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { est: 'Presente' as EstadoA, label: 'Presente', active: 'bg-emerald-600 text-white border-emerald-500', inactive: 'bg-gray-800 text-gray-400 border-gray-700 hover:border-emerald-700 hover:text-emerald-400' },
                    { est: 'Atraso'   as EstadoA, label: 'Atraso',   active: 'bg-amber-600 text-white border-amber-500',   inactive: 'bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-700 hover:text-amber-400' },
                    { est: 'Ausente'  as EstadoA, label: 'Falta',    active: 'bg-red-600 text-white border-red-500',       inactive: 'bg-gray-800 text-gray-400 border-gray-700 hover:border-red-700 hover:text-red-400' },
                  ]).map(b => (
                    <button
                      key={b.label}
                      onClick={() => marcarAsistencia(estudianteUno.id, b.est!)}
                      className={`py-2.5 rounded-lg border text-xs font-bold transition-all ${
                        asistencia[estudianteUno.id] === b.est ? b.active : b.inactive
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* ── Participación ── */}
                {asistencia[estudianteUno.id] !== 'Ausente' && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Participación</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => {
                        const nivelActual = partData[estudianteUno.id]?.nivel ?? null
                        return (
                          <button
                            key={n}
                            onClick={() => setNivelPart(estudianteUno.id, n)}
                            title={NIVEL_LABELS_A[n]}
                            className={`flex-1 h-8 rounded text-xs font-bold transition-colors ${
                              nivelActual === n ? `${NIVEL_COLORS_A[n]} text-white` : 'bg-gray-800 text-gray-500 hover:text-white'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      value={partData[estudianteUno.id]?.obs ?? ''}
                      onChange={e => setObsPart(estudianteUno.id, e.target.value)}
                      onBlur={() => guardarObsPart(estudianteUno.id)}
                      placeholder="Observación de participación…"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                )}

                {/* ── Notas en curso ── */}
                {ecTotal > 0 && (() => {
                  const pendientes = ecActividades.filter(a => (ecIndex.get(`${estudianteUno.id}|${a}`)?.nota ?? null) === null)
                  if (pendientes.length === 0) return (
                    <p className="text-[10px] text-emerald-400">📊 Todas las notas en curso registradas</p>
                  )
                  return (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Notas en curso <span className="text-violet-400 normal-case font-normal">({pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''})</span>
                      </p>
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr>
                            {pendientes.map(a => (
                              <th key={a} className="px-1 py-0.5 text-center text-gray-500 font-medium border border-gray-800">
                                <span className="truncate block max-w-[56px]" title={a}>{a}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {pendientes.map(a => {
                              const entry = ecIndex.get(`${estudianteUno.id}|${a}`)
                              const parcial = entry?.parcial ?? 1
                              const esteEditando = ecEditando?.estudianteId === estudianteUno.id && ecEditando?.nombreItem === a
                              return (
                                <td key={a} className="px-1 py-0.5 text-center border border-gray-800">
                                  {esteEditando ? (
                                    <div className="flex items-center gap-0.5 justify-center">
                                      <input
                                        type="number" min={0} max={10} step={0.1}
                                        value={ecEditando!.nota}
                                        onChange={e => setEcEditando(prev => prev ? { ...prev, nota: e.target.value } : null)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') guardarEcNota(estudianteUno.id, a, parcial, ecEditando!.nota)
                                          if (e.key === 'Escape') setEcEditando(null)
                                        }}
                                        className="w-10 text-center text-[10px] rounded border border-gray-600 bg-gray-800 text-gray-100 px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        autoFocus
                                      />
                                      <button onClick={() => guardarEcNota(estudianteUno.id, a, parcial, ecEditando!.nota)} disabled={ecPending} className="text-green-400 hover:text-green-300 text-[10px]">✓</button>
                                      <button onClick={() => setEcEditando(null)} className="text-gray-600 hover:text-gray-400 text-[10px]">✕</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setEcEditando({ estudianteId: estudianteUno.id, nombreItem: a, parcial, nota: '' })}
                                      className="text-gray-600 hover:text-violet-400 font-mono w-full text-center"
                                      title="Clic para calificar"
                                    >—</button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })()}

                {/* ── Datos del estudiante (carga lazy) ── */}
                {fichaLoading && (
                  <div className="space-y-2 pt-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
                    ))}
                  </div>
                )}

                {fichaCache[estudianteUno.id] && (() => {
                  const f = fichaCache[estudianteUno.id]
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const enc = f.encuesta as Record<string, any> | null
                  return (
                    <div className="space-y-3 border-t border-gray-800 pt-3">

                      {/* Stats rápidos */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          {
                            label: 'Asistencia',
                            value: f.asistencia.pct != null ? `${f.asistencia.pct}%` : '—',
                            color: f.asistencia.pct == null ? 'text-gray-400'
                              : f.asistencia.pct >= 80 ? 'text-emerald-400'
                              : f.asistencia.pct >= 60 ? 'text-yellow-400' : 'text-red-400',
                          },
                          {
                            label: 'Part. prom.',
                            value: f.participacion.promedio != null ? `${f.participacion.promedio}/5` : '—',
                            color: 'text-brand-400',
                          },
                          {
                            label: 'Trabajos',
                            value: String(f.trabajos.activos),
                            color: f.trabajos.activos > 0 ? 'text-amber-400' : 'text-gray-400',
                          },
                        ].map(s => (
                          <div key={s.label} className="text-center bg-gray-800/50 rounded-lg py-1.5 px-1">
                            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-[9px] text-gray-600 leading-tight">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Carrera y modalidad */}
                      {enc && (
                        <div className="flex gap-2 flex-wrap">
                          {enc.carrera && <span className="px-2 py-0.5 bg-gray-800 rounded text-[11px] text-gray-300">{enc.carrera}</span>}
                          {enc.modalidad_carrera && <span className="px-2 py-0.5 bg-gray-800 rounded text-[11px] text-gray-400">{enc.modalidad_carrera}</span>}
                          {enc.nivel_estudio && <span className="px-2 py-0.5 bg-gray-800 rounded text-[11px] text-gray-400 capitalize">{enc.nivel_estudio}</span>}
                        </div>
                      )}

                      {/* Último trabajo */}
                      {f.trabajos.ultimo && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Trabajo activo</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-300 truncate">
                              <span className="font-medium">{f.trabajos.ultimo.tipo}</span>
                              {f.trabajos.ultimo.tema ? ` · ${f.trabajos.ultimo.tema}` : ''}
                            </p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border font-medium ${
                              f.trabajos.ultimo.estado === 'Pendiente' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
                              : f.trabajos.ultimo.estado === 'En progreso' ? 'text-blue-400 bg-blue-900/30 border-blue-800'
                              : f.trabajos.ultimo.estado === 'Entregado' ? 'text-purple-400 bg-purple-900/30 border-purple-800'
                              : 'text-gray-400 bg-gray-800 border-gray-700'
                            }`}>
                              {f.trabajos.ultimo.estado ?? '—'}
                            </span>
                          </div>
                          {f.trabajos.ultimo.progreso > 0 && (
                            <div className="w-full bg-gray-800 h-1 rounded-full">
                              <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${f.trabajos.ultimo.progreso}%` }} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Última obs de clase */}
                      {f.asistencia.ultimaObs && (
                        <div className="border-l-2 border-blue-800 pl-2">
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            Última obs. de clase
                            <span className="text-gray-600 ml-1">
                              ({new Date(f.asistencia.ultimaObs.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})
                            </span>
                          </p>
                          <p className="text-[11px] text-gray-400 italic line-clamp-2">"{f.asistencia.ultimaObs.obs}"</p>
                        </div>
                      )}

                      {/* Citaciones vigentes */}
                      {f.citaciones.pendientes > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                          <span className="text-blue-400 text-xs">📘</span>
                          <p className="text-[11px] text-blue-300">
                            {f.citaciones.pendientes} citación{f.citaciones.pendientes > 1 ? 'es' : ''} vigente{f.citaciones.pendientes > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}

                      {/* Participación reciente (dots) */}
                      {f.participacion.ultimas.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Participación reciente</p>
                          <div className="flex items-center gap-1.5">
                            {f.participacion.ultimas.map((p, i) => (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${p.nivel ? NIVEL_COLORS_A[p.nivel] : 'bg-gray-700'}`}>
                                  {p.nivel ?? '—'}
                                </span>
                                <span className="text-[8px] text-gray-700">
                                  {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── INFO SENSIBLE (colapsable) ── */}
                      <div className="border border-gray-700/60 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setSensibleAbierto(prev => !prev)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">🔒 Info sensible</span>
                          <span>{sensibleAbierto ? '▲' : '▼'}</span>
                        </button>

                        {sensibleAbierto && (
                          <div className="px-3 pb-3 space-y-3 bg-gray-900/40">

                            {/* Nota privada editable */}
                            <div className="space-y-1 pt-1">
                              <label className="text-[10px] text-gray-400">📝 Nota privada del profesor</label>
                              <textarea
                                value={notaUno}
                                onChange={e => setNotaUno(e.target.value)}
                                onBlur={async () => {
                                  if (!f) return
                                  setNotaGuardando(true)
                                  await saveNotaIncidencia(f.estudiante.id, notaUno, cursoId)
                                  setFichaCache(prev => ({
                                    ...prev,
                                    [f.estudiante.id]: {
                                      ...prev[f.estudiante.id],
                                      estudiante: { ...prev[f.estudiante.id].estudiante, nota_incidencia: notaUno.trim() || null }
                                    }
                                  }))
                                  setNotaGuardando(false)
                                }}
                                rows={2}
                                maxLength={500}
                                placeholder="Recuerda preguntarle sobre..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                              />
                              {notaGuardando && <p className="text-[9px] text-gray-500">Guardando...</p>}
                            </div>

                            {/* Problema reportado */}
                            {enc?.problemas_reportados && (
                              <div className="space-y-2">
                                <div className="p-2 bg-yellow-900/10 border border-yellow-800/40 rounded-lg">
                                  <p className="text-[10px] text-yellow-500 font-medium mb-0.5">⚠ Problema reportado</p>
                                  <p className="text-[11px] text-yellow-200/70 italic">"{enc.problemas_reportados}"</p>
                                </div>
                                {!confirmarLimpiarUno ? (
                                  <button onClick={() => setConfirmarLimpiarUno(true)} className="text-[11px] text-gray-500 hover:text-gray-300">
                                    ✕ Marcar como resuelto
                                  </button>
                                ) : (
                                  <div className="border border-red-800/50 rounded-lg p-2 bg-red-900/10 space-y-1.5">
                                    <p className="text-[10px] text-red-300">¿Borrar problema reportado? No se puede deshacer.</p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          if (!f.estudiante.auth_user_id) return
                                          startLimpiarT(async () => {
                                            const res = await clearProblemas(f.estudiante.auth_user_id!, cursoId)
                                            if (!res?.error) {
                                              setFichaCache(prev => prev[f.estudiante.id]?.encuesta ? {
                                                ...prev,
                                                [f.estudiante.id]: { ...prev[f.estudiante.id], encuesta: { ...prev[f.estudiante.id].encuesta, problemas_reportados: null } }
                                              } : prev)
                                              setLimpiarMsg('Resuelto.')
                                              setConfirmarLimpiarUno(false)
                                            }
                                          })
                                        }}
                                        className="flex-1 py-1 text-[10px] rounded bg-red-900/40 border border-red-700 text-red-300 hover:bg-red-900/60"
                                      >Confirmar</button>
                                      <button
                                        onClick={() => setConfirmarLimpiarUno(false)}
                                        className="flex-1 py-1 text-[10px] rounded bg-gray-800 border border-gray-700 text-gray-300"
                                      >Cancelar</button>
                                    </div>
                                    {limpiarMsg && <p className="text-[10px] text-emerald-400">{limpiarMsg}</p>}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Datos demográficos */}
                            {enc && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                                {[
                                  { label: 'Género', value: enc.genero },
                                  { label: 'Vivienda', value: enc.situacion_vivienda },
                                  { label: 'Foráneo', value: enc.es_foraneo === true ? 'Sí' : enc.es_foraneo === false ? 'No' : null },
                                  { label: 'Dispositivo', value: enc.dispositivo_movil },
                                  { label: 'Trabaja', value: enc.trabaja === true ? 'Sí' : enc.trabaja === false ? 'No' : null },
                                  enc.trabaja && { label: 'Horas/día', value: enc.horas_trabajo_diarias != null ? `${enc.horas_trabajo_diarias}h` : null },
                                ].filter(Boolean).map((item, i) => item && (
                                  <div key={i}>
                                    <p className="text-[9px] text-gray-600">{item.label}</p>
                                    <p className="text-gray-300 capitalize">{item.value ?? 'N/A'}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Uso de IA (barra mini) */}
                            {enc && [
                              { label: 'Tareas', key: 'uso_ia_tareas' },
                              { label: 'Redacción', key: 'uso_ia_redaccion' },
                              { label: 'Ideas', key: 'uso_ia_ideas' },
                              { label: 'Crítico', key: 'uso_ia_critico' },
                            ].some(x => enc[x.key] != null) && (
                              <div className="space-y-1">
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Uso de IA</p>
                                {[
                                  { label: 'Tareas', key: 'uso_ia_tareas' },
                                  { label: 'Redacción', key: 'uso_ia_redaccion' },
                                  { label: 'Ideas', key: 'uso_ia_ideas' },
                                  { label: 'Análisis crítico', key: 'uso_ia_critico' },
                                ].map(item => enc[item.key] != null && (
                                  <div key={item.key}>
                                    <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                      <span>{item.label}</span><span>{enc[item.key]}/5</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-1 rounded-full">
                                      <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${((enc[item.key] || 0) / 5) * 100}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )
                })()}
              </div>

              {/* Navegación anterior / siguiente */}
              <div className="flex-shrink-0 flex gap-2 px-3 pb-3">
                <button
                  onClick={() => setUnoIdx(i => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                  className="flex-1 py-2 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setUnoIdx(i => Math.min(students.length - 1, i + 1))}
                  disabled={safeIdx === students.length - 1}
                  className="flex-1 py-2 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {asistenciaVista === 'uno' && students.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Sin estudiantes</p>
            </div>
          )}

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
          </>)}

          {/* Panel Grupos */}
          {tabDerecha === 'grupos' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 gap-4">
              {grupos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-8 text-center">
                  <p className="text-3xl">👥</p>
                  <p className="text-sm text-gray-300 font-medium">No hay grupos creados</p>
                  <p className="text-xs text-gray-500 max-w-[200px]">
                    Usa el botón <span className="text-white font-medium">Crear grupos</span> en la actividad de la columna izquierda.
                  </p>
                  <button
                    onClick={() => { setMobileTab('actividades'); setToolOpen('agrupacion') }}
                    className="text-sm px-4 py-2 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                  >
                    ← Crear grupos ahora
                  </button>
                  <button onClick={refreshGrupos} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                    ↻ Recargar
                  </button>
                </div>
              ) : grupoActivoId !== null ? (
                <VistGrupo
                  grupo={grupos.find(g => g.id === grupoActivoId)!}
                  students={students}
                  asistencia={asistencia}
                  onAsistencia={marcarAsistencia}
                  cursoId={cursoId}
                  fecha={fecha}
                  onVolver={() => setGrupoActivoId(null)}
                  isSaved={savedGrupos.has(grupoActivoId)}
                  onSaved={() => setSavedGrupos(prev => new Set([...prev, grupoActivoId]))}
                  ecActividades={ecActividades}
                  ecIndex={ecIndex}
                  ecEditando={ecEditando}
                  setEcEditando={setEcEditando}
                  guardarEcNota={guardarEcNota}
                  ecPending={ecPending}
                />
              ) : (
                <div className="space-y-4 overflow-y-auto flex-1">
                  {/* Ruleta de grupos */}
                  <RuletaGrupos
                    grupos={grupos}
                    excluidos={gruposExcluidos}
                    onExcluirChange={setGruposExcluidos}
                    autoExcluir={autoExcluirGrupo}
                    onAutoExcluirChange={setAutoExcluirGrupo}
                    onSeleccionar={(id) => setOrdenGrupos(prev => [...prev, id])}
                  />

                  {/* Orden de presentación */}
                  {ordenGrupos.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Orden de presentación</p>
                        <button
                          onClick={() => { setOrdenGrupos([]); setGruposExcluidos(new Set()) }}
                          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          ↺ Reiniciar
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {ordenGrupos.map((gId, i) => {
                          const g = grupos.find(x => x.id === gId)
                          if (!g) return null
                          const saved = savedGrupos.has(gId)
                          return (
                            <button
                              key={`${gId}-${i}`}
                              onClick={() => setGrupoActivoId(gId)}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
                                saved
                                  ? 'border-emerald-700/50 bg-emerald-900/10'
                                  : 'border-indigo-800/60 bg-indigo-950/30 hover:border-indigo-600'
                              }`}
                            >
                              <span className="text-indigo-400 font-bold text-sm w-6 shrink-0">{i + 1}°</span>
                              <span className="flex-1 text-sm font-medium text-gray-200">{g.nombre}</span>
                              <span className="text-xs text-gray-500">{g.grupo_integrantes.length} est.</span>
                              {saved && <span className="text-emerald-400 text-xs">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lista de grupos para acceso directo */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Acceso directo</p>
                    <div className="space-y-1.5">
                      {grupos.map((g, i) => {
                        const saved = savedGrupos.has(g.id)
                        return (
                          <button
                            key={g.id}
                            onClick={() => setGrupoActivoId(g.id)}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
                              saved
                                ? 'border-emerald-700/50 bg-emerald-900/10'
                                : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${GRUPO_DOT_COLORS[i % GRUPO_DOT_COLORS.length]}`} />
                            <span className="flex-1 text-sm font-medium text-gray-200">{g.nombre}</span>
                            <span className="text-xs text-gray-500">{g.grupo_integrantes.length} est.</span>
                            {saved && <span className="text-emerald-400 text-xs">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Panel En Curso */}
          {tabDerecha === 'en_curso' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <EnCursoVistaClase
                cursoId={cursoId}
                items={itemsEnCurso}
                estudiantes={students}
                numParciales={numParciales}
              />
            </div>
          )}
        </div>
      </div>

      {/* Ficha del estudiante */}
      {fichaId && (
        <FichaEstudianteDrawer
          estudianteId={fichaId}
          cursoId={cursoId}
          bitacoraId={bitacoraId}
          onClose={() => setFichaId(null)}
        />
      )}
    </div>
  )
}
