'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  listarTrabajosAutonomos,
  guardarTrabajoAutonomo,
  alternarTrabajoAutonomoActivo,
  eliminarTrabajoAutonomo,
  type TrabajoAutonomo,
} from '@/lib/actions/trabajos-autonomos'

interface Props {
  cursoId: string
  fecha: string          // fecha de la clase: se usa como fecha de asignación de los trabajos nuevos
  readOnly?: boolean
}

interface Draft {
  id?: string
  titulo: string
  descripcion: string
  fechaAsignacion: string
  phaseTexts: string[]   // índice = semana_offset: 0 = próxima clase de la misma semana, 1 = semana siguiente…
}

const DEFAULT_FIRST_PHASE = 'Revisión del trabajo autónomo'

export function TrabajosAutonomosEditor({ cursoId, fecha, readOnly = false }: Props) {
  const [trabajos, setTrabajos] = useState<TrabajoAutonomo[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reload() {
    listarTrabajosAutonomos(cursoId).then(setTrabajos)
  }

  useEffect(reload, [cursoId])

  function startNewDraft() {
    setErrorMessage(null)
    setDraft({ titulo: '', descripcion: '', fechaAsignacion: fecha, phaseTexts: [DEFAULT_FIRST_PHASE, ''] })
  }

  function startEditDraft(trabajo: TrabajoAutonomo) {
    setErrorMessage(null)
    const phaseTexts = Array.from({ length: trabajo.num_semanas + 1 }, (_, weekOffset) =>
      trabajo.fases.find(fase => fase.semana_offset === weekOffset)?.descripcion ?? ''
    )
    setDraft({
      id: trabajo.id,
      titulo: trabajo.titulo,
      descripcion: trabajo.descripcion ?? '',
      fechaAsignacion: trabajo.fecha_asignacion,
      phaseTexts,
    })
  }

  function setWeekCount(count: number) {
    setDraft(previous => {
      if (!previous) return previous
      const phaseTexts = Array.from({ length: count + 1 }, (_, weekOffset) => previous.phaseTexts[weekOffset] ?? '')
      return { ...previous, phaseTexts }
    })
  }

  function handleSave() {
    if (!draft) return
    setErrorMessage(null)
    startTransition(async () => {
      const response = await guardarTrabajoAutonomo({
        id: draft.id,
        cursoId,
        titulo: draft.titulo,
        descripcion: draft.descripcion,
        fechaAsignacion: draft.fechaAsignacion,
        fases: draft.phaseTexts.map((text, weekOffset) => ({ semana_offset: weekOffset, descripcion: text })),
      })
      if (response.error) { setErrorMessage(response.error); return }
      setDraft(null)
      reload()
    })
  }

  function handleToggleActive(trabajo: TrabajoAutonomo) {
    startTransition(async () => {
      await alternarTrabajoAutonomoActivo(trabajo.id, !trabajo.activo)
      reload()
    })
  }

  function handleDelete(trabajo: TrabajoAutonomo) {
    startTransition(async () => {
      await eliminarTrabajoAutonomo(trabajo.id)
      reload()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label mb-0">Trabajos autónomos (se enlazan a las clases siguientes)</label>
        {!readOnly && !draft && (
          <button type="button" onClick={startNewDraft} className="text-[11px] text-green-400 hover:text-green-300">
            + Nuevo trabajo autónomo
          </button>
        )}
      </div>

      {trabajos.length === 0 && !draft && (
        <p className="text-[11px] text-gray-600">Ninguno en este curso.</p>
      )}

      {trabajos.map(trabajo => (
        <div key={trabajo.id} className={`rounded-lg border px-3 py-2 text-xs ${trabajo.activo ? 'border-violet-700/40 bg-violet-950/20' : 'border-gray-800 opacity-60'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-violet-300 font-semibold">
              {trabajo.codigo} · {trabajo.titulo}
              <span className="ml-2 text-gray-500 font-normal">{trabajo.num_semanas} sem. desde {trabajo.fecha_asignacion}</span>
            </span>
            {!readOnly && (
              <span className="flex gap-2 text-[10px] text-gray-500">
                <button type="button" onClick={() => startEditDraft(trabajo)} className="hover:text-gray-200">Editar</button>
                <button type="button" onClick={() => handleToggleActive(trabajo)} className="hover:text-gray-200">{trabajo.activo ? 'Pausar' : 'Activar'}</button>
                <button type="button" onClick={() => handleDelete(trabajo)} className="hover:text-red-400">Borrar</button>
              </span>
            )}
          </div>
        </div>
      ))}

      {draft && (
        <div className="rounded-lg border border-violet-700/40 p-3 space-y-2">
          <input
            value={draft.titulo}
            onChange={event => setDraft({ ...draft, titulo: event.target.value })}
            placeholder="Título del trabajo autónomo"
            className="input text-sm"
          />
          <textarea
            value={draft.descripcion}
            onChange={event => setDraft({ ...draft, descripcion: event.target.value })}
            rows={2}
            placeholder="Consigna (opcional)"
            className="input resize-none text-sm"
          />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Semanas de seguimiento:</span>
            <select value={draft.phaseTexts.length - 1} onChange={event => setWeekCount(Number(event.target.value))} className="input text-xs py-1 w-20">
              {Array.from({ length: 8 }, (_, weekIndex) => weekIndex + 1).map(count => <option key={count} value={count}>{count}</option>)}
            </select>
          </div>
          {draft.phaseTexts.map((text, weekIndex) => (
            <div key={weekIndex} className="flex items-start gap-2">
              <span className="text-[10px] text-gray-500 w-24 pt-2">{weekIndex === 0 ? 'Próxima clase' : `Semana ${weekIndex}`}</span>
              <input
                value={text}
                onChange={event => setDraft({ ...draft, phaseTexts: draft.phaseTexts.map((current, index) => index === weekIndex ? event.target.value : current) })}
                placeholder={weekIndex === 0 ? DEFAULT_FIRST_PHASE : 'Qué se revisa esta semana (vacío = solo recordatorio)'}
                className="input text-xs flex-1"
              />
            </div>
          ))}
          {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary text-xs disabled:opacity-50">
              {isPending ? 'Guardando…' : 'Guardar trabajo'}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="text-xs text-gray-400 hover:text-gray-200">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
