'use client'

import { useEffect, useRef, useState } from 'react'
import {
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
  type RuletaItem,
} from '@/components/herramientas/ruleta-geometry'

export function ProyectorClient({ bitacoraId }: { bitacoraId: string }) {
  const [items, setItems] = useState<RuletaItem[]>([])
  const [libre, setLibre] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [ticker, setTicker] = useState<string | null>(null)
  const [winnerLabel, setWinnerLabel] = useState<string | null>(null)
  const [conectado, setConectado] = useState(false)
  const spinRef = useRef(0)
  // Dedup por spinId (único por giro) — NO por winnerId: si el mismo estudiante
  // sale dos veces seguidas, ambos giros deben animarse igual.
  const lastSpinKey = useRef<string | null>(null)
  const tickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(ruletaChannelName(bitacoraId))
    ch.onmessage = (e: MessageEvent<RuletaSyncState>) => {
      const msg = e.data
      setConectado(true)
      setItems(msg.items)
      setLibre(msg.libre)

      if (msg.spinning && msg.winnerId && msg.spinId && msg.spinId !== lastSpinKey.current) {
        lastSpinKey.current = msg.spinId
        const idx = msg.items.findIndex(it => it.id === msg.winnerId)
        if (idx === -1 || msg.items.length < 2) return

        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current)
        const segDeg = 360 / msg.items.length
        const target = 360 - (idx * segDeg + segDeg / 2)
        const final = spinRef.current + 5 * 360 + target - (spinRef.current % 360)
        spinRef.current = final
        setRotation(final)
        setSpinning(true)
        setWinnerLabel(null)

        spinTimeoutRef.current = setTimeout(() => {
          setSpinning(false)
          setWinnerLabel(msg.items[idx]?.label ?? null)
        }, 3200)
      } else if (!msg.spinning) {
        // Estado de reposo (reconexión, remount del profesor, etc.) — refleja
        // sin animar y libera el candado de dedup para el próximo giro real.
        lastSpinKey.current = null
        if (spinTimeoutRef.current) { clearTimeout(spinTimeoutRef.current); spinTimeoutRef.current = null }
        setSpinning(false)
        if (msg.winnerId) {
          const idx = msg.items.findIndex(it => it.id === msg.winnerId)
          setWinnerLabel(idx !== -1 ? msg.items[idx].label : null)
        } else {
          setWinnerLabel(null)
        }
      }
    }
    return () => {
      ch.close()
      if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current)
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current)
    }
  }, [bitacoraId])

  // Flicker local del ticker mientras gira (independiente del profesor, mismo look)
  useEffect(() => {
    if (!spinning || items.length === 0) {
      setTicker(null)
      return
    }
    let running = true
    let delay = 50
    const tick = () => {
      if (!running) return
      setTicker(items[Math.floor(Math.random() * items.length)].label)
      delay = Math.min(delay * 1.06, 300)
      tickerTimeoutRef.current = setTimeout(tick, delay)
    }
    tick()
    return () => { running = false; if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current) }
  }, [spinning, items])

  const n = items.length
  const segAngle = n > 0 ? (2 * Math.PI) / n : 0
  const fs = calcFontSize(n) * 1.6

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center min-h-[4rem]">
        {ticker ? (
          <p className="text-white font-bold text-5xl">{ticker}</p>
        ) : winnerLabel ? (
          <div>
            <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">Seleccionado</p>
            <p className="text-indigo-300 font-bold text-5xl">{winnerLabel}</p>
          </div>
        ) : (
          <p className="text-gray-600 text-2xl">
            {conectado ? 'Esperando giro…' : 'Conectando con la ruleta…'}
          </p>
        )}
      </div>

      <div className="relative" style={{ width: '80vmin', height: '80vmin', maxWidth: 720, maxHeight: 720 }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[36px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
        </div>

        {n >= 2 ? (
          <div
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? 'transform 3.2s cubic-bezier(0.17, 0.67, 0.12, 1)'
                : 'none',
              width: '100%',
              height: '100%',
            }}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
              {items.map((item, i) => {
                const mid = i * segAngle + segAngle / 2
                const tp = polar(mid, R * 0.76)
                return (
                  <g key={item.id}>
                    <path d={segPath(i, segAngle)} fill={getRuletaColor(i)} stroke="#1f2937" strokeWidth="1.5" />
                    <text
                      x={tp.x}
                      y={tp.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      fill="white"
                      fontWeight="700"
                    >
                      {shortLabel(item.label, n, libre)}
                    </text>
                  </g>
                )
              })}
              <circle cx={CX} cy={CY} r={16} fill="#111827" stroke="#374151" strokeWidth="2" />
            </svg>
          </div>
        ) : (
          <div className="w-full h-full rounded-full bg-gray-900 border-2 border-dashed border-gray-800 flex items-center justify-center">
            <p className="text-gray-600 text-lg text-center px-8">
              {conectado ? 'Sin suficientes participantes' : 'Abre la ruleta en la otra pantalla'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
