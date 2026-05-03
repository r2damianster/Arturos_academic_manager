'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarEstadoCitacion } from '@/lib/actions/citaciones'

interface Citacion {
  id: string
  estudiante_id: string
  fecha_citacion: string
  razon: string
  detalle_razon: string | null
  estado: string
  estudiantes: {
    nombre: string
    email: string
  }
}

interface Props {
  cursoId: string
  initialCitaciones: any[]
  currentMonth: string
}

export function CitacionesClient({ cursoId, initialCitaciones, currentMonth }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const citaciones = initialCitaciones as Citacion[]

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      router.push(`/dashboard/cursos/${cursoId}/citaciones?mes=${val}`)
    } else {
      router.push(`/dashboard/cursos/${cursoId}/citaciones`)
    }
  }

  const handleEstadoChange = (citacionId: string, nuevoEstado: string) => {
    startTransition(async () => {
      await actualizarEstadoCitacion(citacionId, nuevoEstado, cursoId)
      router.refresh()
    })
  }

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <span className="bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 px-2 py-1 rounded-full text-xs font-medium">Pendiente</span>
      case 'agendada': return <span className="bg-blue-900/50 text-blue-400 border border-blue-700/50 px-2 py-1 rounded-full text-xs font-medium">Agendada</span>
      case 'asistida': return <span className="bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 px-2 py-1 rounded-full text-xs font-medium">Asistida</span>
      case 'no_asistida': return <span className="bg-red-900/50 text-red-400 border border-red-700/50 px-2 py-1 rounded-full text-xs font-medium">No Asistió</span>
      case 'cumplida': 
      case 'mejorado':
        return <span className="bg-gray-800 text-gray-400 border border-gray-700 px-2 py-1 rounded-full text-xs font-medium">Cumplida/Mejorado</span>
      default: return <span className="text-gray-500 text-xs">{estado}</span>
    }
  }

  const getRazonLabel = (razon: string) => {
    switch (razon) {
      case 'inasistencia': return 'Inasistencia'
      case 'bajo_desempeño': return 'Bajo Desempeño'
      case 'asignacion_trabajo': return 'Asignación de Trabajo'
      case 'otro': return 'Otro'
      default: return razon
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-400">Ver mes:</label>
          <input 
            type="month" 
            value={currentMonth}
            onChange={handleMonthChange}
            className="bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:ring-brand-500 outline-none"
          />
          <button 
            onClick={() => router.push(`/dashboard/cursos/${cursoId}/citaciones`)}
            className="text-xs text-brand-400 hover:text-brand-300 ml-2"
          >
            Ver todos
          </button>
        </div>
        
        <div className="text-sm text-gray-500">
          {citaciones.length} citaciones encontradas
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        {citaciones.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No hay citaciones registradas para este período.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-900/50 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Estudiante</th>
                <th className="px-4 py-3 font-medium">Razón</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium text-center">Estado Actual</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {citaciones.map((cit) => (
                <tr key={cit.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(cit.fecha_citacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    {cit.estudiantes?.nombre}
                  </td>
                  <td className="px-4 py-3">
                    {getRazonLabel(cit.razon)}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={cit.detalle_razon || ''}>
                    {cit.detalle_razon || <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(cit.estado)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={cit.estado}
                      onChange={(e) => handleEstadoChange(cit.id, e.target.value)}
                      disabled={isPending}
                      className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:opacity-50"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="agendada">Agendada</option>
                      <option value="asistida">Asistió a Tutoría</option>
                      <option value="no_asistida">No Asistió</option>
                      <option value="cumplida">Cumplida / Mejorado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
