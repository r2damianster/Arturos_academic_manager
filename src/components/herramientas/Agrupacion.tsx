'use client'

import { useState } from 'react'

type Student = { id: string; nombre: string; apellido: string }

const GROUP_COLORS = [
  'bg-indigo-900/50 border-indigo-700 text-indigo-300',
  'bg-emerald-900/50 border-emerald-700 text-emerald-300',
  'bg-rose-900/50 border-rose-700 text-rose-300',
  'bg-amber-900/50 border-amber-700 text-amber-300',
  'bg-violet-900/50 border-violet-700 text-violet-300',
  'bg-cyan-900/50 border-cyan-700 text-cyan-300',
  'bg-pink-900/50 border-pink-700 text-pink-300',
  'bg-lime-900/50 border-lime-700 text-lime-300',
  'bg-orange-900/50 border-orange-700 text-orange-300',
  'bg-teal-900/50 border-teal-700 text-teal-300',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function splitGroups(students: Student[], n: number): Student[][] {
  const shuffled = shuffle(students)
  const groups: Student[][] = Array.from({ length: n }, () => [])
  shuffled.forEach((s, i) => groups[i % n].push(s))
  return groups
}

export function Agrupacion({ students }: { students: Student[] }) {
  const [numGroups, setNumGroups] = useState(3)
  const [groups, setGroups] = useState<Student[][] | null>(null)

  if (students.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No hay estudiantes en este curso.
      </div>
    )
  }

  const maxGroups = Math.min(10, students.length)
  const n = Math.min(numGroups, maxGroups)

  function generate() {
    setGroups(splitGroups(students, n))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="flex-1 max-w-xs">
          <label className="label">Número de grupos</label>
          <input
            type="number"
            min={2}
            max={maxGroups}
            value={numGroups}
            onChange={e => {
              setNumGroups(Number(e.target.value))
              setGroups(null)
            }}
            className="input"
          />
          <p className="text-xs text-gray-600 mt-1">{students.length} estudiantes · máx. {maxGroups} grupos</p>
        </div>

        <button onClick={generate} className="btn-primary px-6 py-2.5">
          {groups ? 'Re-mezclar' : 'Generar grupos'}
        </button>
      </div>

      {groups && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {groups.map((group, i) => (
            <div
              key={i}
              className={`border rounded-xl p-4 ${GROUP_COLORS[i % GROUP_COLORS.length]}`}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 opacity-70">
                Grupo {i + 1}
              </p>
              <ul className="space-y-1.5">
                {group.map(s => (
                  <li key={s.id} className="text-sm font-medium text-gray-100">
                    {s.apellido}, {s.nombre}
                  </li>
                ))}
              </ul>
              <p className="text-xs opacity-50 mt-3">{group.length} integrante{group.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
