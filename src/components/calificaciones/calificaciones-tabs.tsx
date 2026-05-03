'use client'

import { useState } from 'react'
import { CalificacionesTable } from './calificaciones-table'
import { ParticipacionGrid, type ParticipacionRecord } from './participacion-grid'
import { ResumenEstudiantes, type AsistenciaStats } from './resumen-estudiantes'

interface Estudiante {
  id: string
  nombre: string
  email?: string
  auth_user_id?: string
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  // calificaciones
  calificaciones: Record<string, unknown>
  numParciales: number
  nombresTareas: string[]
  perfiles: Record<string, unknown>
  // participacion
  participacion: ParticipacionRecord[]
  // asistencia
  asistenciaMap: Record<string, AsistenciaStats>
}

type Tab = 'resumen' | 'participacion' | 'calificaciones'

export function CalificacionesTabs({
  cursoId, estudiantes, calificaciones, numParciales, nombresTareas, perfiles, participacion, asistenciaMap,
}: Props) {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setTab('resumen')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'resumen'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Resumen
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            tab === 'resumen' ? 'bg-white/20' : 'bg-gray-800 text-gray-500'
          }`}>
            {estudiantes.length}
          </span>
        </button>
        <button
          onClick={() => setTab('participacion')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'participacion'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Participación
          {participacion.length > 0 && (
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === 'participacion' ? 'bg-white/20' : 'bg-gray-800 text-gray-500'
            }`}>
              {participacion.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('calificaciones')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'calificaciones'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Calificaciones
        </button>
      </div>

      {/* Contenido */}
      {tab === 'resumen' && (
        <ResumenEstudiantes
          estudiantes={estudiantes}
          asistenciaMap={asistenciaMap}
          calificaciones={calificaciones as any}
          participacion={participacion}
        />
      )}
      {tab === 'participacion' && (
        <ParticipacionGrid estudiantes={estudiantes} registros={participacion} />
      )}
      {tab === 'calificaciones' && (
        <CalificacionesTable
          cursoId={cursoId}
          estudiantes={estudiantes as any}
          calificaciones={calificaciones as any}
          numParciales={numParciales}
          nombresTareas={nombresTareas}
          perfiles={perfiles as any}
        />
      )}
    </div>
  )
}
