'use client'

import { useState } from 'react'
import { actualizarHorariosCurso } from '@/lib/actions/cursos'

interface Clase {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
}

interface Props {
  cursoId: string
  initialClases: Clase[]
}

export function HorariosEditor({ cursoId, initialClases }: Props) {
  const [clases, setClases] = useState<Clase[]>(initialClases)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    const res = await actualizarHorariosCurso(cursoId, clases)
    setLoading(false)
    if (res.ok) {
      setIsEditing(false)
    } else {
      alert(res.error || 'Error al guardar los horarios.')
    }
  }

  if (!isEditing) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="font-semibold text-white text-sm">Horarios de Clase</h2>
          <button onClick={() => setIsEditing(true)} 
            className="text-xs text-brand-400 hover:text-brand-300">
            Editar horarios
          </button>
        </div>
        
        {clases.length === 0 ? (
          <p className="text-xs text-gray-500">Ningún horario registrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clases.map((c, i) => (
              <div key={i} className="bg-purple-900/40 border border-purple-800 rounded px-2.5 py-1 text-xs text-purple-200">
                <strong className="capitalize text-purple-300 mr-2">{c.dia_semana}</strong>
                {c.hora_inicio.slice(0,5)} - {c.hora_fin.slice(0,5)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3 bg-gray-900/40 border border-gray-800 p-4 rounded-xl">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-white text-sm">Editar Horarios de Clase</h2>
        <button type="button" className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          onClick={() => setClases([...clases, { dia_semana: 'lunes', hora_inicio: '15:00', hora_fin: '17:00' }])}>
          + Añadir horario
        </button>
      </div>

      {clases.length === 0 ? (
        <p className="text-xs text-gray-500">No hay horarios. Añade uno con el botón superior.</p>
      ) : (
        <div className="space-y-2">
          {clases.map((h, i) => (
            <div key={i} className="flex gap-2 items-center bg-gray-800/80 p-2 rounded-lg border border-gray-700">
              <select 
                className="input text-xs py-1" 
                value={h.dia_semana}
                onChange={e => {
                  const newH = [...clases]
                  newH[i].dia_semana = e.target.value
                  setClases(newH)
                }}>
                {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-gray-500 text-xs text-center w-8">De</span>
              <input type="time" className="input text-xs py-1" required value={h.hora_inicio}
                onChange={e => {
                  const newH = [...clases]
                  newH[i].hora_inicio = e.target.value
                  setClases(newH)
                }} />
              <span className="text-gray-500 text-xs text-center w-8">a</span>
              <input type="time" className="input text-xs py-1" required value={h.hora_fin}
                onChange={e => {
                  const newH = [...clases]
                  newH[i].hora_fin = e.target.value
                  setClases(newH)
                }} />
              <button type="button" onClick={() => setClases(clases.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 text-sm disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar horarios'}
        </button>
        <button onClick={() => { setClases(initialClases); setIsEditing(false) }} disabled={loading} className="btn-ghost flex-1 text-center text-sm disabled:opacity-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}
