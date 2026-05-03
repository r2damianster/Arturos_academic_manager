'use client'

import Link from 'next/link'
import { formatNombreCorto } from '@/lib/format'
import { ParticipacionRecord } from './participacion-grid'

interface Estudiante {
  id: string
  nombre: string
  email?: string
}

export interface AsistenciaStats {
  total_sesiones: number
  presentes: number
  ausentes: number
  atrasos: number
  porcentaje: number | null
}

interface Props {
  estudiantes: Estudiante[]
  asistenciaMap: Record<string, AsistenciaStats>
  calificaciones: Record<string, Record<string, number | null>>
  participacion: ParticipacionRecord[]
}

function round(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return null
  const mult = 10 ** digits
  return Math.round(value * mult) / mult
}

function promedioNumeros(values: number[]) {
  if (!values.length) return null
  return round(values.reduce((sum, n) => sum + n, 0) / values.length)
}

export function ResumenEstudiantes({ estudiantes, asistenciaMap, calificaciones, participacion }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {estudiantes.map(est => {
          const asistencia = asistenciaMap[est.id] ?? {
            total_sesiones: 0,
            presentes: 0,
            ausentes: 0,
            atrasos: 0,
            porcentaje: null,
          }

          const participaciones = participacion
            .filter(r => r.estudiante_id === est.id && r.nivel != null)
            .sort((a, b) => b.fecha.localeCompare(a.fecha))

          const promedioPart = promedioNumeros(participaciones.map(r => r.nivel!))
          const ultimoNivel = participaciones[0]?.nivel ?? null
          const ultimoFecha = participaciones[0]?.fecha

          const calif = calificaciones[est.id] ?? {}
          const notas = Object.values(calif).filter((v): v is number => typeof v === 'number' && v > 0)
          const promedioCalif = promedioNumeros(notas)

          return (
            <article key={est.id} className="card border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/dashboard/estudiantes/${est.id}`} className="font-semibold text-gray-100 hover:text-white block truncate">
                    {formatNombreCorto(est.nombre)}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">{est.email ?? 'Sin email'}</p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.24em] text-gray-500">Resumen</div>
              </div>

              <div className="grid gap-3 mt-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-950 p-3 border border-gray-800">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Asistencia</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {asistencia.presentes}/{asistencia.total_sesiones}
                  </p>
                  <p className="text-sm text-gray-400">
                    {asistencia.porcentaje != null ? `${asistencia.porcentaje.toFixed(1)}%` : 'Sin sesiones'}
                  </p>
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p>Ausentes: {asistencia.ausentes}</p>
                    <p>Atrasos: {asistencia.atrasos}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950 p-3 border border-gray-800">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Participación</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {promedioPart != null ? promedioPart.toFixed(1) : '—'}
                  </p>
                  <p className="text-sm text-gray-400">{participaciones.length} registro{participaciones.length === 1 ? '' : 's'}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Último nivel: {ultimoNivel != null ? ultimoNivel : '—'}{ultimoFecha ? ` (${ultimoFecha.slice(5)})` : ''}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 p-3 border border-gray-800">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Calificaciones</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {promedioCalif != null ? promedioCalif.toFixed(1) : '—'}
                  </p>
                  <p className="text-sm text-gray-400">{notas.length} nota{notas.length === 1 ? '' : 's'}</p>
                  <p className="mt-2 text-xs text-gray-500">Promedio de todas las notas guardadas</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
