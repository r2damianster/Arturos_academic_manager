'use client'

export interface HorarioClase {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo?: boolean
  obligatoria?: boolean
}

interface Props {
  value: HorarioClase[]
  onChange: (clases: HorarioClase[]) => void
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function HorariosFormFields({ value, onChange }: Props) {
  function update(i: number, patch: Partial<HorarioClase>) {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">Clases y tutorías de curso</span>
        <button
          type="button"
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          onClick={() => onChange([...value, { dia_semana: 'lunes', hora_inicio: '15:00', hora_fin: '17:00', tipo: 'clase', centro_computo: false }])}
        >
          + Añadir horario
        </button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-gray-500">Sin horarios. Añade uno con el botón.</p>
      ) : (
        <div className="space-y-2">
          {value.map((h, i) => (
            <div key={i} className="bg-gray-800/80 p-2 rounded-lg border border-gray-700 space-y-2">
              <div className="flex gap-2 items-center">
                <select
                  className="input text-xs py-1 px-2 flex-1"
                  value={h.tipo ?? 'clase'}
                  onChange={e => update(i, { tipo: e.target.value })}
                >
                  <option value="clase">Clase Regular</option>
                  <option value="tutoria_curso">Tutoría de Curso</option>
                </select>
                <select
                  className="input text-xs py-1 flex-1"
                  value={h.dia_semana}
                  onChange={e => update(i, { dia_semana: e.target.value })}
                >
                  {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-300 text-lg leading-none flex-shrink-0"
                >✕</button>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-gray-500 text-xs w-6 flex-shrink-0">De</span>
                <input
                  type="time" className="input text-xs py-1 flex-1" required
                  value={h.hora_inicio}
                  onChange={e => update(i, { hora_inicio: e.target.value })}
                />
                <span className="text-gray-500 text-xs w-4 text-center flex-shrink-0">a</span>
                <input
                  type="time" className="input text-xs py-1 flex-1" required
                  value={h.hora_fin}
                  onChange={e => update(i, { hora_fin: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox" className="w-4 h-4 rounded accent-brand-500"
                  checked={h.centro_computo ?? false}
                  onChange={e => update(i, { centro_computo: e.target.checked })}
                />
                <span className="text-xs text-gray-400">💻 Centro de cómputo</span>
              </label>
              {h.tipo === 'tutoria_curso' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox" className="w-4 h-4 rounded accent-orange-500"
                    checked={h.obligatoria ?? false}
                    onChange={e => update(i, { obligatoria: e.target.checked })}
                  />
                  <span className="text-xs text-orange-300">📌 Obligatoria (siempre visible en Panel)</span>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
