'use client'

import { useState } from 'react'
import { citarEstudiante } from '@/lib/actions/citaciones'

interface EstudianteRiesgoHistorico {
  id: string
  nombre: string
  pct_asistencia: number | null
  participacion_avg: number | null
  notas_en_curso_pct: number | null
  factores: number
}

interface Props {
  cursoId: string
  numeroParcial: number
  estudiantes: EstudianteRiesgoHistorico[]
}

function razonYDetalle(e: EstudianteRiesgoHistorico, parcial: number) {
  const factores: string[] = []
  if (e.pct_asistencia !== null && e.pct_asistencia < 75)
    factores.push(`asistencia de ${e.pct_asistencia}%`)
  if (e.participacion_avg !== null && e.participacion_avg < 2.5)
    factores.push(`participación de ${e.participacion_avg}/5`)
  if (e.notas_en_curso_pct !== null && e.notas_en_curso_pct < 50)
    factores.push(`${e.notas_en_curso_pct}% actividades calificadas`)
  return {
    razon: 'Seguimiento académico',
    detalleRazon: `Bajo desempeño detectado en Parcial ${parcial}: ${factores.join(', ')}. Se recomienda acompañamiento antes del siguiente período.`,
  }
}

type Estado = 'idle' | 'loading' | 'done' | 'error'

export function RiesgoHistoricoPanel({ cursoId, numeroParcial, estudiantes }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [estado, setEstado] = useState<Estado>('idle')
  const [citados, setCitados] = useState(0)

  if (estudiantes.length === 0) return null

  async function handleCitarTodos() {
    setEstado('loading')
    setCitados(0)
    let ok = 0
    for (const est of estudiantes) {
      const { razon, detalleRazon } = razonYDetalle(est, numeroParcial)
      const result = await citarEstudiante({ cursoId, estudianteId: est.id, razon, detalleRazon })
      if (!result.error) ok++
      setCitados(ok)
    }
    setEstado(ok > 0 ? 'done' : 'error')
  }

  return (
    <div className="border border-blue-700/40 bg-blue-900/10 rounded-xl overflow-hidden">
      <div className="w-full flex items-center justify-between px-4 py-3 text-sm text-blue-300">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex-1 flex items-center gap-2 font-medium text-left hover:bg-blue-900/20 transition-colors rounded-l"
        >
          <span>⏮</span>
          {estudiantes.length}{' '}
          {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} con bajo desempeño en Parcial {numeroParcial}
          <span className="text-blue-600 font-normal text-xs">→ inicio del Parcial {numeroParcial + 1}</span>
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="text-blue-600 text-xs px-1"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-800/40">
          <div className="mt-3 space-y-2">
            {estudiantes.map(est => (
              <div key={est.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-200 min-w-0 truncate">{est.nombre}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                  {est.pct_asistencia !== null && est.pct_asistencia < 75 && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      est.pct_asistencia < 60
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-amber-900/40 text-amber-400'
                    }`}>
                      asist. {est.pct_asistencia}%
                    </span>
                  )}
                  {est.participacion_avg !== null && est.participacion_avg < 2.5 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">
                      part. {est.participacion_avg}/5
                    </span>
                  )}
                  {est.notas_en_curso_pct !== null && est.notas_en_curso_pct < 50 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400">
                      notas {est.notas_en_curso_pct}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {estado === 'done' ? (
            <p className="text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
              ✓ {citados} {citados === 1 ? 'citación registrada' : 'citaciones registradas'} para inicio de Parcial {numeroParcial + 1}
            </p>
          ) : estado === 'error' ? (
            <p className="text-sm text-red-400">Error al registrar citaciones. Intente de nuevo.</p>
          ) : (
            <button
              onClick={handleCitarTodos}
              disabled={estado === 'loading'}
              className="w-full text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {estado === 'loading' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Citando… {citados}/{estudiantes.length}
                </>
              ) : (
                `Citar a ${estudiantes.length === 1 ? 'este estudiante' : `estos ${estudiantes.length} estudiantes`} antes del Parcial ${numeroParcial + 1}`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
