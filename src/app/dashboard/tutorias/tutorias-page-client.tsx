'use client'

import { useState } from 'react'
import { TutoriasManager } from './tutorias-manager'
import { HistorialTab } from '@/components/tutorias/HistorialTab'
import { CitacionesTab } from '@/components/tutorias/CitacionesTab'
import type { ReservaHistorial } from '@/lib/actions/tutorias'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  profesor_id: string
  disponible_hasta: string | null
}

interface Reserva {
  id: number
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  telefono: string
  fecha: string
  horario_id: number | null
  estado: string
  cancelado_por?: string | null
  cancelado_at?: string | null
  asistio?: boolean | null
  completada_at?: string | null
  notas?: string | null
  modalidad?: string | null
  link_zoom?: string | null
}

interface Estudiante {
  id: string
  nombre: string
  email: string
  auth_user_id: string | null
  carrera?: string | null
  telefono?: string | null
  curso_id?: string | null
}

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  cursos: { id: string; asignatura: string } | null
  anuncios_tutoria_curso?: {
    estudiante_id: string
    fecha: string
    estudiantes: { nombre: string; carrera: string; email: string }
  }[]
}

interface Curso {
  id: string
  asignatura: string
  institucion: string | null
  codigo: string | null
}

interface Citacion {
  id: string
  fecha_citacion: string
  razon: string
  detalle_razon: string | null
  estado: string
  cursos: { id: string; asignatura: string; institucion: string | null } | null
  estudiantes: { id: string; nombre: string; email: string } | null
}

interface Props {
  horarios: Horario[]
  reservas: Reserva[]
  clases: Clase[]
  estudiantes: Estudiante[]
  cursos: Curso[]
  profesorNombre: string
  historial: ReservaHistorial[]
  citaciones: Citacion[]
}

type Tab = 'citaciones' | 'historial' | 'horarios'

export function TutoriasPageClient({
  horarios,
  reservas,
  clases,
  estudiantes,
  cursos,
  profesorNombre,
  historial,
  citaciones,
}: Props) {
  const [tab, setTab] = useState<Tab>('citaciones')

  const pendientesCount = reservas.filter(
    r => r.estado === 'pendiente' || r.estado === 'confirmada'
  ).length

  const citacionesPendientes = citaciones.filter(
    c => c.estado === 'pendiente' || c.estado === 'agendada'
  ).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Tutorías</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-800">
        <TabButton active={tab === 'citaciones'} onClick={() => setTab('citaciones')}>
          Citaciones
          {citacionesPendientes > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[9px] font-bold">
              {citacionesPendientes}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
          Historial y Exportación
        </TabButton>
        <TabButton active={tab === 'horarios'} onClick={() => setTab('horarios')}>
          Mis Horarios
          {pendientesCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold">
              {pendientesCount}
            </span>
          )}
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === 'citaciones' && (
        <CitacionesTab citaciones={citaciones} />
      )}
      {tab === 'historial' && (
        <HistorialTab
          historial={historial}
          cursos={cursos}
          estudiantes={estudiantes}
        />
      )}
      {tab === 'horarios' && (
        <TutoriasManager
          horarios={horarios}
          reservas={reservas}
          clases={clases}
          estudiantes={estudiantes}
          profesorNombre={profesorNombre}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-400 text-brand-300'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
      }`}
    >
      {children}
    </button>
  )
}
