'use client'

import { useState } from 'react'

export interface FilaEncuesta {
  nombre: string
  carrera: string
  modalidad: string
  trabaja: boolean
  laptop: boolean
  pc: boolean
  sinPC: boolean
  foraneo: boolean
  dispositivo: string | null
  nivel_tech: number | null
  ia_prom: number | null
  carrera_inicio: number | null
  carrera_actual: number | null
  gusto_escritura: number | null
  libros: number | null
  problemas: string | null
}

export function EncuestaTablaCliente({ filas }: { filas: FilaEncuesta[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState<Record<number, boolean>>({})

  const filtradas = filas.filter(f =>
    busqueda === '' || f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  function toggleExpand(i: number) {
    setExpandido(prev => ({ ...prev, [i]: !prev[i] }))
  }

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar estudiante..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="input w-full md:w-72"
      />

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/60 text-[11px] uppercase tracking-widest text-gray-500">
              <th className="text-left py-2.5 px-3 min-w-[160px]">Estudiante</th>
              <th className="text-left py-2.5 px-3 min-w-[120px]">Carrera</th>
              <th className="text-center py-2.5 px-2 w-14">Trabaja</th>
              <th className="text-center py-2.5 px-2 w-14">Laptop</th>
              <th className="text-center py-2.5 px-2 w-14">Móvil</th>
              <th className="text-center py-2.5 px-2 w-14">Foráneo</th>
              <th className="text-center py-2.5 px-2 w-14">Tech</th>
              <th className="text-center py-2.5 px-2 w-16">Carrera</th>
              <th className="text-center py-2.5 px-2 w-16">Escrit.</th>
              <th className="text-center py-2.5 px-2 w-14">IA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-600 text-sm">
                  No se encontró ningún estudiante
                </td>
              </tr>
            ) : (
              filtradas.map((f, i) => {
                const isOpen = !!expandido[i]
                const carreraColor = f.carrera_actual !== null
                  ? f.carrera_actual >= 4 ? 'text-emerald-400'
                  : f.carrera_actual >= 3 ? 'text-yellow-400'
                  : 'text-red-400'
                  : 'text-gray-700'

                const dispositivoLabel: Record<string, string> = {
                  android: '🤖', ios: '', ambos: '🤖', ninguno: '—'
                }

                return (
                  <>
                    <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                      {/* Nombre */}
                      <td className="py-2.5 px-3">
                        <p className="text-gray-200 font-medium">{f.nombre}</p>
                        {f.problemas && (
                          <button
                            onClick={() => toggleExpand(i)}
                            className="text-[11px] text-orange-400 text-left hover:text-orange-300 transition-colors mt-0.5 flex items-center gap-1"
                          >
                            <span>⚠</span>
                            <span className={isOpen ? '' : 'line-clamp-1 max-w-[140px]'}>
                              {isOpen ? f.problemas : f.problemas.slice(0, 40) + (f.problemas.length > 40 ? '…' : '')}
                            </span>
                            {f.problemas.length > 40 && (
                              <span className="text-orange-600">{isOpen ? '▲' : '▼'}</span>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Carrera */}
                      <td className="py-2.5 px-3 text-gray-400 text-xs">
                        <span className="block">{f.carrera}</span>
                        {f.modalidad !== '—' && <span className="text-gray-600">{f.modalidad}</span>}
                      </td>

                      {/* Trabaja */}
                      <td className="py-2.5 px-2 text-center">
                        {f.trabaja ? <span className="text-emerald-500">✓</span> : <span className="text-gray-700">—</span>}
                      </td>

                      {/* Laptop */}
                      <td className="py-2.5 px-2 text-center">
                        {f.laptop
                          ? <span className="text-emerald-500">✓</span>
                          : f.sinPC
                          ? <span className="text-red-400 text-[10px]">sin PC</span>
                          : <span className="text-gray-700">—</span>}
                      </td>

                      {/* Móvil */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-xs text-gray-400">
                          {f.dispositivo ? (dispositivoLabel[f.dispositivo] ?? f.dispositivo) : <span className="text-gray-700">—</span>}
                        </span>
                      </td>

                      {/* Foráneo */}
                      <td className="py-2.5 px-2 text-center">
                        {f.foraneo ? <span className="text-yellow-400">✓</span> : <span className="text-gray-700">—</span>}
                      </td>

                      {/* Nivel tech */}
                      <td className="py-2.5 px-2 text-center">
                        {f.nivel_tech !== null ? (
                          <span className={`font-mono text-sm ${f.nivel_tech >= 4 ? 'text-emerald-400' : f.nivel_tech >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {f.nivel_tech}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>

                      {/* Carrera deseada actual */}
                      <td className="py-2.5 px-2 text-center">
                        {f.carrera_actual !== null ? (
                          <span className={`font-mono text-sm ${carreraColor}`}>
                            {f.carrera_actual}
                            {f.carrera_inicio !== null && f.carrera_actual > f.carrera_inicio && <span className="text-[9px] ml-0.5">↑</span>}
                            {f.carrera_inicio !== null && f.carrera_actual < f.carrera_inicio && <span className="text-[9px] ml-0.5">↓</span>}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>

                      {/* Gusto escritura */}
                      <td className="py-2.5 px-2 text-center">
                        {f.gusto_escritura !== null ? (
                          <span className={`font-mono text-sm ${f.gusto_escritura >= 4 ? 'text-emerald-400' : f.gusto_escritura >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {f.gusto_escritura}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>

                      {/* IA promedio */}
                      <td className="py-2.5 px-2 text-center">
                        {f.ia_prom !== null ? (
                          <span className={`font-mono text-sm ${f.ia_prom >= 4 ? 'text-emerald-400' : f.ia_prom >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {f.ia_prom}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                    {/* Fila expandida: problemas completo */}
                    {isOpen && f.problemas && (
                      <tr key={`${i}-exp`} className="bg-orange-950/20">
                        <td colSpan={10} className="px-4 py-3">
                          <p className="text-xs text-orange-300 font-medium mb-1">Situación reportada por {f.nombre}:</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{f.problemas}</p>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">{filtradas.length} de {filas.length} estudiantes</p>
    </div>
  )
}
