'use client'

import { useState, useTransition } from 'react'
import { clearProblemas, saveNotaIncidencia } from '@/lib/actions/encuesta-actions'

export interface FilaEncuesta {
  estudianteId: string
  authUserId: string
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
  nota_incidencia: string | null
}

const labelMovil: Record<string, string> = {
  android: '🤖 Android',
  ios: ' iPhone',
  ambos: '🤖 Ambos',
  ninguno: 'Sin teléfono',
}

function NotaEditor({ fila, cursoId }: { fila: FilaEncuesta; cursoId: string }) {
  const [texto, setTexto] = useState(fila.nota_incidencia ?? '')
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await saveNotaIncidencia(fila.estudianteId, texto, cursoId)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500 font-medium">Nota del profesor:</p>
      <textarea
        className="input text-xs min-h-[60px] resize-y w-full"
        placeholder="Agrega una incidencia o nota sobre este estudiante..."
        value={texto}
        onChange={e => { setTexto(e.target.value); setSaved(false) }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={pending}
          className="text-xs bg-brand-600 hover:bg-brand-500 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar nota'}
        </button>
        {saved && <span className="text-xs text-emerald-400">✓ Guardado</span>}
      </div>
    </div>
  )
}

function ProblemasCell({ fila, cursoId }: { fila: FilaEncuesta; cursoId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [clearing, startClear] = useTransition()
  const [cleared, setCleared] = useState(false)

  if (cleared || !fila.problemas) return null

  function handleClear() {
    startClear(async () => {
      await clearProblemas(fila.authUserId, cursoId)
      setCleared(true)
    })
  }

  const texto = fila.problemas
  const truncated = texto.length > 50

  return (
    <div className="mt-0.5 space-y-1">
      <div className="flex items-start gap-1">
        <span className="text-orange-400 text-[11px] flex-shrink-0">⚠</span>
        <span className="text-[11px] text-orange-300 leading-snug">
          {expanded || !truncated ? texto : texto.slice(0, 50) + '…'}
          {truncated && (
            <button onClick={() => setExpanded(v => !v)} className="ml-1 text-orange-500 hover:text-orange-300">
              {expanded ? 'menos▲' : 'más▼'}
            </button>
          )}
        </span>
      </div>
      <button
        onClick={handleClear}
        disabled={clearing}
        className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
      >
        {clearing ? 'Borrando...' : '✕ Limpiar entrada'}
      </button>
    </div>
  )
}

export function EncuestaTablaCliente({ filas, cursoId }: { filas: FilaEncuesta[]; cursoId: string }) {
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState<Record<number, boolean>>({})

  const filtradas = filas.filter(f =>
    busqueda === '' || f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-3">
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
              <th className="text-left py-2.5 px-3 min-w-[170px]">Estudiante</th>
              <th className="text-left py-2.5 px-3 min-w-[120px]">Carrera</th>
              <th className="text-center py-2.5 px-2 w-14">Trabaja</th>
              <th className="text-center py-2.5 px-2 w-14">Laptop</th>
              <th className="text-left py-2.5 px-2 min-w-[90px]">Móvil</th>
              <th className="text-center py-2.5 px-2 w-14">Foráneo</th>
              <th className="text-center py-2.5 px-2 w-12">Tech</th>
              <th className="text-center py-2.5 px-2 w-16">Carrera</th>
              <th className="text-center py-2.5 px-2 w-14">Escrit.</th>
              <th className="text-center py-2.5 px-2 w-12">IA</th>
              <th className="text-center py-2.5 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-gray-600 text-sm">
                  No se encontró ningún estudiante
                </td>
              </tr>
            ) : filtradas.map((f, i) => {
              const isOpen = !!expandido[i]
              const tieneDetalle = !!f.problemas || !!f.nota_incidencia
              const carreraColor = f.carrera_actual !== null
                ? f.carrera_actual >= 4 ? 'text-emerald-400' : f.carrera_actual >= 3 ? 'text-yellow-400' : 'text-red-400'
                : 'text-gray-700'

              return (
                <>
                  <tr key={i} className={`transition-colors ${isOpen ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'}`}>
                    {/* Nombre */}
                    <td className="py-2.5 px-3">
                      <p className="text-gray-200 font-medium">{f.nombre}</p>
                      <ProblemasCell fila={f} cursoId={cursoId} />
                      {f.nota_incidencia && (
                        <p className="text-[11px] text-blue-400 mt-0.5">
                          📝 {f.nota_incidencia.slice(0, 40)}{f.nota_incidencia.length > 40 ? '…' : ''}
                        </p>
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
                      {f.laptop ? <span className="text-emerald-500">✓</span>
                        : f.sinPC ? <span className="text-red-400 text-[10px]">sin PC</span>
                        : <span className="text-gray-700">—</span>}
                    </td>

                    {/* Móvil */}
                    <td className="py-2.5 px-2">
                      <span className="text-xs text-gray-400">
                        {f.dispositivo ? (labelMovil[f.dispositivo] ?? f.dispositivo) : <span className="text-gray-700">—</span>}
                      </span>
                    </td>

                    {/* Foráneo */}
                    <td className="py-2.5 px-2 text-center">
                      {f.foraneo ? <span className="text-yellow-400">✓</span> : <span className="text-gray-700">—</span>}
                    </td>

                    {/* Tech */}
                    <td className="py-2.5 px-2 text-center">
                      {f.nivel_tech !== null
                        ? <span className={`font-mono text-sm ${f.nivel_tech >= 4 ? 'text-emerald-400' : f.nivel_tech >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>{f.nivel_tech}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>

                    {/* Carrera deseada */}
                    <td className="py-2.5 px-2 text-center">
                      {f.carrera_actual !== null
                        ? <span className={`font-mono text-sm ${carreraColor}`}>
                            {f.carrera_actual}
                            {f.carrera_inicio !== null && f.carrera_actual > f.carrera_inicio && <span className="text-[9px] ml-0.5">↑</span>}
                            {f.carrera_inicio !== null && f.carrera_actual < f.carrera_inicio && <span className="text-[9px] ml-0.5">↓</span>}
                          </span>
                        : <span className="text-gray-700">—</span>}
                    </td>

                    {/* Escritura */}
                    <td className="py-2.5 px-2 text-center">
                      {f.gusto_escritura !== null
                        ? <span className={`font-mono text-sm ${f.gusto_escritura >= 4 ? 'text-emerald-400' : f.gusto_escritura >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>{f.gusto_escritura}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>

                    {/* IA */}
                    <td className="py-2.5 px-2 text-center">
                      {f.ia_prom !== null
                        ? <span className={`font-mono text-sm ${f.ia_prom >= 4 ? 'text-emerald-400' : f.ia_prom >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>{f.ia_prom}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>

                    {/* Expand toggle */}
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => setExpandido(prev => ({ ...prev, [i]: !prev[i] }))}
                        className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
                        title="Ver / agregar nota"
                      >
                        {isOpen ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>

                  {/* Fila expandida: nota del profesor */}
                  {isOpen && (
                    <tr key={`${i}-exp`} className="bg-gray-900/80">
                      <td colSpan={11} className="px-4 py-4">
                        <NotaEditor fila={f} cursoId={cursoId} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">{filtradas.length} de {filas.length} estudiantes</p>
    </div>
  )
}
