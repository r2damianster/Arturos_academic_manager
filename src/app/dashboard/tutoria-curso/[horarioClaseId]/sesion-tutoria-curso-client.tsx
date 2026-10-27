'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  registrarSesionTutoriaCurso,
  type ContextoSesionTutoriaCurso,
} from '@/lib/actions/tutoria-curso'

interface Props {
  horarioClaseId: string
  cursoId: string
  fecha: string
  contexto: ContextoSesionTutoriaCurso
}

function currentTimeLabel(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Un citado va primero, luego quien anunció que asistiría, luego el resto por nombre.
function sortKey(student: ContextoSesionTutoriaCurso['estudiantes'][number]): number {
  if (student.citacionId) return 0
  if (student.anunciado) return 1
  return 2
}

export function SesionTutoriaCursoClient({ horarioClaseId, cursoId, fecha, contexto }: Props) {
  const [isPending, startTransition] = useTransition()
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{ total: number; asistieron: number } | null>(contexto.yaRegistrada)

  const sortedStudents = [...contexto.estudiantes]
    .sort((first, second) => sortKey(first) - sortKey(second) || first.nombre.localeCompare(second.nombre))
    .filter(student => student.nombre.toLowerCase().includes(search.toLowerCase()))

  const citedCount = contexto.estudiantes.filter(student => student.citacionId).length
  const citedAttendedCount = contexto.estudiantes.filter(
    student => student.citacionId && attendeeIds.has(student.id)
  ).length

  function toggleAttendee(studentId: string) {
    setAttendeeIds(previous => {
      const next = new Set(previous)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function handleFinish() {
    if (!startedAt) return
    setErrorMessage(null)
    startTransition(async () => {
      const response = await registrarSesionTutoriaCurso({
        horarioClaseId,
        cursoId,
        fecha,
        horaInicio: contexto.horaInicio.slice(0, 5),
        horaFin: currentTimeLabel(),
        asistentesIds: [...attendeeIds],
      })
      if (response.error) {
        setErrorMessage(response.error)
        return
      }
      setResult({ total: response.total ?? 0, asistieron: response.asistieron ?? 0 })
    })
  }

  if (result) {
    return (
      <div className="max-w-xl mx-auto card space-y-3">
        <h1 className="text-lg font-bold text-white">Tutoría registrada ✔</h1>
        <p className="text-sm text-gray-400">
          {contexto.asignatura} · {fecha}: asistieron <strong className="text-emerald-400">{result.asistieron}</strong> de {result.total}.
          Quedó en el historial de tutorías (no afecta asistencia de clase).
        </p>
        <div className="flex gap-2">
          <Link href="/dashboard/tutorias" className="text-xs text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800">Ver historial</Link>
          <Link href="/dashboard/planificacion" className="text-xs text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-800">Volver a Mis Clases</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Link href="/dashboard/planificacion" className="text-xs text-gray-500 hover:text-gray-300">← Mis Clases</Link>
        <h1 className="text-lg font-bold text-white mt-1">👨‍🏫 Tutoría · {contexto.asignatura}</h1>
        <p className="text-xs text-gray-500">{fecha} · {contexto.horaInicio.slice(0, 5)}–{contexto.horaFin.slice(0, 5)}</p>
      </div>

      {!startedAt ? (
        <div className="card space-y-3">
          <p className="text-sm text-gray-400">
            No requiere planificación. Al iniciar se toma la hora; al terminar marcas quién asistió
            (el resto queda como «No asistió»).
          </p>
          <button onClick={() => setStartedAt(currentTimeLabel())} className="btn-primary text-sm">
            ▶ Iniciar tutoría
          </button>
        </div>
      ) : (
        <div className="card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-emerald-400">En curso desde {startedAt}</p>
            <p className="text-xs text-gray-400">
              Asistentes: <strong className="text-white">{attendeeIds.size}</strong> / {contexto.estudiantes.length}
              {citedCount > 0 && <> · Citados: <strong className="text-amber-300">{citedAttendedCount}</strong> / {citedCount}</>}
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar estudiante…"
            className="input w-full text-sm"
          />

          <ul className="divide-y divide-gray-800 max-h-[55vh] overflow-y-auto">
            {sortedStudents.map(student => {
              const isAttendee = attendeeIds.has(student.id)
              return (
                <li key={student.id}>
                  <label className="flex items-center gap-3 py-2 px-1 cursor-pointer hover:bg-gray-800/40">
                    <input
                      type="checkbox"
                      checked={isAttendee}
                      onChange={() => toggleAttendee(student.id)}
                      className="w-4 h-4"
                    />
                    <span className={`text-sm flex-1 ${isAttendee ? 'text-white' : 'text-gray-400'}`}>{student.nombre}</span>
                    {student.citacionId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-800">Citado</span>
                    )}
                    {student.anunciado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-900/40 text-sky-300 border border-sky-800">Anunció asistencia</span>
                    )}
                    <span className={`text-[10px] w-16 text-right ${isAttendee ? 'text-emerald-400' : 'text-red-400/70'}`}>
                      {isAttendee ? 'Asistió' : 'No asistió'}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}

          <button onClick={handleFinish} disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
            {isPending ? 'Guardando…' : '■ Terminar y guardar'}
          </button>
        </div>
      )}
    </div>
  )
}
