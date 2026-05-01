'use client'

import { useState } from 'react'
import { actualizarDetallesCurso } from '@/lib/actions/cursos'
import { HorariosEditor } from '@/components/cursos/horarios-editor'

interface Clase {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo?: boolean
}

type Props = {
  cursoId: string
  institucion?: string | null
  clases?: Clase[]
  curso: {
    asignatura: string
    codigo: string
    periodo: string
    aula?: string | null
    fecha_inicio: string | null
    fecha_fin: string | null
    horas_semana: number
    num_sesiones: number
    horas_teoricas: number
    num_parciales: number | null
    observacion?: string | null
  }
}

export function EditarCursoPanel({ cursoId, curso, institucion, clases = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [numParciales, setNumParciales] = useState(curso.num_parciales ?? 2)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('num_parciales', String(numParciales))
    const res = await actualizarDetallesCurso(cursoId, fd)
    setLoading(false)
    if (res.error) setError(res.error)
    else setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mt-2 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Editar datos del curso
      </button>
    )
  }

  return (
    <div className="mt-3 card space-y-4 border-brand-800/40">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-200 text-sm">Editar curso</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
      </div>

      {/* Horarios de clase embebido */}
      <div>
        <p className="label mb-2">Horarios de clase</p>
        <HorariosEditor cursoId={cursoId} initialClases={clases} />
      </div>

      <hr className="border-gray-700/50" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {institucion && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 rounded-lg text-xs text-gray-400">
            <span>🏫</span>
            <span>{institucion}</span>
          </div>
        )}

        <div>
          <label className="label">Nombre de la asignatura</label>
          <input name="asignatura" className="input" required maxLength={100} defaultValue={curso.asignatura} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Período</label>
            <input name="periodo" className="input" required maxLength={20} defaultValue={curso.periodo} />
          </div>
          <div>
            <label className="label">Código</label>
            <input name="codigo" className="input" required maxLength={30} defaultValue={curso.codigo} />
          </div>
        </div>

        <div>
          <label className="label">Aula</label>
          <input name="aula" className="input" maxLength={100} defaultValue={curso.aula ?? ''}
            placeholder="Ej: Aula 102 – Bloque PADF" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de inicio</label>
            <input name="fecha_inicio" type="date" className="input" defaultValue={curso.fecha_inicio ?? ''} />
          </div>
          <div>
            <label className="label">Fecha de fin</label>
            <input name="fecha_fin" type="date" className="input" defaultValue={curso.fecha_fin ?? ''} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Horas/semana</label>
            <input name="horas_semana" type="number" className="input" required
              defaultValue={curso.horas_semana} min={1} max={200} />
          </div>
          <div>
            <label className="label">Nº sesiones</label>
            <input name="num_sesiones" type="number" className="input" required
              defaultValue={curso.num_sesiones} min={1} max={200} />
          </div>
          <div>
            <label className="label">Horas teóricas</label>
            <input name="horas_teoricas" type="number" className="input" required
              defaultValue={curso.horas_teoricas} min={1} max={200} />
          </div>
        </div>

        <div>
          <label className="label">Número de parciales</label>
          <div className="flex gap-3">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setNumParciales(n)}
                className={`flex-1 py-2.5 rounded-lg border transition-colors ${
                  numParciales === n
                    ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span className="text-lg font-bold block">{n}</span>
                <span className="text-xs">parciales</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Observaciones</label>
          <textarea
            name="observacion"
            className="input"
            rows={3}
            maxLength={500}
            defaultValue={curso.observacion ?? ''}
            placeholder="Notas generales del curso, características del grupo, etc."
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
