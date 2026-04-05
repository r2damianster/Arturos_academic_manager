'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Clase {
  id: string
  hora_inicio: string
  hora_fin: string
  dia_semana: string
  tipo: string
  cursos: { asignatura: string; codigo: string } | null
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
type Dia = typeof DIAS[number]
const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function fmt(t: string) { return t?.slice(0, 5) ?? '' }

export function HorarioSemanaWidget({
  clases,
  todayDia,
}: {
  clases: Clase[]
  todayDia: string
}) {
  const todayIdx = Math.max(0, DIAS.indexOf(todayDia as Dia))
  const [selIdx, setSelIdx] = useState(todayIdx)

  const selectedDia = DIAS[selIdx]
  const clasesDelDia = clases
    .filter(c => c.dia_semana === selectedDia)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  const diaHasClases = DIAS.map(d => clases.some(c => c.dia_semana === d))

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <span>📅</span> Horario Semanal
        </h2>
        <Link href="/dashboard/tutorias" className="text-xs text-brand-400 hover:text-brand-300">
          Ver tutorías →
        </Link>
      </div>

      {/* Mini week strip */}
      <div className="flex gap-1">
        {DIAS.map((dia, i) => (
          <button
            key={dia}
            onClick={() => setSelIdx(i)}
            title={dia}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-lg transition-colors ${
              i === selIdx
                ? 'bg-brand-600/30 border border-brand-500 text-brand-300'
                : i === todayIdx
                  ? 'bg-gray-800 border border-gray-600 text-gray-300'
                  : diaHasClases[i]
                    ? 'bg-gray-900/60 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                    : 'bg-gray-900/20 border border-gray-800 text-gray-600 hover:border-gray-700'
            }`}
          >
            <span className="text-[10px] font-semibold">{DIAS_SHORT[i]}</span>
            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
              diaHasClases[i]
                ? i === selIdx ? 'bg-brand-400' : 'bg-gray-500'
                : 'bg-transparent'
            }`} />
          </button>
        ))}
      </div>

      {/* Day label + arrows */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelIdx(i => Math.max(0, i - 1))}
          disabled={selIdx === 0}
          className="p-1 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-white capitalize">
          {selectedDia}
          {selIdx === todayIdx && (
            <span className="ml-2 text-[10px] font-normal text-brand-400 bg-brand-900/30 px-1.5 py-0.5 rounded">hoy</span>
          )}
        </span>
        <button
          onClick={() => setSelIdx(i => Math.min(DIAS.length - 1, i + 1))}
          disabled={selIdx === DIAS.length - 1}
          className="p-1 rounded text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Classes list */}
      {clasesDelDia.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-gray-800 rounded-lg">
          <p className="text-gray-600 text-xs">Sin actividades este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clasesDelDia.map((clase, idx) => (
            <div
              key={idx}
              className={`flex gap-3 p-3 rounded-lg border ${
                clase.tipo === 'tutoria_curso'
                  ? 'bg-orange-900/20 border-orange-800/50'
                  : 'bg-gray-800/50 border-gray-800'
              }`}
            >
              <div className="flex flex-col justify-center text-center px-2.5 py-1 bg-gray-900 rounded border border-gray-700 min-w-[58px] flex-shrink-0">
                <span className="text-xs font-bold text-white">{fmt(clase.hora_inicio)}</span>
                <span className="text-[10px] text-gray-500">{fmt(clase.hora_fin)}</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className={`font-medium text-sm truncate ${
                  clase.tipo === 'tutoria_curso' ? 'text-orange-200' : 'text-gray-200'
                }`}>
                  {clase.cursos?.asignatura ?? '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {clase.cursos?.codigo}
                  {clase.tipo === 'tutoria_curso' && (
                    <span className="ml-1 text-orange-400">· Tutoría de curso</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
