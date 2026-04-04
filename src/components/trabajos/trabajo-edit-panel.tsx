'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarTrabajo, eliminarTrabajo, agregarObservacionTrabajo } from '@/lib/actions/trabajos'

export type Observacion = {
  id: string
  observacion: string
  fecha: string | null
}

export type Trabajo = {
  id: string
  estudiante_id: string
  tipo: string
  tema: string | null
  descripcion: string | null
  estado: string | null
  fecha_asignacion: string | null
  progreso: number
  urgente: boolean | null
  observaciones_trabajo: Observacion[]
}

const TIPOS_TRABAJO = ['Exposición', 'Investigación', 'Proyecto', 'Tarea', 'Laboratorio', 'Práctica', 'Otro']
const ESTADOS = ['Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado']

interface Props {
  cursoId: string
  estudianteNombre: string
  estudianteId: string
  trabajo: Trabajo
  onClose: () => void
  onSaved?: () => void
}

export function TrabajoEditPanel({ cursoId, estudianteNombre, estudianteId, trabajo, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState(trabajo.tipo)
  const [tema, setTema] = useState(trabajo.tema ?? '')
  const [descripcion, setDescripcion] = useState(trabajo.descripcion ?? '')
  const [estado, setEstado] = useState(trabajo.estado ?? 'Pendiente')
  const [fechaAsig, setFechaAsig] = useState(trabajo.fecha_asignacion ?? '')
  const [progreso, setProgreso] = useState(trabajo.progreso ?? 0)
  const [urgente, setUrgente] = useState(trabajo.urgente ?? false)
  
  const [newObs, setNewObs] = useState('')
  const [localObs, setLocalObs] = useState<Observacion[]>([])
  
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    setTipo(trabajo.tipo)
    setTema(trabajo.tema ?? '')
    setDescripcion(trabajo.descripcion ?? '')
    setEstado(trabajo.estado ?? 'Pendiente')
    setFechaAsig(trabajo.fecha_asignacion ?? '')
    setProgreso(trabajo.progreso ?? 0)
    setUrgente(trabajo.urgente ?? false)
    setNewObs('')
    setError(null)
    setSaved(false)
    setConfirmDelete(false)
    const sorted = [...(trabajo.observaciones_trabajo ?? [])].sort((a, b) =>
      (b.fecha ?? '') > (a.fecha ?? '') ? 1 : -1
    )
    setLocalObs(sorted)
  }, [trabajo.id, trabajo])

  function handleGuardar() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await actualizarTrabajo(trabajo.id, cursoId, {
        tipo,
        tema: tema || undefined,
        descripcion: descripcion || undefined,
        estado,
        fecha_asignacion: fechaAsig,
        progreso,
        urgente,
      })
      if (res.error) { setError(res.error); return }
      setSaved(true)
      setTimeout(() => {
        if (onSaved) onSaved()
        onClose()
        router.refresh()
      }, 800)
    })
  }

  function handleAgregarObs() {
    if (!newObs.trim()) return
    const texto = newObs.trim()
    setError(null)
    startTransition(async () => {
      const res = await agregarObservacionTrabajo(trabajo.id, estudianteId, texto, cursoId)
      if (res.error) { setError(res.error); return }
      const hoy = new Date().toISOString().split('T')[0]
      setLocalObs(prev => [{ id: 'opt-' + Date.now(), observacion: texto, fecha: hoy }, ...prev])
      setNewObs('')
      router.refresh()
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const res = await eliminarTrabajo(trabajo.id, cursoId)
      if (res.error) { setError(res.error); setConfirmDelete(false); return }
      if (onSaved) onSaved()
      onClose()
      router.refresh()
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full max-w-sm bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 -ml-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{estudianteNombre}</p>
            <p className="text-gray-500 text-xs">Editar trabajo</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Tipo */}
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
              {!TIPOS_TRABAJO.includes(tipo) && tipo && <option value={tipo}>{tipo}</option>}
            </select>
          </div>

          {/* Tema */}
          <div>
            <label className="label">Tema / Título</label>
            <input
              className="input"
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder="Ej: Análisis FODA..."
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción / Instrucciones</label>
            <textarea
              className="input h-16 resize-none"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Criterios, formato..."
            />
          </div>

          {/* Estado + Fecha + Urgente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Estado</label>
              <select className="input" value={estado} onChange={e => setEstado(e.target.value)}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha asignación</label>
              <input type="date" className="input" value={fechaAsig} onChange={e => setFechaAsig(e.target.value)} />
            </div>
          </div>
          
          <div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input 
                type="checkbox" 
                checked={urgente} 
                onChange={e => setUrgente(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500 focus:ring-offset-gray-900"
              />
              <span className="text-xs font-medium text-red-400">Marcar como URGENTE</span>
            </label>
          </div>

          {/* Progreso */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label">Progreso del trabajo</label>
              <span className={`text-xs font-bold ${progreso < 34 ? 'text-red-400' : progreso < 67 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {progreso}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progreso}
              onChange={e => setProgreso(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${progreso < 34 ? '#f87171' : progreso < 67 ? '#facc15' : '#34d399'} ${progreso}%, #374151 ${progreso}%)`
              }}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950 border border-red-800 px-3 py-2 rounded-lg">{error}</p>
          )}
          {saved && (
            <p className="text-emerald-400 text-xs">✓ Guardado</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGuardar}
              disabled={isPending || !tipo}
              className="btn-primary w-full text-sm disabled:opacity-40"
            >
              {isPending && !confirmDelete ? 'Guardando...' : 'Guardar cambios'}
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="btn-ghost flex items-center justify-center gap-2 text-red-400 hover:bg-red-950/60 hover:border-red-800 px-3 py-2 text-sm mt-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar Trabajo Asignado
              </button>
            ) : (
              <div className="flex gap-1 w-full flex-col p-2 bg-red-950/40 rounded-lg border border-red-900">
                <p className="text-xs text-red-400 text-center mb-1">¿Estás seguro/a?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleEliminar}
                    disabled={isPending}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs px-2 py-2 transition-colors disabled:opacity-40"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 btn-ghost text-xs px-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Observaciones de avance</p>

            {localObs.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Sin observaciones aún</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {localObs.map(obs => (
                  <div key={obs.id} className="border-l-2 border-gray-700 pl-2.5 py-0.5">
                    <p className="text-xs text-gray-500 mb-0.5">{obs.fecha}</p>
                    <p className="text-xs text-gray-300">{obs.observacion}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <textarea
                className="input h-14 resize-none text-xs"
                placeholder="Nueva observación sobre el avance..."
                value={newObs}
                onChange={e => setNewObs(e.target.value)}
                maxLength={500}
              />
              <button
                onClick={handleAgregarObs}
                disabled={isPending || !newObs.trim()}
                className="btn-ghost w-full text-sm disabled:opacity-40"
              >
                + Agregar observación
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
