'use client'

import { useEffect, useState } from 'react'
import {
  crearClaseExtra,
  getClasesRelacionables,
  type ClaseRelacionable,
  type TipoClaseExtra,
} from '@/lib/actions/bitacora'

interface CursoSimple {
  id: string
  asignatura: string
}

interface Props {
  cursos: CursoSimple[]
  defaultCursoId?: string
  defaultRelacionadaId?: string
  defaultTipo?: TipoClaseExtra
  defaultFecha?: string
  onClose: () => void
  onSaved: (nuevaFecha: string) => void
}

const TIPOS: { value: TipoClaseExtra; label: string; hint: string }[] = [
  { value: 'recuperacion', label: 'Recuperación', hint: 'No di esa clase' },
  { value: 'continuacion', label: 'Continuación', hint: 'La di a medias' },
  { value: 'extra', label: 'Extra', hint: 'Sesión adicional' },
]

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  planificado: 'Planificada',
  cumplido: 'Cumplida',
  suspendido: 'Suspendida',
}

function formatFechaCorta(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export function ClaseExtraModal({
  cursos, defaultCursoId, defaultRelacionadaId, defaultTipo, defaultFecha, onClose, onSaved,
}: Props) {
  const [cursoId, setCursoId] = useState(defaultCursoId ?? cursos[0]?.id ?? '')
  const [tipo, setTipo] = useState<TipoClaseExtra>(defaultTipo ?? 'extra')
  const [tipoTocado, setTipoTocado] = useState(!!defaultTipo)
  const [relacionadaId, setRelacionadaId] = useState(defaultRelacionadaId ?? '')
  const [relacionables, setRelacionables] = useState<ClaseRelacionable[]>([])
  const [fecha, setFecha] = useState(defaultFecha ?? '')
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFin, setHoraFin] = useState('10:00')
  const [tema, setTema] = useState('')
  const [motivo, setMotivo] = useState('')
  const [copiarPlan, setCopiarPlan] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cursoId) return
    let cancelado = false
    getClasesRelacionables(cursoId).then(lista => {
      if (!cancelado) setRelacionables(lista)
    })
    return () => { cancelado = true }
  }, [cursoId])

  const relacionada = relacionables.find(r => r.id === relacionadaId)

  function handleCursoChange(nuevoCursoId: string) {
    setCursoId(nuevoCursoId)
    setRelacionadaId('')
    setRelacionables([])
  }

  function handleRelacionadaChange(id: string) {
    setRelacionadaId(id)
    const elegida = relacionables.find(r => r.id === id)
    if (!elegida) {
      if (!tipoTocado) setTipo('extra')
      return
    }
    if (!tipoTocado) setTipo(elegida.estado === 'cumplido' ? 'continuacion' : 'recuperacion')
  }

  function handleTipoChange(nuevoTipo: TipoClaseExtra) {
    setTipo(nuevoTipo)
    setTipoTocado(true)
    if (nuevoTipo === 'extra') setRelacionadaId('')
  }

  async function handleSubmit() {
    if (!cursoId) { setError('Selecciona una asignatura'); return }
    if (!fecha) { setError('Indica la fecha'); return }
    if (horaFin <= horaInicio) { setError('La hora de fin debe ser posterior a la de inicio'); return }

    setSaving(true)
    setError(null)
    const result = await crearClaseExtra({
      cursoId,
      tipo,
      fecha,
      horaInicio,
      horaFin,
      relacionadaId: relacionadaId || undefined,
      tema: tema.trim() || undefined,
      motivo: motivo.trim() || undefined,
      copiarPlan: relacionadaId ? copiarPlan : false,
    })
    setSaving(false)

    if (result.error) { setError(result.error); return }
    onSaved(fecha)
    onClose()
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-600'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">➕ Agregar clase fuera de horario</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Recuperación, continuación o sesión extra. La fecha y la hora son libres.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Asignatura</label>
            <select value={cursoId} onChange={e => handleCursoChange(e.target.value)} className={inputClass}>
              {cursos.map(curso => (
                <option key={curso.id} value={curso.id}>{curso.asignatura}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Relacionada con (opcional)</label>
            <select value={relacionadaId} onChange={e => handleRelacionadaChange(e.target.value)} className={inputClass}>
              <option value="">Ninguna (sesión nueva)</option>
              {relacionables.map(clase => (
                <option key={clase.id} value={clase.id}>
                  {formatFechaCorta(clase.fecha)} · {ESTADO_LABEL[clase.estado] ?? clase.estado}
                  {clase.tema && clase.tema !== '(Sin planificación)' ? ` · ${clase.tema.slice(0, 40)}` : ''}
                  {clase.yaRecuperada ? ' · ya tiene recuperación' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(opcion => (
                <button
                  key={opcion.value}
                  type="button"
                  onClick={() => handleTipoChange(opcion.value)}
                  className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                    tipo === opcion.value
                      ? 'bg-brand-900/40 border-brand-600 text-brand-200'
                      : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium">{opcion.label}</div>
                  <div className="text-[10px] opacity-70">{opcion.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Desde</label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Hasta</label>
              <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Tema (opcional, se puede planificar después)</label>
            <input
              type="text"
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder={relacionada && copiarPlan ? 'Vacío = usa el tema de la clase original' : 'Ej: Cierre del tema de la semana 6'}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Vacaciones, clase incompleta, acuerdo con el grupo"
              className={inputClass}
            />
          </div>

          {relacionada && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={copiarPlan}
                onChange={e => setCopiarPlan(e.target.checked)}
                className="accent-brand-500 w-4 h-4"
              />
              <span className="text-sm text-gray-300">Copiar tema y actividades de la clase original</span>
            </label>
          )}

          {tipo === 'recuperacion' && relacionada && relacionada.estado !== 'suspendido' && relacionada.estado !== 'cumplido' && (
            <p className="text-[11px] text-gray-500">
              La clase original pasará a <span className="text-red-400">Suspendida</span>. Podrás reactivarla desde su celda.
            </p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Creando…' : 'Crear clase'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
