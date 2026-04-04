'use client'

import { useState } from 'react'
import Link from 'next/link'

type Curso = { id: string; asignatura: string; codigo: string; periodo: string }

export function PaseListaListClient({ cursos }: { cursos: Curso[] }) {
  const [periodo, setPeriodo] = useState('2026-1')
  const [asignatura, setAsignatura] = useState('')

  const filtrados = cursos.filter(c => {
    if (periodo && c.periodo !== periodo) return false
    if (asignatura && !c.asignatura.toLowerCase().includes(asignatura.toLowerCase())) return false
    return true
  })

  // get unique periodos
  const periodos = Array.from(new Set(cursos.map(c => c.periodo))).sort().reverse()
  if (!periodos.includes('2026-1')) periodos.push('2026-1') // just in case

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Periodo</label>
          <select className="input" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="">Todos los periodos</option>
            {periodos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Buscar asignatura</label>
          <input
            className="input"
            placeholder="Ej: Matemáticas..."
            value={asignatura}
            onChange={e => setAsignatura(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {filtrados.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No se encontraron cursos con estos filtros.</p>
        ) : (
          <div className="space-y-2">
            {filtrados.map(curso => (
              <Link
                key={curso.id}
                href={`/dashboard/cursos/${curso.id}/pase-lista`}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-brand-500/30 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-gray-200 group-hover:text-brand-400 transition-colors">
                    {curso.asignatura}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{curso.codigo} · {curso.periodo}</p>
                </div>
                <div className="flex items-center gap-2 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">Dictar clase</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
