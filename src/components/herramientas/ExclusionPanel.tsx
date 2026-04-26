'use client'

type Student = { id: string; nombre: string }

export function ExclusionPanel({
  students,
  excluded,
  onChange,
}: {
  students: Student[]
  excluded: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const active = students.length - excluded.size

  function toggle(id: string) {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs flex-wrap gap-1">
        <span className="text-gray-400">
          <span className="text-white font-medium">{active}</span> activos
          {excluded.size > 0 && (
            <span className="text-gray-600"> · {excluded.size} excluidos</span>
          )}
        </span>
        <div className="flex gap-3">
          {excluded.size > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Incluir todos
            </button>
          )}
          {excluded.size < students.length && (
            <button
              onClick={() => onChange(new Set(students.map(s => s.id)))}
              className="text-gray-500 hover:text-gray-400 transition-colors"
            >
              Excluir todos
            </button>
          )}
        </div>
      </div>

      <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
        {students.map(s => {
          const isExcluded = excluded.has(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                isExcluded ? 'text-gray-600' : 'text-gray-200 hover:bg-white/5'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                isExcluded
                  ? 'border-gray-700 bg-transparent'
                  : 'border-indigo-500 bg-indigo-600/40'
              }`}>
                {!isExcluded && <span className="text-[9px] text-indigo-300">✓</span>}
              </span>
              <span className={`truncate ${isExcluded ? 'line-through opacity-40' : ''}`}>
                {s.nombre}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
