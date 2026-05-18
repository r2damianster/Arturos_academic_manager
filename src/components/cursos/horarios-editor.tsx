'use client'

import { useState } from 'react'
import { actualizarHorariosCurso } from '@/lib/actions/cursos'
import { HorariosFormFields, HorarioClase } from '@/components/cursos/horarios-form-fields'

interface Props {
  cursoId: string
  initialClases: HorarioClase[]
}

export function HorariosEditor({ cursoId, initialClases }: Props) {
  const [clases, setClases] = useState<HorarioClase[]>(initialClases)
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
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs bg-brand-700/30 border border-brand-600/50 text-brand-400 hover:text-brand-300 hover:bg-brand-700/50 px-2 py-0.5 rounded transition-colors"
          >
            ✏️ Editar
          </button>
        </div>
        {clases.length === 0 ? (
          <p className="text-xs text-gray-500">Ningún horario registrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clases.map((c, i) => (
              <div
                key={i}
                className={`border rounded px-2.5 py-1 text-xs ${
                  c.tipo === 'tutoria_curso'
                    ? 'bg-orange-900/40 border-orange-800 text-orange-200'
                    : 'bg-purple-900/40 border-purple-800 text-purple-200'
                }`}
              >
                <strong className={`capitalize mr-2 ${c.tipo === 'tutoria_curso' ? 'text-orange-300' : 'text-purple-300'}`}>
                  {c.dia_semana}
                </strong>
                {c.hora_inicio.slice(0, 5)} - {c.hora_fin.slice(0, 5)}
                {c.tipo === 'tutoria_curso' && ' (Tutoría)'}
                {c.centro_computo && ' 💻'}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3 bg-gray-900/40 border border-gray-800 p-4 rounded-xl">
      <h2 className="font-semibold text-white text-sm">Editar Horarios de Clase</h2>
      <HorariosFormFields value={clases} onChange={setClases} />
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary flex-1 text-sm disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar horarios'}
        </button>
        <button
          onClick={() => { setClases(initialClases); setIsEditing(false) }}
          disabled={loading}
          className="btn-ghost flex-1 text-center text-sm disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
