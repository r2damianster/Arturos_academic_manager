'use client'

import { useState, useTransition } from 'react'
import { citarEstudiante } from '@/lib/actions/citaciones'
import { silenciarAlerta, restaurarAlerta, excluirEstudianteDeRiesgo } from '@/lib/actions/cursos'

export interface EstudianteEnRiesgo {
  id: string
  nombre: string
  pctAsistencia: number | null
  trabajosActivos: number
  participacionPromedio: number | null
  notasEnCursoPct: number | null
  factoresRiesgo: number
}

interface Props {
  cursoId: string
  estudiantes: EstudianteEnRiesgo[]
  silenciado?: boolean
}

function razonYDetalle(e: EstudianteEnRiesgo): { razon: string; detalleRazon: string } {
  const factores: string[] = []
  if (e.pctAsistencia !== null && e.pctAsistencia < 75)
    factores.push(`asistencia de ${e.pctAsistencia}%`)
  if (e.participacionPromedio !== null && e.participacionPromedio < 2.5)
    factores.push(`participación promedio de ${e.participacionPromedio}/5`)
  if (e.notasEnCursoPct !== null && e.notasEnCursoPct < 50)
    factores.push(`${e.notasEnCursoPct}% de actividades en curso calificadas`)
  if (e.trabajosActivos >= 3)
    factores.push(`${e.trabajosActivos} trabajos activos sin completar`)

  return {
    razon: 'Seguimiento académico',
    detalleRazon: `Se detectaron los siguientes indicadores de atención: ${factores.join(', ')}. Se recomienda conversar sobre estrategias de mejora.`,
  }
}

type Estado = 'idle' | 'loading' | 'done' | 'error'

export function RiesgoPanel({ cursoId, estudiantes, silenciado = false }: Props) {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [citados,   setCitados]   = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [silPending, startSil]    = useTransition()
  const [excPending, startExc]    = useTransition()

  // ── Strip cuando panel completo está silenciado ───────────────────────────
  if (silenciado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/40 text-xs text-gray-500">
        <span>⚠ Panel de riesgo silenciado</span>
        <span className="text-gray-700">·</span>
        <button
          type="button"
          disabled={silPending}
          onClick={() => startSil(() => { restaurarAlerta(cursoId, 'riesgo').then(() => {}) })}
          className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Mostrar de nuevo →
        </button>
      </div>
    )
  }

  // ── Sin estudiantes en riesgo (luego de filtrar excluidos) ────────────────
  if (estudiantes.length === 0) return null

  const maxFactores = Math.max(...estudiantes.map(e => e.factoresRiesgo))
  const esCritico = maxFactores >= 3
  const panelClasses = esCritico
    ? 'border border-red-700/40 bg-red-900/10 rounded-xl overflow-hidden'
    : 'border border-amber-700/40 bg-amber-900/10 rounded-xl overflow-hidden'
  const headerTextClass = esCritico ? 'text-red-300' : 'text-amber-300'
  const headerHoverClass = esCritico ? 'hover:bg-red-900/20' : 'hover:bg-amber-900/20'
  const arrowClass = esCritico ? 'text-red-600' : 'text-amber-600'
  const borderTopClass = esCritico ? 'border-t border-red-800/40' : 'border-t border-amber-800/40'
  const btnClass = esCritico
    ? 'w-full text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2'
    : 'w-full text-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2'

  const factoresDetectados: string[] = []
  if (estudiantes.some(e => e.pctAsistencia !== null && e.pctAsistencia < 75))           factoresDetectados.push('asistencia')
  if (estudiantes.some(e => e.participacionPromedio !== null && e.participacionPromedio < 2.5)) factoresDetectados.push('participación')
  if (estudiantes.some(e => e.notasEnCursoPct !== null && e.notasEnCursoPct < 50))       factoresDetectados.push('notas en curso')
  if (estudiantes.some(e => e.trabajosActivos >= 3))                                      factoresDetectados.push('trabajos')

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
    <div className={panelClasses}>
      <div className={`w-full flex items-center justify-between px-4 py-3 text-sm ${headerTextClass}`}>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className={`flex-1 flex items-center gap-2 font-medium text-left ${headerHoverClass} transition-colors rounded-l`}
        >
          <span>⚠</span>
          {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} en riesgo
          {factoresDetectados.length > 0 && (
            <span className={`${arrowClass} font-normal text-xs`}>
              ({factoresDetectados.join(' · ')})
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={silPending}
            onClick={() => startSil(() => { silenciarAlerta(cursoId, 'riesgo').then(() => {}) })}
            className={`text-xs ${arrowClass} hover:opacity-70 transition-opacity disabled:opacity-30`}
            title="Silenciar este panel"
          >
            Silenciar
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className={`${arrowClass} text-xs px-1`}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={`px-4 pb-4 space-y-3 ${borderTopClass}`}>
          <div className="mt-3 space-y-2">
            {estudiantes.map(est => (
              <div key={est.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={excPending}
                    onClick={() => startExc(() => { excluirEstudianteDeRiesgo(cursoId, est.id).then(() => {}) })}
                    className="text-gray-600 hover:text-gray-400 transition-colors text-base leading-none flex-shrink-0 disabled:opacity-30"
                    title="Ocultar este estudiante del panel"
                  >
                    ×
                  </button>
                  <div className="min-w-0">
                    <span className="text-sm text-gray-200 truncate block">{est.nombre}</span>
                    {est.factoresRiesgo >= 3 && (
                      <span className="text-xs text-red-400 font-medium">{est.factoresRiesgo} factores</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                  {est.pctAsistencia !== null && est.pctAsistencia < 75 && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      est.pctAsistencia < 60
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-amber-900/40 text-amber-400'
                    }`}>
                      asist. {est.pctAsistencia}%
                    </span>
                  )}
                  {est.participacionPromedio !== null && est.participacionPromedio < 2.5 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">
                      part. {est.participacionPromedio}/5
                    </span>
                  )}
                  {est.notasEnCursoPct !== null && est.notasEnCursoPct < 50 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400">
                      notas {est.notasEnCursoPct}%
                    </span>
                  )}
                  {est.trabajosActivos >= 3 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
                      {est.trabajosActivos} trabajos
                    </span>
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
              className={btnClass}
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
