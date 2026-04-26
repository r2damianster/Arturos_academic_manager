'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'

type Student = { id: string; nombre: string }
type Item = { id: string; label: string }
type Mode = 'estudiantes' | 'libre'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
]

const getColor = (i: number) => COLORS[i % COLORS.length]

// Ecuador: Nombre1 [Nombre2] Apellido1 [Apellido2]
// 4 words → Nombre1 + Apellido1 (words[0] + words[2])
// 3 words → Nombre1 + Apellido1 (words[0] + words[1])
// 1-2 words → words[0]
function formatStudentName(nombre: string): string {
  const words = nombre.trim().split(/\s+/)
  if (words.length >= 4) return `${words[0]} ${words[2]}`
  if (words.length === 3) return `${words[0]} ${words[1]}`
  return words[0]
}

function shortLabel(label: string, n: number, libre: boolean): string {
  const base = libre ? label : formatStudentName(label)
  const max = libre
    ? (n <= 8 ? 16 : n <= 15 ? 12 : n <= 25 ? 9 : 7)
    : (n <= 8 ? 14 : n <= 15 ? 11 : n <= 25 ? 8 : 6)
  return base.length <= max ? base : base.slice(0, max - 1) + '…'
}

function calcFontSize(n: number): number {
  if (n <= 6) return 10
  if (n <= 10) return 9
  if (n <= 16) return 7.5
  if (n <= 25) return 6.5
  return 5.5
}

const SIZE = 340
const CX = SIZE / 2
const CY = SIZE / 2
const R = SIZE / 2 - 5

function polar(angle: number, r: number) {
  return {
    x: CX + r * Math.cos(angle - Math.PI / 2),
    y: CY + r * Math.sin(angle - Math.PI / 2),
  }
}

function segPath(i: number, segAngle: number): string {
  const a0 = i * segAngle
  const a1 = a0 + segAngle
  const s = polar(a0, R)
  const e = polar(a1, R)
  const large = segAngle > Math.PI ? 1 : 0
  return `M ${CX} ${CY} L ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} Z`
}

export function Ruleta({ students }: { students: Student[] }) {
  const hasStudents = students.length > 0
  const [mode, setMode] = useState<Mode>('libre')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [freeText, setFreeText] = useState('Grupo 1\nGrupo 2\nGrupo 3')
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<Item | null>(null)
  const [rotation, setRotation] = useState(0)
  const [autoExclude, setAutoExclude] = useState(false)
  const [ticker, setTicker] = useState<string | null>(null)
  const spinRef = useRef(0)
  const tickerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setExcluded(new Set())
    setWinner(null)
    setTicker(null)
    setMode(students.length > 0 ? 'estudiantes' : 'libre')
    spinRef.current = 0
    setRotation(0)
  }, [students])

  const activeItems = useMemo((): Item[] => {
    if (mode === 'libre') {
      return freeText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map((label, i) => ({ id: String(i), label }))
    }
    return students
      .filter(s => !excluded.has(s.id))
      .map(s => ({ id: s.id, label: s.nombre }))
  }, [mode, freeText, students, excluded])

  const handleSpin = useCallback(() => {
    if (spinning || activeItems.length < 2) return

    const idx = Math.floor(Math.random() * activeItems.length)
    const segDeg = 360 / activeItems.length
    const target = 360 - (idx * segDeg + segDeg / 2)
    const final = spinRef.current + 5 * 360 + target - (spinRef.current % 360)
    spinRef.current = final
    setRotation(final)
    setSpinning(true)
    setWinner(null)

    // Ticker: empieza rápido, desacelera gradualmente
    let isRunning = true
    let delay = 50
    const tick = () => {
      if (!isRunning) return
      setTicker(activeItems[Math.floor(Math.random() * activeItems.length)].label)
      delay = Math.min(delay * 1.06, 300)
      tickerRef.current = setTimeout(tick, delay)
    }
    tick()

    setTimeout(() => {
      isRunning = false
      if (tickerRef.current) clearTimeout(tickerRef.current)
      tickerRef.current = null
      setSpinning(false)
      const w = activeItems[idx]
      setTicker(null)
      setWinner(w)
      if (autoExclude && mode === 'estudiantes') {
        setExcluded(prev => new Set([...prev, w.id]))
      }
    }, 3200)
  }, [spinning, activeItems, autoExclude, mode])

  const toggleExclude = (id: string) => {
    setWinner(null)
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const n = activeItems.length
  const segAngle = n > 0 ? (2 * Math.PI) / n : 0
  const fs = calcFontSize(n)

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Wheel column */}
      <div className="flex flex-col items-center gap-3 flex-shrink-0">

        {/* Ticker encima de la ruleta */}
        <div
          className="flex items-center justify-center rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-2"
          style={{ width: SIZE, minHeight: 52 }}
        >
          {ticker ? (
            <p className="text-white font-bold text-lg text-center truncate">{ticker}</p>
          ) : winner && !spinning ? (
            <div className="text-center">
              <p className="text-gray-500 text-xs uppercase tracking-widest leading-none mb-0.5">
                Seleccionado
              </p>
              <p className="text-indigo-300 font-bold text-lg leading-tight">{winner.label}</p>
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
                {activeItems.map((item, i) => {
                  const mid = i * segAngle + segAngle / 2
                  // Texto horizontal (sin rotación), pegado al borde exterior
                  const tp = polar(mid, R * 0.76)
                  return (
                    <g key={item.id}>
                      <path
                        d={segPath(i, segAngle)}
                        fill={getColor(i)}
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
            disabled={spinning || n < 2}
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
                {excluded.size < students.length && (
                  <button
                    onClick={() => { setExcluded(new Set(students.map(s => s.id))); setWinner(null) }}
                    className="text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    Excluir todos
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {students.map(s => {
                const isExcluded = excluded.has(s.id)
                const isWinner = winner?.id === s.id && !isExcluded
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
                      {s.nombre}
                    </span>
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
