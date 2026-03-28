'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { asignarTrabajoMasivo } from '@/lib/actions/trabajos'

interface Estudiante {
  id: string
  nombre: string
  email: string
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  preselectedId?: string
  fecha: string
}

const TIPOS_TRABAJO = ['Exposición', 'Investigación', 'Proyecto', 'Tarea', 'Laboratorio', 'Práctica', 'Otro']
const ESTADOS = ['Pendiente', 'En progreso', 'Entregado', 'Aprobado', 'Reprobado']

export function NuevoTrabajoForm({ cursoId, estudiantes, preselectedId, fecha }: Props) {
  const [estudianteId, setEstudianteId] = useState(preselectedId ?? '')
  const [tipo, setTipo]               = useState('')
  const [tipoCustom, setTipoCustom]   = useState('')
  const [tema, setTema]               = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado]           = useState('Pendiente')
  const [fechaAsig, setFechaAsig]     = useState(fecha)
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const router = useRouter()

  const estudiante = estudiantes.find(e => e.id === estudianteId)

  function enviar() {
    setError(null)
    const tipoFinal = tipo === 'Otro' ? tipoCustom.trim() : tipo
    if (!estudianteId) { setError('Selecciona un estudiante'); return }
    if (!tipoFinal)    { setError('Ingresa el tipo de trabajo'); return }

    startTransition(async () => {
      const res = await asignarTrabajoMasivo(
        cursoId,
        [estudianteId],
        { tipo: tipoFinal, tema: tema || undefined, descripcion: descripcion || undefined, estado, fecha_asignacion: fechaAsig }
      )
      if (res.error) { setError(res.error); return }
      router.push(`/dashboard/cursos/${cursoId}/trabajos`)
    })
  }

  return (
    <div className="card space-y-4">
      {/* Estudiante */}
      <div>
        <label className="label">Estudiante *</label>
        {preselectedId && estudiante ? (
          <div className="input opacity-70 cursor-not-allowed flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
              {estudiante.nombre.charAt(0)}
            </span>
            <span className="text-gray-200">{estudiante.nombre}</span>
            <span className="text-gray-500 text-xs ml-auto">{estudiante.email}</span>
          </div>
        ) : (
          <select className="input" value={estudianteId} onChange={e => setEstudianteId(e.target.value)}>
            <option value="">Seleccionar estudiante...</option>
            {estudiantes.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tipo */}
      <div>
        <label className="label">Tipo de trabajo *</label>
        <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">Selecciona...</option>
          {TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {tipo === 'Otro' && (
          <input className="input mt-2" placeholder="Especifica..." value={tipoCustom} onChange={e => setTipoCustom(e.target.value)} />
        )}
      </div>

      {/* Tema */}
      <div>
        <label className="label">Tema / Título</label>
        <input className="input" placeholder="Ej: Análisis FODA de empresa local..." value={tema} onChange={e => setTema(e.target.value)} />
      </div>

      {/* Descripción */}
      <div>
        <label className="label">Instrucciones / Descripción</label>
        <textarea className="input h-20 resize-none" placeholder="Criterios, formato de entrega..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Estado inicial</label>
          <select className="input" value={estado} onChange={e => setEstado(e.target.value)}>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fecha de asignación</label>
          <input type="date" className="input" value={fechaAsig} onChange={e => setFechaAsig(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <button onClick={enviar} disabled={isPending} className="btn-primary w-full disabled:opacity-40">
        {isPending ? 'Asignando...' : 'Asignar trabajo'}
      </button>
    </div>
  )
}
