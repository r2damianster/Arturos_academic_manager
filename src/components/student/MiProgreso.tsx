'use client'

interface Props {
  asignatura: string
  pctAsistencia: number | null
  participacionPromedio?: number | null
  trabajosCompletados: number
  trabajosActivos: number
  trabajosTotal: number
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}

export function MiProgreso({
  pctAsistencia,
  participacionPromedio,
  trabajosCompletados,
  trabajosActivos: _trabajosActivos,
  trabajosTotal,
  tutoriasAsistidas,
  tutoriasFaltadas,
}: Props) {
  const scoreAsist = pctAsistencia ?? 50
  const scorePart = participacionPromedio != null ? (participacionPromedio / 5) * 100 : 50
  const scoreTrab = trabajosTotal > 0 ? (trabajosCompletados / trabajosTotal) * 100 : 50
  const scoreGeneral = Math.round(scoreAsist * 0.4 + scorePart * 0.3 + scoreTrab * 0.3)

  function barColor(pct: number) {
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  function textColor(pct: number) {
    if (pct >= 80) return 'text-emerald-400'
    if (pct >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const metricas = [
    {
      label: 'Asistencia',
      valor: pctAsistencia !== null ? pctAsistencia : null,
      formato: (v: number) => `${v}%`,
      pct: pctAsistencia ?? 0,
    },
    {
      label: 'Participación',
      valor: participacionPromedio != null ? participacionPromedio : null,
      formato: (v: number) => `${v}/5`,
      pct: participacionPromedio != null ? (participacionPromedio / 5) * 100 : 0,
    },
    {
      label: 'Trabajos completados',
      valor: trabajosTotal > 0 ? trabajosCompletados : null,
      formato: (v: number) => `${v}/${trabajosTotal}`,
      pct: trabajosTotal > 0 ? (trabajosCompletados / trabajosTotal) * 100 : 0,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mi progreso</p>
        <span className={`text-sm font-bold ${textColor(scoreGeneral)}`}>{scoreGeneral}%</span>
      </div>

      {/* Barra de score general */}
      <div className="relative w-full bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor(scoreGeneral)}`}
          style={{ width: `${scoreGeneral}%` }}
        />
      </div>

      {/* Métricas individuales */}
      <div className="space-y-2">
        {metricas.map(m => (
          <div key={m.label} className="flex items-center gap-3">
            <span className="text-[10px] text-gray-500 w-36 flex-shrink-0">{m.label}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-0">
              {m.valor !== null && (
                <div
                  className={`h-1.5 rounded-full ${barColor(m.pct)}`}
                  style={{ width: `${Math.min(m.pct, 100)}%` }}
                />
              )}
            </div>
            <span className={`text-[10px] font-medium w-10 text-right flex-shrink-0 ${m.valor !== null ? textColor(m.pct) : 'text-gray-600'}`}>
              {m.valor !== null ? m.formato(m.valor) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Tutorías */}
      {(tutoriasAsistidas > 0 || tutoriasFaltadas > 0) && (
        <div className="flex gap-2 text-[10px] flex-wrap">
          {tutoriasAsistidas > 0 && (
            <span className="bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 px-2 py-0.5 rounded">
              ✓ {tutoriasAsistidas} tutoría{tutoriasAsistidas > 1 ? 's' : ''} asistida{tutoriasAsistidas > 1 ? 's' : ''}
            </span>
          )}
          {tutoriasFaltadas > 0 && (
            <span className="bg-red-900/30 border border-red-800/50 text-red-400 px-2 py-0.5 rounded">
              ✗ {tutoriasFaltadas} faltada{tutoriasFaltadas > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
