'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  type RuletaItem as Item,
  RULETA_SIZE as SIZE,
  RULETA_CX as CX,
  RULETA_CY as CY,
  RULETA_R as R,
  getRuletaColor,
  ruletaPolar as polar,
  ruletaSegPath as segPath,
  ruletaShortLabel as shortLabel,
  ruletaFontSize as calcFontSize,
  ruletaChannelName,
  type RuletaSyncState,
} from './ruleta-geometry'

type Student = { id: string; nombre: string; nombre_preferido?: string | null }
type Mode = 'estudiantes' | 'libre'

const NIVEL_COLORS = ['', 'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 'bg-lime-600', 'bg-emerald-600']
const NIVEL_LABELS = ['', '1·Nula', '2·Baja', '3·Media', '4·Alta', '5·Excel']

type PartData = Record<string, { nivel: number | null; obs: string }>

export function Ruleta({
  students,
  bitacoraId,
  partData,
  onSetNivel,
  calificadosPeriodoIds,
}: {
  students: Student[]
  /** Si se pasa, habilita el botón "Proyectar" (ventana emergente sincronizada). */
  bitacoraId?: string
  /** Si se pasa junto con onSetNivel, habilita calificar participación del ganador. */
  partData?: PartData
  onSetNivel?: (estudianteId: string, nivel: number) => void
  /** IDs de estudiantes ya calificados en el período/parcial actual (fuera de hoy). */
  calificadosPeriodoIds?: string[]
}) {
  const hasStudents = students.length > 0
  const [mode, setMode] = useState<Mode>('libre')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [freeText, setFreeText] = useState('Grupo 1\nGrupo 2\nGrupo 3')
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<Item | null>(null)
  const [rotation, setRotation] = useState(0)
  const [autoExclude, setAutoExclude] = useState(false)
  const [soloSinCalificar, setSoloSinCalificar] = useState(false)
  const [verSoloSinCalificar, setVerSoloSinCalificar] = useState(false)
  const [ticker, setTicker] = useState<string | null>(null)
  const [proyectorAbierto, setProyectorAbierto] = useState(false)
  const spinRef = useRef(0)
  const tickerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    setExcluded(new Set())
    setWinner(null)
    setTicker(null)
    setMode(students.length > 0 ? 'estudiantes' : 'libre')
    spinRef.current = 0
    setRotation(0)
  }, [students])

  const calificable = mode === 'estudiantes' && !!onSetNivel

  // Calificado en el período = ya tiene nivel hoy (partData, en vivo) o ya lo tenía
  // antes de hoy (calificadosPeriodoIds, cargado del servidor al abrir la clase).
  const calificadoPeriodoSet = useMemo(() => {
    const s = new Set(calificadosPeriodoIds ?? [])
    if (partData) {
      for (const id in partData) {
        if (partData[id]?.nivel != null) s.add(id)
      }
    }
    return s
  }, [calificadosPeriodoIds, partData])

  const pendientesCount = students.filter(s => !calificadoPeriodoSet.has(s.id)).length

  // ─── Dos poblaciones separadas ──────────────────────────────────────────
  // drawStudents  = de quién se sortea realmente (si "solo sin calificar" está activo,
  //                 SOLO pendientes — así se cumple la prioridad real).
  // displayStudents = quién se VE en la rueda (profesor + proyector). Por defecto
  //                 se ven todos aunque el sorteo real sea más chico, para que no
  //                 se note que se sortea entre pocos. El sub-checkbox "ver solo
  //                 pendientes" iguala la vista al sorteo real si el profesor lo prefiere.
  const drawStudents = useMemo(
    () => (soloSinCalificar ? students.filter(s => !calificadoPeriodoSet.has(s.id)) : students),
    [students, soloSinCalificar, calificadoPeriodoSet]
  )
  const displayStudents = useMemo(
    () => (soloSinCalificar && verSoloSinCalificar ? drawStudents : students),
    [students, soloSinCalificar, verSoloSinCalificar, drawStudents]
  )

  const freeItems = useMemo((): Item[] => {
    return freeText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: String(i), label }))
  }, [freeText])

  // Pool real del sorteo (de aquí sale el ganador)
  const drawItems = useMemo((): Item[] => {
    if (mode === 'libre') return freeItems
    return drawStudents.filter(s => !excluded.has(s.id)).map(s => ({ id: s.id, label: s.nombre_preferido?.trim() || s.nombre }))
  }, [mode, freeItems, drawStudents, excluded])

  // Pool visual — lo que dibuja la rueda (profesor y proyector)
  const displayItems = useMemo((): Item[] => {
    if (mode === 'libre') return freeItems
    return displayStudents.filter(s => !excluded.has(s.id)).map(s => ({ id: s.id, label: s.nombre_preferido?.trim() || s.nombre }))
  }, [mode, freeItems, displayStudents, excluded])

  // ─── Proyector: canal de sincronización ────────────────────────────────
  useEffect(() => {
    if (!bitacoraId || typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(ruletaChannelName(bitacoraId))
    channelRef.current = ch
    return () => { ch.close(); channelRef.current = null }
  }, [bitacoraId])

  // Estado "reposo": roster visible + ganador actual (si hay), sin animar.
  // Se reenvía solo, así el proyector siempre refleja lo mismo que el profesor ve.
  useEffect(() => {
    const ch = channelRef.current
    if (!ch || spinning) return
    const state: RuletaSyncState = {
      items: displayItems,
      winnerId: winner?.id ?? null,
      spinId: null,
      spinning: false,
      libre: mode === 'libre',
    }
    ch.postMessage(state)
  }, [displayItems, mode, spinning, winner])

  function abrirProyector() {
    if (!bitacoraId) return
    const w = window.open(
      `/dashboard/modo-clase/${bitacoraId}/proyector`,
      `ruleta-proyector-${bitacoraId}`,
      'width=1000,height=800'
    )
    if (w) setProyectorAbierto(true)
  }

  const handleSpin = useCallback(() => {
    if (spinning || drawItems.length < 2 || displayItems.length < 2) return

    // Ganador real: se elige del pool de sorteo (puede ser más chico que lo visible)
    const drawIdx = Math.floor(Math.random() * drawItems.length)
    const w = drawItems[drawIdx]

    // Posición visual: dónde cae ese ganador dentro de lo que se DIBUJA
    const idxDisplay = displayItems.findIndex(item => item.id === w.id)
    const segDeg = 360 / displayItems.length
    const target = 360 - (idxDisplay * segDeg + segDeg / 2)
    const final = spinRef.current + 5 * 360 + target - (spinRef.current % 360)
    spinRef.current = final
    setRotation(final)
    setSpinning(true)
    setWinner(null)

    channelRef.current?.postMessage({
      items: displayItems,
      winnerId: w.id,
      spinId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      spinning: true,
      libre: mode === 'libre',
    } satisfies RuletaSyncState)

    // Ticker: empieza rápido, desacelera gradualmente (flickea sobre lo visible)
    let isRunning = true
    let delay = 50
    const tick = () => {
      if (!isRunning) return
      setTicker(displayItems[Math.floor(Math.random() * displayItems.length)].label)
      delay = Math.min(delay * 1.06, 300)
      tickerRef.current = setTimeout(tick, delay)
    }
    tick()

    setTimeout(() => {
      isRunning = false
      if (tickerRef.current) clearTimeout(tickerRef.current)
      tickerRef.current = null
      setSpinning(false)
      setTicker(null)
      setWinner(w)
      if (autoExclude && mode === 'estudiantes') {
        setExcluded(prev => new Set([...prev, w.id]))
      }
    }, 3200)
  }, [spinning, drawItems, displayItems, autoExclude, mode])

  const toggleExclude = (id: string) => {
    setWinner(null)
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const n = displayItems.length
  const segAngle = n > 0 ? (2 * Math.PI) / n : 0
  const fs = calcFontSize(n)
  const puedeGirar = drawItems.length >= 2 && displayItems.length >= 2

  const nivelGanador = winner && partData ? partData[winner.id]?.nivel ?? null : null

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Wheel column */}
      <div className="flex flex-col items-center gap-3 flex-shrink-0">

        {/* Ticker encima de la ruleta */}
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-2"
          style={{ width: SIZE, minHeight: 52 }}
        >
          {ticker ? (
            <p className="text-white font-bold text-lg text-center truncate">{ticker}</p>
          ) : winner && !spinning ? (
            <div className="text-center w-full">
              <p className="text-gray-500 text-xs uppercase tracking-widest leading-none mb-0.5">
                Seleccionado
              </p>
              <p className="text-indigo-300 font-bold text-lg leading-tight">{winner.label}</p>

              {calificable && (
                <div className="mt-2 flex flex-col items-center gap-1">
                  <p className="text-[10px] text-gray-500">
                    {nivelGanador != null ? 'Corregir participación' : 'Calificar participación'}
                  </p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(nv => (
                      <button
                        key={nv}
                        type="button"
                        title={NIVEL_LABELS[nv]}
                        onClick={() => onSetNivel!(winner.id, nv)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          nivelGanador === nv
                            ? `${NIVEL_COLORS[nv]} text-white ring-2 ring-white/60`
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {nv}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Gira para seleccionar</p>
          )}
        </div>

        {/* Ruleta */}
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
          </div>

          {n >= 2 ? (
            <div
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? 'transform 3.2s cubic-bezier(0.17, 0.67, 0.12, 1)'
                  : 'none',
                willChange: 'transform',
              }}
            >
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                {displayItems.map((item, i) => {
                  const mid = i * segAngle + segAngle / 2
                  // Texto horizontal (sin rotación), pegado al borde exterior
                  const tp = polar(mid, R * 0.76)
                  return (
                    <g key={item.id}>
                      <path
                        d={segPath(i, segAngle)}
                        fill={getRuletaColor(i)}
                        stroke="#1f2937"
                        strokeWidth="1.5"
                      />
                      <text
                        x={tp.x}
                        y={tp.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={fs}
                        fill="white"
                        fontWeight="700"
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {shortLabel(item.label, n, mode === 'libre')}
                      </text>
                    </g>
                  )
                })}
                <circle cx={CX} cy={CY} r={16} fill="#111827" stroke="#374151" strokeWidth="2" />
              </svg>
            </div>
          ) : (
            <div className="w-full h-full rounded-full bg-gray-800/50 border-2 border-dashed border-gray-700 flex items-center justify-center">
              <p className="text-gray-500 text-sm text-center px-8">
                {mode === 'libre'
                  ? 'Escribe al menos 2 elementos'
                  : n === 0
                  ? 'Todos excluidos — activa alguno'
                  : 'Necesitas al menos 2 participantes'}
              </p>
            </div>
          )}
        </div>

        {/* Spin button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleSpin}
            disabled={spinning || !puedeGirar}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg transition-colors shadow-lg shadow-indigo-900/40"
          >
            {spinning ? 'Girando…' : winner ? '¡Otra vez!' : 'Girar'}
          </button>

          {mode === 'estudiantes' && hasStudents && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={autoExclude}
                onChange={e => setAutoExclude(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              Excluir ganador automáticamente
            </label>
          )}

          {calificable && (
            <div className="flex flex-col items-start gap-1">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={soloSinCalificar}
                  onChange={e => {
                    setSoloSinCalificar(e.target.checked)
                    if (!e.target.checked) setVerSoloSinCalificar(false)
                    setWinner(null)
                    setTicker(null)
                  }}
                  className="rounded accent-indigo-500"
                />
                Priorizar sin calificar del período ({pendientesCount})
              </label>
              {soloSinCalificar && (
                <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none pl-6">
                  <input
                    type="checkbox"
                    checked={verSoloSinCalificar}
                    onChange={e => { setVerSoloSinCalificar(e.target.checked); setWinner(null); setTicker(null) }}
                    className="rounded accent-indigo-500 w-3 h-3"
                  />
                  Ocultar en la rueda a los ya calificados
                </label>
              )}
            </div>
          )}

          {bitacoraId && (
            <button
              onClick={abrirProyector}
              className="mt-1 text-xs px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              🖥 {proyectorAbierto ? 'Reabrir proyector' : 'Proyectar en otra pantalla'}
            </button>
          )}
        </div>
      </div>

      {/* Controls column */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Mode tabs */}
        {hasStudents && (
          <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
            {(['estudiantes', 'libre'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setWinner(null); setTicker(null) }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m === 'estudiantes' ? 'Estudiantes' : 'Lista libre'}
              </button>
            ))}
          </div>
        )}

        {mode === 'estudiantes' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                <span className="text-white font-medium">{n}</span> activos
                {excluded.size > 0 && (
                  <span className="text-gray-600"> · {excluded.size} excluidos</span>
                )}
                {soloSinCalificar && !verSoloSinCalificar && (
                  <span className="text-gray-600"> · sorteo real: {drawItems.length}</span>
                )}
              </span>
              <div className="flex gap-3">
                {excluded.size > 0 && (
                  <button
                    onClick={() => { setExcluded(new Set()); setWinner(null) }}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Incluir todos
                  </button>
                )}
                {excluded.size < displayStudents.length && (
                  <button
                    onClick={() => { setExcluded(new Set(displayStudents.map(s => s.id))); setWinner(null) }}
                    className="text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    Excluir todos
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {displayStudents.map(s => {
                const isExcluded = excluded.has(s.id)
                const isWinner = winner?.id === s.id && !isExcluded
                const nivelGuardado = partData?.[s.id]?.nivel ?? null
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleExclude(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-left transition-all ${
                      isExcluded
                        ? 'bg-gray-800/30 text-gray-600'
                        : isWinner
                        ? 'bg-indigo-900/60 text-indigo-200 ring-1 ring-indigo-500/40'
                        : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isExcluded
                        ? 'border-gray-600 bg-transparent'
                        : 'border-indigo-500 bg-indigo-500'
                    }`}>
                      {!isExcluded && (
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5">
                          <path
                            d="M2 6 L5 9 L10 3"
                            stroke="white"
                            strokeWidth="1.8"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className={isExcluded ? 'line-through' : ''}>
                      {s.nombre_preferido?.trim() || s.nombre}
                    </span>
                    {calificable && nivelGuardado != null && (
                      <span className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${NIVEL_COLORS[nivelGuardado]}`}>
                        {nivelGuardado}
                      </span>
                    )}
                    {isWinner && (
                      <span className="ml-auto text-indigo-400 text-xs">★ ganador</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm text-gray-400 block">
              Elementos para la ruleta{' '}
              <span className="text-gray-600">(uno por línea)</span>
            </label>
            <textarea
              value={freeText}
              onChange={e => { setFreeText(e.target.value); setWinner(null); setTicker(null) }}
              placeholder={'Grupo 1\nGrupo 2\nGrupo 3\n...'}
              rows={10}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono leading-relaxed"
            />
            <p className="text-xs text-gray-500">
              {n} {n === 1 ? 'elemento' : 'elementos'}
              {n < 2 && n > 0 && (
                <span className="text-amber-600 ml-2">— necesitas al menos 2</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
