'use client'

import React from 'react'

interface Props {
  estudianteNombre: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encuesta: any
  onClose: () => void
}

export function StudentProfilePanel({ estudianteNombre, encuesta, onClose }: Props) {
  if (!encuesta) return null

  // Helper to draw a likert scale value comfortably
  const renderLikert = (val: number | null | undefined, max = 5) => {
    if (val === null || val === undefined) return <span className="text-gray-500 italic text-xs">No especificado</span>
    return (
      <div className="flex gap-1 mt-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${i < val ? 'bg-brand-500' : 'bg-gray-800'}`}
          />
        ))}
        <span className="text-xs text-gray-400 ml-2">{val}/{max}</span>
      </div>
    )
  }

  // Boolean helper
  const renderBool = (val: boolean | null | undefined) => {
    if (val === true) return <span className="text-emerald-400">Sí</span>
    if (val === false) return <span className="text-red-400">No</span>
    return <span className="text-gray-500">N/A</span>
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full max-w-sm bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 flex-shrink-0 bg-gray-900 sticky top-0">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 -ml-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{estudianteNombre}</p>
            <p className="text-gray-500 text-xs">Perfil del estudiante</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Section: Sociodemographics & Housing */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-1">
              Datos Sociodemográficos / Vivienda
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Género</p><p className="text-gray-300 capitalize">{encuesta.genero || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-500">Edad / F. Nac</p><p className="text-gray-300">{encuesta.fecha_nac || 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Situación de Vivienda</p><p className="text-gray-300">{encuesta.situacion_vivienda || 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">¿Es foráneo/a?</p><p className="text-gray-300">{renderBool(encuesta.es_foraneo)}</p></div>
            </div>
          </div>

          {/* Section: Academics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-1">
              Datos Académicos
            </h3>
            <div className="space-y-2 text-sm">
              <div><p className="text-xs text-gray-500">Modalidad</p><p className="text-gray-300">{encuesta.modalidad_carrera || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-500">Carrera</p><p className="text-gray-300 font-medium">{encuesta.carrera || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-500">Nivel</p><p className="text-gray-300 capitalize">{encuesta.nivel_estudio || 'N/A'}</p></div>
              <div className="pt-2">
                <p className="text-xs text-gray-500">Satisfacción inicial con la carrera</p>
                {renderLikert(encuesta.carrera_inicio_deseada)}
              </div>
              <div className="pt-1">
                <p className="text-xs text-gray-500">Satisfacción actual con la carrera</p>
                {renderLikert(encuesta.carrera_actual_deseada)}
              </div>
            </div>
          </div>

          {/* Section: Economic & Work */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-1">
              Situación Laboral
            </h3>
            <div className="text-sm space-y-2">
              <div><p className="text-xs text-gray-500">¿Trabaja?</p><p className="text-gray-300">{renderBool(encuesta.trabaja)}</p></div>
              {encuesta.trabaja && (
                <div className="grid grid-cols-2 gap-3 mt-1 bg-gray-800/40 p-2 rounded-lg border border-gray-800">
                  <div><p className="text-xs text-gray-500">Tipo</p><p className="text-gray-300">{encuesta.tipo_trabajo || 'N/A'}</p></div>
                  <div><p className="text-xs text-gray-500">Horas/Día</p><p className="text-gray-300">{encuesta.horas_trabajo_diarias ?? 'N/A'} h</p></div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Tech Access */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-1">
              Acceso a Tecnología
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Dominio Tecnológico</p>
                {renderLikert(encuesta.nivel_tecnologia)}
              </div>
              <div><p className="text-xs text-gray-500">Smartphone</p><p className="text-gray-300 capitalize">{encuesta.dispositivo_movil || 'N/A'}</p></div>
              <div className="col-span-2 flex flex-wrap gap-2 mt-1">
                {encuesta.tiene_laptop && <span className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300">Laptop</span>}
                {encuesta.tiene_pc_escritorio && <span className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300">PC Escritorio</span>}
                {encuesta.comparte_pc && <span className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300">PC Compartida</span>}
                {encuesta.sin_computadora && <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 text-xs text-gray-300">Sin Computadora</span>}
              </div>
            </div>
          </div>

          {/* Section: Habits & AI */}
          <div className="space-y-3 pb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-1">
              Hábitos de Estudio & IA
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center bg-gray-800/30 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Gusto por escribir</p>
                <span className="text-brand-400 font-bold">{encuesta.gusto_escritura ?? '-'}/5</span>
              </div>
              <div className="flex justify-between items-center bg-gray-800/30 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Libros al año</p>
                <span className="text-gray-200">{encuesta.libros_anio ?? 'N/A'}</span>
              </div>
              
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-300 mb-2">Frecuencia de Uso de IA</p>
                <div className="space-y-2">
                  {[
                    { label: 'Resolución de Tareas', val: encuesta.uso_ia_tareas },
                    { label: 'Redacción de Textos', val: encuesta.uso_ia_redaccion },
                    { label: 'Resumir Información', val: encuesta.uso_ia_resumen },
                    { label: 'Generación de Ideas', val: encuesta.uso_ia_ideas },
                    { label: 'Análisis Crítico', val: encuesta.uso_ia_critico },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="text-gray-500">{item.val ?? 'N/A'}</span>
                      </div>
                      <div className="w-full bg-gray-800 h-1.5 rounded-full">
                        <div 
                          className="bg-brand-500 h-1.5 rounded-full" 
                          style={{ width: `${((item.val || 0) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {encuesta.problemas_reportados && (
                <div className="mt-4 p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                  <p className="text-xs text-yellow-500 font-medium mb-1">Observación Reportada</p>
                  <p className="text-xs text-yellow-200/70 italic">&quot;{encuesta.problemas_reportados}&quot;</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
