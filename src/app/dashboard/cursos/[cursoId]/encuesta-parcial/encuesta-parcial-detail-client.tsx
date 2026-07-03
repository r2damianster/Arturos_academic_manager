'use client'

import { useState } from 'react'
import { LABELS_DIFICULTADES, colorProm } from '@/lib/encuesta-parcial-labels'

function avgFields(obj: Record<string, unknown>, keys: string[]): number | null {
  const vals = keys.map(k => obj[k]).filter((v): v is number => typeof v === 'number' && v !== null)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EncuestaParcialDetalleClient({ detalle }: { detalle: any[] }) {
  const [abierto, setAbierto] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)

  if (!detalle || detalle.length === 0) return null

  return (
    <div className="card space-y-3">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="font-semibold text-gray-200 text-sm">
          Respuestas individuales ({detalle.length})
        </h3>
        <span className="text-gray-500 text-xs">{abierto ? '▲ Colapsar' : '▼ Ver respuestas'}</span>
      </button>

      {abierto && (
        <div className="space-y-1 pt-1">
          {/* Cabecera */}
          <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 px-2 pb-1 border-b border-gray-800">
            <span className="col-span-3">Nombre</span>
            <span className="col-span-2 text-center">Autopercep.</span>
            <span className="col-span-2 text-center">Curso</span>
            <span className="col-span-2 text-center">Docente</span>
            <span className="col-span-2">Dificultades</span>
            <span className="col-span-1 text-center">Cambio</span>
          </div>

          {/* Filas */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {detalle.map((e: any) => {
            const id = e.id as string
            const nombre = e.estudiantes?.nombre ?? 'Estudiante'
            const promAuto = avgFields(e, ['autopercepcion_aprendizaje', 'esfuerzo_dedicado', 'comprension_temas_propia', 'preparacion_evaluacion', 'cumplimiento_entregas'])
            const promCurso = avgFields(e, ['claridad_explicaciones', 'pertinencia_tareas', 'claridad_instrucciones', 'ritmo_clase', 'calidad_recursos', 'justicia_evaluacion', 'retroalimentacion_recibida'])
            const promDocente = avgFields(e, ['puntualidad_docente', 'trato_docente', 'dominio_tema', 'estrategias_didacticas', 'disponibilidad_docente'])
            const dificultades: string[] = (e.dificultades ?? []).filter((d: string) => d !== 'ninguna')
            const tieneCambios = e.cambios_perfil && Object.keys(e.cambios_perfil).length > 0
            const isExpanded = expandida === id

            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => setExpandida(isExpanded ? null : id)}
                  className="grid grid-cols-12 gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-gray-800/50 transition-colors items-start"
                >
                  <span className="col-span-3 text-xs text-gray-300 truncate">{nombre}</span>
                  <span className={`col-span-2 text-center text-xs font-medium ${colorProm(promAuto)}`}>
                    {promAuto ?? '—'}
                  </span>
                  <span className={`col-span-2 text-center text-xs font-medium ${colorProm(promCurso)}`}>
                    {promCurso ?? '—'}
                  </span>
                  <span className={`col-span-2 text-center text-xs font-medium ${colorProm(promDocente)}`}>
                    {promDocente ?? '—'}
                  </span>
                  <span className="col-span-2 text-xs text-gray-400 leading-tight">
                    {dificultades.length === 0
                      ? <span className="text-gray-600">Ninguna</span>
                      : dificultades.slice(0, 2).map(d => (
                          <span key={d} className="block text-[10px] text-amber-400/80">
                            {LABELS_DIFICULTADES[d] ?? d}
                          </span>
                        ))
                    }
                    {dificultades.length > 2 && (
                      <span className="text-[10px] text-gray-600">+{dificultades.length - 2} más</span>
                    )}
                  </span>
                  <span className={`col-span-1 text-center text-xs ${tieneCambios ? 'text-amber-400' : 'text-gray-600'}`}>
                    {tieneCambios ? 'Sí' : 'No'}
                  </span>
                </button>

                {/* Fila expandida — texto libre */}
                {isExpanded && (
                  <div className="mx-2 mb-2 p-3 bg-gray-800/40 rounded-lg space-y-2 border border-gray-700/50">
                    {e.fortalezas_curso && (
                      <div>
                        <p className="text-[10px] text-emerald-400 font-medium mb-0.5">Fortalezas del curso</p>
                        <p className="text-xs text-gray-300 italic">"{e.fortalezas_curso}"</p>
                      </div>
                    )}
                    {e.sugerencias_mejora && (
                      <div>
                        <p className="text-[10px] text-amber-400 font-medium mb-0.5">Sugerencias de mejora</p>
                        <p className="text-xs text-gray-300 italic">"{e.sugerencias_mejora}"</p>
                      </div>
                    )}
                    {e.comentario_libre && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium mb-0.5">Comentario libre</p>
                        <p className="text-xs text-gray-300 italic">"{e.comentario_libre}"</p>
                      </div>
                    )}
                    {!e.fortalezas_curso && !e.sugerencias_mejora && !e.comentario_libre && (
                      <p className="text-xs text-gray-600 italic">Sin comentarios adicionales</p>
                    )}
                    {e.detalle_dificultades && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium mb-0.5">Detalle de dificultades</p>
                        <p className="text-xs text-gray-400 italic">"{e.detalle_dificultades}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
