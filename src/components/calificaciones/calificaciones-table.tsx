'use client'

import { useState, useTransition } from 'react'
import { upsertCalificaciones } from '@/lib/actions/calificaciones'
import Link from 'next/link'

type Ciclo = '1' | '2'
type CampoNota = 'acd1' | 'ta1' | 'pe1' | 'ex1' | 'acd2' | 'ta2' | 'pe2' | 'ex2'

interface Estudiante {
  id: string
  nombre: string
  email: string
}

interface CalificacionRow {
  acd1: number; ta1: number; pe1: number; ex1: number
  acd2: number; ta2: number; pe2: number; ex2: number
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  calificaciones: Record<string, CalificacionRow>
}

const CAMPOS_CICLO: Record<Ciclo, CampoNota[]> = {
  '1': ['acd1', 'ta1', 'pe1', 'ex1'],
  '2': ['acd2', 'ta2', 'pe2', 'ex2'],
}

const ETIQUETAS: Record<CampoNota, string> = {
  acd1: 'ACD', ta1: 'TA', pe1: 'PE', ex1: 'EX',
  acd2: 'ACD', ta2: 'TA', pe2: 'PE', ex2: 'EX',
}

function calcularPromedio(notas: Partial<CalificacionRow>): number {
  const vals = [notas.acd1, notas.ta1, notas.pe1, notas.ex1].filter(v => v != null) as number[]
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function CalificacionesTable({ cursoId, estudiantes, calificaciones }: Props) {
  const [ciclo, setCiclo] = useState<Ciclo>('1')
  const [datos, setDatos] = useState<Record<string, Partial<CalificacionRow>>>(() => {
    const init: Record<string, Partial<CalificacionRow>> = {}
    for (const est of estudiantes) {
      init[est.id] = { ...calificaciones[est.id] }
    }
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const campos = CAMPOS_CICLO[ciclo]

  function handleChange(estudianteId: string, campo: CampoNota, valor: string) {
    const num = parseFloat(valor)
    setDatos(prev => ({
      ...prev,
      [estudianteId]: { ...prev[estudianteId], [campo]: isNaN(num) ? 0 : Math.min(10, Math.max(0, num)) }
    }))
  }

  function guardar(estudianteId: string) {
    setSaving(estudianteId)
    startTransition(async () => {
      await upsertCalificaciones(cursoId, estudianteId, datos[estudianteId])
      setSaving(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Tabs ciclos */}
      <div className="flex gap-2">
        {(['1', '2'] as Ciclo[]).map(c => (
          <button
            key={c}
            onClick={() => setCiclo(c)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${ciclo === c
                ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
          >
            Ciclo {c}
          </button>
        ))}
        <p className="text-xs text-gray-500 self-center ml-2">
          Notas de 0 a 10 — clic en celda para editar
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-gray-900 min-w-[180px]">
                  Estudiante
                </th>
                {campos.map(c => (
                  <th key={c} className="py-3 px-2 text-gray-400 font-medium text-center min-w-[70px]">
                    {ETIQUETAS[c]}
                  </th>
                ))}
                <th className="py-3 px-3 text-gray-400 font-medium text-center min-w-[60px]">Prom.</th>
                <th className="py-3 px-3 min-w-[60px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {estudiantes.map(est => {
                const d = datos[est.id] ?? {}
                const prom = calcularPromedio(d)

                return (
                  <tr key={est.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 px-4 sticky left-0 bg-gray-900 hover:bg-gray-800/30">
                      <Link href={`/dashboard/estudiantes/${est.id}`}
                        className="font-medium text-gray-200 hover:text-white text-sm">
                        {est.nombre}
                      </Link>
                    </td>
                    {campos.map(campo => (
                      <td key={campo} className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min={0} max={10} step={0.1}
                          value={d[campo] ?? ''}
                          onChange={e => handleChange(est.id, campo, e.target.value)}
                          className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center text-gray-100
                                     focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center">
                      <span className={`font-mono font-medium text-sm ${
                        prom >= 7 ? 'text-emerald-400' :
                        prom >= 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {prom > 0 ? prom.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => guardar(est.id)}
                        disabled={saving === est.id}
                        className="text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
                      >
                        {saving === est.id ? '...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
