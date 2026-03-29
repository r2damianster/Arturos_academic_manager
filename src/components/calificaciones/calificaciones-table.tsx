'use client'

import { useState, useTransition } from 'react'
import { upsertCalificaciones } from '@/lib/actions/calificaciones'
import Link from 'next/link'

type Parcial = 1 | 2 | 3 | 4
type Prefijo = 'acd' | 'ta' | 'pe' | 'ex'
type CampoNota = `${Prefijo}${Parcial}`

interface CalificacionRow {
  acd1: number; ta1: number; pe1: number; ex1: number
  acd2: number; ta2: number; pe2: number; ex2: number
  acd3: number; ta3: number; pe3: number; ex3: number
  acd4: number; ta4: number; pe4: number; ex4: number
}

interface Estudiante { id: string; nombre: string; email: string }

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  calificaciones: Record<string, Partial<CalificacionRow>>
  numParciales?: number
  nombresTareas?: string[]
}

const PREFIJOS: Prefijo[] = ['acd', 'ta', 'pe', 'ex']
const NOMBRES_DEFAULT = ['ACD', 'TA', 'PE', 'EX']

function getCampos(p: Parcial): CampoNota[] {
  return PREFIJOS.map(pr => `${pr}${p}` as CampoNota)
}

function calcularPromedio(notas: Partial<CalificacionRow>, p: Parcial): number {
  const vals = getCampos(p).map(c => notas[c]).filter((v): v is number => v != null && v > 0)
  if (!vals.length) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export function CalificacionesTable({ cursoId, estudiantes, calificaciones, numParciales = 2, nombresTareas = NOMBRES_DEFAULT }: Props) {
  const parciales = Array.from({ length: numParciales }, (_, i) => (i + 1) as Parcial)
  const [parcial, setParcial] = useState<Parcial>(1)
  const [datos, setDatos] = useState<Record<string, Partial<CalificacionRow>>>(() => {
    const init: Record<string, Partial<CalificacionRow>> = {}
    for (const est of estudiantes) init[est.id] = { ...calificaciones[est.id] }
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const campos = getCampos(parcial)

  function handleChange(id: string, campo: CampoNota, valor: string) {
    const num = parseFloat(valor)
    setDatos(prev => ({ ...prev, [id]: { ...prev[id], [campo]: isNaN(num) ? 0 : Math.min(10, Math.max(0, num)) } }))
  }

  function guardar(id: string) {
    setSaving(id)
    startTransition(async () => {
      await upsertCalificaciones(cursoId, id, datos[id] ?? {})
      setSaving(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {parciales.map(p => (
          <button key={p} onClick={() => setParcial(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${parcial === p ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
            Parcial {p}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium w-48">Estudiante</th>
              {campos.map((campo, i) => (
                <th key={campo} className="text-center px-3 py-3 text-gray-400 font-medium w-20">
                  {nombresTareas[i] ?? NOMBRES_DEFAULT[i]}
                  <span className="block text-xs text-gray-600 font-normal">/10</span>
                </th>
              ))}
              <th className="text-center px-3 py-3 text-gray-400 font-medium w-20">Promedio</th>
              <th className="w-16 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {estudiantes.map(est => {
              const notas = datos[est.id] ?? {}
              const prom = calcularPromedio(notas, parcial)
              return (
                <tr key={est.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/estudiantes/${est.id}`} className="font-medium text-gray-200 hover:text-white transition-colors">{est.nombre}</Link>
                    <p className="text-xs text-gray-600 truncate">{est.email}</p>
                  </td>
                  {campos.map(campo => (
                    <td key={campo} className="px-3 py-2 text-center">
                      <input type="number" min={0} max={10} step={0.1}
                        value={notas[campo] ?? 0}
                        onChange={e => handleChange(est.id, campo, e.target.value)}
                        className="w-16 text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className={`text-sm font-bold ${prom >= 7 ? 'text-emerald-400' : prom >= 5 ? 'text-yellow-400' : prom > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                      {prom > 0 ? prom.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => guardar(est.id)} disabled={saving === est.id}
                      className="btn-ghost text-xs px-2 py-1 disabled:opacity-40">
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
  )
}
