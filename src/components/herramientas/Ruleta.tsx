'use client'

import { useState, useRef, useCallback } from 'react'

type Student = {
  id: string
  nombre: string
}

const SEGMENT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
]

function getColor(index: number) {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

export function Ruleta({ students }: { students: Student[] }) {
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<Student | null>(null)
  const [rotation, setRotation] = useState(0)
  const spinRef = useRef(0)

  const handleSpin = useCallback(() => {
    if (spinning || students.length === 0) return

    const winnerIndex = Math.floor(Math.random() * students.length)
    const segmentAngle = 360 / students.length
    // Queremos que el winner quede en la parte superior (0 grados = top)
    // El puntero esta en el top, así que necesitamos rotar el segmento del winner a 0
    const targetAngle = 360 - (winnerIndex * segmentAngle + segmentAngle / 2)
    // Giros completos adicionales para efecto de spin
    const extraSpins = 5 * 360
    const finalRotation = spinRef.current + extraSpins + targetAngle - (spinRef.current % 360)

    spinRef.current = finalRotation
    setRotation(finalRotation)
    setSpinning(true)
    setWinner(null)

    setTimeout(() => {
      setSpinning(false)
      setWinner(students[winnerIndex])
    }, 3200)
  }, [spinning, students])

  if (students.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay estudiantes en este curso
      </div>
    )
  }

  const size = 280
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  const segmentAngle = (2 * Math.PI) / students.length

  function polarToCartesian(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    }
  }

  function buildSegmentPath(index: number) {
    const startAngle = index * segmentAngle
    const endAngle = startAngle + segmentAngle
    const start = polarToCartesian(startAngle, r)
    const end = polarToCartesian(endAngle, r)
    const largeArc = segmentAngle > Math.PI ? 1 : 0
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
  }

  function getTextPosition(index: number) {
    const midAngle = index * segmentAngle + segmentAngle / 2
    const textRadius = r * 0.65
    return polarToCartesian(midAngle, textRadius)
  }

  const displayName = (s: Student) =>
    s.nombre.length > 14 ? s.nombre.split(' ').slice(0, 2).join(' ') : s.nombre

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Ruleta SVG */}
      <div className="relative">
        {/* Puntero superior */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
        </div>

        <div
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 1)' : 'none',
            willChange: 'transform',
          }}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {students.map((student, i) => {
              const textPos = getTextPosition(i)
              const midAngle = i * segmentAngle + segmentAngle / 2
              const textAngleDeg = (midAngle * 180) / Math.PI

              return (
                <g key={student.id}>
                  <path
                    d={buildSegmentPath(i)}
                    fill={getColor(i)}
                    stroke="#1f2937"
                    strokeWidth="1.5"
                  />
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={students.length > 12 ? '7' : '9'}
                    fill="white"
                    fontWeight="600"
                    transform={`rotate(${textAngleDeg}, ${textPos.x}, ${textPos.y})`}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {displayName(student)}
                  </text>
                </g>
              )
            })}
            {/* Centro */}
            <circle cx={cx} cy={cy} r={14} fill="#111827" stroke="#374151" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Ganador */}
      {winner && !spinning && (
        <div className="text-center animate-fade-in">
          <p className="text-gray-400 text-sm mb-1">Seleccionado</p>
          <p className="text-white text-2xl font-bold">
            {winner.nombre}
          </p>
        </div>
      )}
      {spinning && (
        <div className="text-gray-400 text-sm animate-pulse">Girando...</div>
      )}
      {!winner && !spinning && (
        <div className="h-10" />
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleSpin}
          disabled={spinning}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {spinning ? 'Girando...' : winner ? 'Volver a girar' : 'Girar'}
        </button>
      </div>
    </div>
  )
}
