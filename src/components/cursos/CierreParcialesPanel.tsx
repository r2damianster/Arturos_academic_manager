'use client'

import { useState, useTransition } from 'react'
import { cerrarParcial, eliminarSnapshot } from '@/lib/actions/parcial'
import type { SnapshotParcial } from '@/lib/actions/parcial'

interface Props {
  cursoId: string
  numParciales: number
  snapshots: SnapshotParcial[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ResumenCard({ snap }: { snap: SnapshotParcial }) {
  const [expandido, setExpandido] = useState(false)
  const r = snap.resumen

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-4 hover:bg-gray-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-900/40 border border-brand-700/50 flex items-center justify-center text-brand-400 text-sm font-bold">
            {snap.numero_parcial}
          </span>
          <div>
            <p className="text-sm font-medium text-white">Parcial {snap.numero_parcial}</p>
            <p className="text-xs text-gray-500">Cerrado el {fmtDate(snap.fecha_cierre)}
              {snap.semana_cierre && <> · {snap.semana_cierre}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className={`text-lg font-bold ${
              r.asistencia_global === null ? 'text-gray-500'
              : r.asistencia_global >= 80 ? 'text-emerald-400'
              : r.asistencia_global >= 60 ? 'text-yellow-400'
              : 'text-red-400'
            }`}>
              {r.asistencia_global !== null ? `${r.asistencia_global}%` : '—'}
            </p>
            <p className="text-xs text-gray-500">asistencia</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">
              {r.encuesta_respondida}/{r.encuesta_total}
            </p>
            <p className="text-xs text-gray-500">encuesta</p>
          </div>
          <svg className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${expandido ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-700/50 p-4 space-y-4">
          {/* Métricas globales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Asistencia global', value: r.asistencia_global !== null ? `${r.asistencia_global}%` : '—' },
              { label: 'Participación prom.', value: r.participacion_global !== null ? r.participacion_global.toFixed(1) : '—' },
              { label: 'Notas en curso', value: r.notas_en_curso_total > 0 ? `${r.notas_en_curso_completadas}/${r.notas_en_curso_total}` : '—' },
              { label: 'Trabajos activos', value: r.trabajos_activos.toString() },
            ].map(m => (
              <div key={m.label} className="bg-gray-800/40 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-white">{m.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Tabla por estudiante */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-700/50">
                  <th className="pb-2 font-medium">Estudiante</th>
                  <th className="pb-2 font-medium text-center">Asistencia</th>
                  <th className="pb-2 font-medium text-center">Participación</th>
                  <th className="pb-2 font-medium text-center">Notas</th>
                  <th className="pb-2 font-medium text-center">Encuesta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {r.por_estudiante.map(est => (
                  <tr key={est.id} className="hover:bg-gray-800/20">
                    <td className="py-2 pr-4 text-gray-300 text-xs">{est.nombre}</td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-medium ${
                        est.pct_asistencia === null ? 'text-gray-500'
                        : est.pct_asistencia >= 80 ? 'text-emerald-400'
                        : est.pct_asistencia >= 60 ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>
                        {est.pct_asistencia !== null ? `${est.pct_asistencia}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-medium ${
                        est.participacion_avg === null ? 'text-gray-500'
                        : est.participacion_avg >= 3.5 ? 'text-emerald-400'
                        : est.participacion_avg >= 2 ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>
                        {est.participacion_avg !== null ? est.participacion_avg.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-medium ${
                        est.notas_en_curso_pct === null ? 'text-gray-500'
                        : est.notas_en_curso_pct >= 80 ? 'text-emerald-400'
                        : est.notas_en_curso_pct >= 50 ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>
                        {est.notas_en_curso_pct !== null ? `${est.notas_en_curso_pct}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs ${est.tiene_encuesta ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {est.tiene_encuesta ? '✓' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function CierreParcialesPanel({ cursoId, numParciales, snapshots }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [elimConfirm, setElimConfirm] = useState<string | null>(null)

  const parcialesCerrados = new Set(snapshots.map(s => s.numero_parcial))
  const proximoParcial = Array.from({ length: numParciales }, (_, i) => i + 1)
    .find(n => !parcialesCerrados.has(n))

  function handleCerrar(n: number) {
    setError(null)
    setConfirmando(null)
    startTransition(async () => {
      const res = await cerrarParcial(cursoId, n)
      if (res.error) setError(res.error)
    })
  }

  function handleEliminar(id: string) {
    setElimConfirm(null)
    startTransition(async () => {
      const res = await eliminarSnapshot(id, cursoId)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📸</span>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Cierre de Parciales</p>
            <p className="text-xs text-gray-500">
              {snapshots.length === 0
                ? 'Sin cierres registrados'
                : `${snapshots.length} de ${numParciales} parcial(es) cerrado(s)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {proximoParcial && (
            <span className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 px-2 py-1 rounded">
              Parcial {proximoParcial} pendiente
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Snapshots existentes */}
          {snapshots.length > 0 && (
            <div className="space-y-2">
              {snapshots.map(snap => (
                <div key={snap.id} className="relative">
                  <ResumenCard snap={snap} />
                  <div className="absolute top-3 right-10">
                    {elimConfirm === snap.id ? (
                      <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded px-2 py-1">
                        <span className="text-xs text-gray-400">¿Borrar?</span>
                        <button
                          onClick={() => handleEliminar(snap.id)}
                          disabled={pending}
                          className="text-xs text-red-400 hover:text-red-300"
                        >Sí</button>
                        <button
                          onClick={() => setElimConfirm(null)}
                          className="text-xs text-gray-500 hover:text-gray-400"
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setElimConfirm(snap.id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
                        title="Eliminar snapshot"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botón cerrar siguiente parcial */}
          {proximoParcial ? (
            <div className="pt-2 border-t border-gray-700/50">
              {confirmando === proximoParcial ? (
                <div className="flex items-center gap-3 p-3 bg-amber-900/10 border border-amber-700/30 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-300">
                      ¿Cerrar Parcial {proximoParcial}?
                    </p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      Se captura un snapshot de asistencia, participación, notas en curso y encuesta. No se puede reabrir (solo eliminar).
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleCerrar(proximoParcial)}
                      disabled={pending}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {pending ? 'Guardando…' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setConfirmando(null)}
                      disabled={pending}
                      className="px-3 py-1.5 border border-gray-600 text-gray-400 text-xs rounded-lg hover:border-gray-500 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmando(proximoParcial)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-900/30 border border-brand-700/40 hover:bg-brand-900/50 text-brand-400 text-sm font-medium rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cerrar Parcial {proximoParcial}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-emerald-400 text-center py-2">
              ✓ Todos los parciales cerrados
            </p>
          )}
        </div>
      )}
    </div>
  )
}
