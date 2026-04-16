'use client'

import { useState } from 'react'
import { PaseListaClient } from './pase-lista-client'
import type { EstudiantePerfil } from '@/app/dashboard/cursos/[cursoId]/pase-lista/page'

interface Estudiante {
  id: string
  nombre: string
  email: string
  tutoria: boolean
  auth_user_id: string | null
}

interface HorarioTutoria {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  disponible_hasta: string | null
}

interface Props {
  cursoId: string
  asignatura: string
  estudiantes: Estudiante[]
  horasSesion: number
  perfiles: Record<string, EstudiantePerfil>
  horariosTutoria: HorarioTutoria[]
}

export function PaseListaWrapper({
  cursoId,
  asignatura,
  estudiantes,
  horasSesion,
  perfiles,
  horariosTutoria,
}: Props) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy)

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="card">
        <label className="label">Fecha del registro</label>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={e => setFechaSeleccionada(e.target.value)}
          className="input"
        />
        <p className="text-xs text-gray-500 mt-2">
          {fechaSeleccionada === hoy ? '(hoy)' : fechaSeleccionada < hoy ? '(fecha pasada)' : '(fecha futura)'}
        </p>
      </div>

      {/* Pase de lista con fecha seleccionada */}
      <PaseListaClient
        cursoId={cursoId}
        estudiantes={estudiantes}
        fecha={fechaSeleccionada}
        horasSesion={horasSesion}
        perfiles={perfiles}
        horariosTutoria={horariosTutoria}
      />
    </div>
  )
}
