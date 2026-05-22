'use client'

import { useState, useTransition } from 'react'
import { registrarAsistenciaMasiva } from '@/lib/actions/asistencia'
import { formatNombreCorto } from '@/lib/format'
import { FichaEstudianteDrawer } from '@/components/ficha-estudiante/FichaEstudianteDrawer'

type Student = { id: string; nombre: string; email: string; tutoria: boolean }

type Props = {
  students: Student[]
  cursoId: string
  fecha: string
  bitacoraId: string
  asistenciaInicial: { estudiante_id: string; estado: 'Presente' | 'Ausente' | 'Atraso'; atraso: boolean }[]
  horasClase: number
}

const NIVEL_COLORS = ['', 'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 'bg-lime-600', 'bg-emerald-600']
const NIVEL_LABELS = ['', '1·Nula', '2·Baja', '3·Media', '4·Alta', '5·Excel']

export function AsistenciaPorEstudiante({
  students, cursoId, fecha, bitacoraId, asistenciaInicial, horasClase,
}: Props) {
  const [asistencia, setAsistencia] = useState<Record<string, 'Presente' | 'Ausente' | 'Atraso'>>(
    Object.fromEntries(asistenciaInicial.map(a => [a.estudiante_id, a.estado])) as Record<string, 'Presente' | 'Ausente' | 'Atraso'>
  )
  const [partData, setPartData] = useState<Record<string, { nivel: number | null; obs: string }>>({})
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    students.length > 0 ? students[0].id : null
  )
  const [isPending, startTransition] = useTransition()
  const [fichaId, setFichaId] = useState<string | null>(null)

  const selectedStudent = students.find(s => s.id === selectedStudentId)

  function cambiarAsistencia(estudianteId: string, estado: 'Presente' | 'Ausente' | 'Atraso') {
    setAsistencia(prev => ({ ...prev, [estudianteId]: estado }))

    // Auto-guardar
    const horas = estado === 'Ausente'
      ? 0
      : estado === 'Atraso'
        ? Math.max(1, Math.round(horasClase / 2))
        : horasClase

    startTransition(() => {
      registrarAsistenciaMasiva(cursoId, fecha, [{
        estudiante_id: estudianteId,
        estado,
        atraso: estado === 'Atraso',
        horas,
        participacion: partData[estudianteId]?.nivel ?? null,
        observacion_participacion: partData[estudianteId]?.obs?.trim() || null,
      }], bitacoraId)
    })
  }

  function setNivel(id: string, nivel: number) {
    setPartData(prev => ({ ...prev, [id]: { ...prev[id], nivel, obs: prev[id]?.obs ?? '' } }))
  }

  function setObs(id: string, obs: string) {
    setPartData(prev => ({ ...prev, [id]: { nivel: prev[id]?.nivel ?? null, obs } }))
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Lista de estudiantes (sidebar izquierdo) */}
      <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg bg-gray-800/30">
        {students.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-8">Sin estudiantes</p>
        ) : (
          <div className="space-y-0.5 p-2">
            {students.map(s => {
              const estado = asistencia[s.id]
              const ESTADO_COLOR = {
                'Presente': 'bg-emerald-900/40 border-emerald-700 text-emerald-400',
                'Atraso': 'bg-amber-900/40 border-amber-700 text-amber-400',
                'Ausente': 'bg-red-900/40 border-red-700 text-red-400',
              }
              const estadoClases = estado ? ESTADO_COLOR[estado] : 'bg-gray-700 text-gray-400'

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                    selectedStudentId === s.id
                      ? 'bg-gray-700 border border-gray-600'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <span className="flex-1 truncate text-gray-300">{formatNombreCorto(s.nombre)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${estadoClases}`}>
                    {estado ? (estado === 'Presente' ? 'P' : estado === 'Atraso' ? 'A' : 'F') : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Panel de detalle (derecha) */}
      {selectedStudent ? (
        <div className="flex-1 border border-gray-700 rounded-lg bg-gray-800/30 p-4 flex flex-col overflow-hidden">
          <div className="mb-4 pb-4 border-b border-gray-700">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white mb-1">{selectedStudent.nombre}</h3>
                <p className="text-xs text-gray-500">{selectedStudent.email}</p>
                {selectedStudent.tutoria && (
                  <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1">
                    <span className="bg-blue-900/40 border border-blue-700 px-1.5 py-0.5 rounded">📘 Citado a tutorías</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setFichaId(selectedStudent.id)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-gray-800 border border-gray-700 text-gray-400 hover:text-brand-400 hover:border-brand-700 rounded-full transition-colors"
                title="Ver ficha completa del estudiante"
              >
                ⓘ Ficha
              </button>
            </div>
          </div>

          {/* Asistencia */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">
              Asistencia
            </label>
            <div className="flex gap-2">
              {(['Presente', 'Atraso', 'Ausente'] as const).map(e => {
                const isSelected = asistencia[selectedStudent.id] === e
                const colors = {
                  'Presente': 'emerald',
                  'Atraso': 'amber',
                  'Ausente': 'red',
                }
                const color = colors[e]
                return (
                  <button
                    key={e}
                    onClick={() => cambiarAsistencia(selectedStudent.id, e)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors border ${
                      isSelected
                        ? `bg-${color}-600 text-white border-${color}-500`
                        : `bg-gray-700 text-gray-400 hover:bg-gray-600 border-gray-600`
                    }`}
                  >
                    {e === 'Presente' ? 'Presente' : e === 'Atraso' ? 'Atraso' : 'Ausente'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Participación */}
          <div className="flex-1 overflow-y-auto">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">
              Participación
            </label>

            <div className="space-y-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setNivel(selectedStudent.id, n)}
                    title={NIVEL_LABELS[n]}
                    className={`flex-1 h-8 rounded text-xs font-bold transition-colors border ${
                      partData[selectedStudent.id]?.nivel === n
                        ? `${NIVEL_COLORS[n]} text-white border-opacity-50`
                        : 'bg-gray-700 text-gray-500 hover:text-white border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={partData[selectedStudent.id]?.obs ?? ''}
                onChange={e => setObs(selectedStudent.id, e.target.value)}
                placeholder="Observación de participación…"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Botón siguiente */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={() => {
                const currentIdx = students.findIndex(s => s.id === selectedStudentId)
                if (currentIdx < students.length - 1) {
                  setSelectedStudentId(students[currentIdx + 1].id)
                }
              }}
              disabled={students.findIndex(s => s.id === selectedStudentId) === students.length - 1}
              className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      ) : null}

      {/* Ficha del estudiante */}
      {fichaId && (
        <FichaEstudianteDrawer
          estudianteId={fichaId}
          cursoId={cursoId}
          onClose={() => setFichaId(null)}
        />
      )}
    </div>
  )
}
