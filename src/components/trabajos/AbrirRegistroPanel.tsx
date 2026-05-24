'use client'

import { useState, useTransition } from 'react'
import { crearRegistroTrabajo, mejorarCriteriosIA, type Criterio } from '@/lib/actions/registros-trabajo'

const TIPOS = ['Exposición', 'Investigación', 'Proyecto', 'Tarea', 'Práctica', 'Otro']

interface Props {
  cursoId: string
  onClose: () => void
  onCreado: () => void
}

export function AbrirRegistroPanel({ cursoId, onClose, onCreado }: Props) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('Exposición')
  const [instrucciones, setInstrucciones] = useState('')
  const [criterios, setCriterios] = useState<string[]>([''])
  const [validacionAuto, setValidacionAuto] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [mejorando, setMejorando] = useState(false)

  function addCriterio() {
    setCriterios(prev => [...prev, ''])
  }

  function updateCriterio(i: number, val: string) {
    setCriterios(prev => prev.map((c, idx) => idx === i ? val : c))
  }

  function removeCriterio(i: number) {
    setCriterios(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleMejorarIA() {
    const borradores = criterios.filter(c => c.trim())
    if (!titulo.trim() || borradores.length === 0) return
    setMejorando(true)
    const res = await mejorarCriteriosIA(tipo, titulo, borradores)
    setMejorando(false)
    if (res.criterios) setCriterios(res.criterios)
    else if (res.error) setError(res.error)
  }

  function handleSubmit() {
    if (!titulo.trim()) { setError('El título es requerido'); return }
    const criteriosLimpios: Criterio[] = criterios
      .filter(c => c.trim())
      .map(c => ({ texto: c.trim() }))

    startTransition(async () => {
      const res = await crearRegistroTrabajo(cursoId, {
        titulo,
        tipo,
        instrucciones: instrucciones || undefined,
        criterios: criteriosLimpios,
        validacion_automatica: validacionAuto,
      })
      if (res.error) { setError(res.error); return }
      onCreado()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="font-semibold text-white text-base">Abrir registro de trabajo</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Título del registro <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Registro de tema para exposición"
              className="input w-full"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo de trabajo</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    tipo === t
                      ? 'bg-brand-700 border-brand-600 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Instrucciones */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Instrucciones <span className="text-gray-600">(opcional)</span></label>
            <textarea
              value={instrucciones}
              onChange={e => setInstrucciones(e.target.value)}
              placeholder="Describe qué debe registrar el estudiante, formato esperado, etc."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          {/* Criterios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">Criterios <span className="text-gray-600">(opcional)</span></label>
              <button
                type="button"
                onClick={handleMejorarIA}
                disabled={mejorando || !titulo.trim() || criterios.every(c => !c.trim())}
                className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors"
              >
                {mejorando ? (
                  <span className="animate-pulse">Mejorando...</span>
                ) : (
                  <>
                    <span>✦</span>
                    <span>Mejorar con IA</span>
                  </>
                )}
              </button>
            </div>
            <div className="space-y-2">
              {criterios.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c}
                    onChange={e => updateCriterio(i, e.target.value)}
                    placeholder={`Criterio ${i + 1}`}
                    className="input flex-1 text-sm"
                  />
                  {criterios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterio(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCriterio}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir criterio
            </button>
          </div>

          {/* Validación */}
          <div
            onClick={() => setValidacionAuto(v => !v)}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              validacionAuto
                ? 'bg-emerald-900/20 border-emerald-700'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
              validacionAuto ? 'bg-emerald-600 border-emerald-600' : 'border-gray-600'
            }`}>
              {validacionAuto && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Aprobación automática</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {validacionAuto
                  ? 'El registro del estudiante se aprueba inmediatamente y crea el trabajo como Pendiente.'
                  : 'Requiere que el profesor revise y apruebe cada envío manualmente.'}
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="btn-primary flex-1"
            >
              {pending ? 'Activando...' : 'Activar registro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
