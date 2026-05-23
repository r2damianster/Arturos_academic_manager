'use client'

import { useState } from 'react'
import { citarEstudiante } from '@/lib/actions/citaciones'

export interface EstudianteEnRiesgo {
  id: string
  nombre: string
  pctAsistencia: number | null
  trabajosActivos: number
}

interface Props {
  cursoId: string
  estudiantes: EstudianteEnRiesgo[]
}

function razonYDetalle(e: EstudianteEnRiesgo): { razon: string; detalleRazon: string } {
  const factores: string[] = []
  if (e.pctAsistencia !== null && e.pctAsistencia < 75)
    factores.push(`asistencia de ${e.pctAsistencia}%`)
  if (e.trabajosActivos >= 3)
    factores.push(`${e.trabajosActivos} trabajos activos sin completar`)

  return {
    razon: 'Seguimiento académico',
    detalleRazon: `Se detectaron los siguientes indicadores de atención: ${factores.join(' y ')}. Se recomienda conversar sobre estrategias de mejora.`,
  }
}

type Estado = 'idle' | 'loading' | 'done' | 'error'

export function RiesgoPanel({ cursoId, estudiantes }: Props) {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [citados,   setCitados]   = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  if (estudiantes.length === 0) return null

  async function handleCitarTodos() {
    setEstado('loading')
    setCitados(0)
    let ok = 0
    for (const est of estudiantes) {
      const { razon, detalleRazon } = razonYDetalle(est)
      const result = await citarEstudiante({ cursoId, estudianteId: est.id, razon, detalleRazon })
      if (!result.error) ok++
      setCitados(ok)
    }
    setEstado(ok > 0 ? 'done' : 'error')
  }

  return (
    <div className="border border-amber-700/40 bg-amber-900/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-amber-300 hover:bg-amber-900/20 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <span>⚠</span>
          {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} en riesgo
          <span className="text-amber-600 font-normal text-xs">(asistencia &lt; 75%)</span>
        </span>
        <span className="text-amber-600 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-amber-800/40">
          <div className="mt-3 space-y-2">
            {estudiantes.map(est => (
              <div key={est.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-200 truncate">{est.nombre}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {est.pctAsistencia !== null && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      est.pctAsistencia < 60
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-amber-900/40 text-amber-400'
                    }`}>
                      {est.pctAsistencia}%
                    </span>
                  )}
                  {est.trabajosActivos >= 3 && (
                    <span className="text-xs text-orange-400">{est.trabajosActivos} trabajos</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {estado === 'done' ? (
            <p className="text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
              ✓ {citados} {citados === 1 ? 'citación registrada' : 'citaciones registradas'}
            </p>
          ) : estado === 'error' ? (
            <p className="text-sm text-red-400">Error al registrar citaciones. Intente de nuevo.</p>
          ) : (
            <button
              onClick={handleCitarTodos}
              disabled={estado === 'loading'}
              className="w-full text-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {estado === 'loading' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Citando… {citados}/{estudiantes.length}
                </>
              ) : (
                `Citar a ${estudiantes.length === 1 ? 'este estudiante' : `estos ${estudiantes.length} estudiantes`} a tutoría`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
