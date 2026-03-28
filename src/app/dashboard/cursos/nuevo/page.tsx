import { crearCursoAction } from '@/lib/actions/cursos'
import Link from 'next/link'

export default function NuevoCursoPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cursos" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo curso</h1>
          <p className="text-gray-400 text-sm">Completa la información del curso</p>
        </div>
      </div>

      <form action={crearCursoAction} className="card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Código del curso *</label>
            <input name="codigo" className="input" placeholder="HP261" required maxLength={30} />
            <p className="text-xs text-gray-500 mt-1">Ej: INF101, HP261-A</p>
          </div>
          <div>
            <label className="label">Período *</label>
            <input name="periodo" className="input" placeholder="2026-1" required maxLength={20} />
            <p className="text-xs text-gray-500 mt-1">Ej: 2026-1, 2025-II</p>
          </div>
        </div>

        <div>
          <label className="label">Nombre de la asignatura *</label>
          <input name="asignatura" className="input" placeholder="Herramientas de Productividad" required maxLength={100} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de inicio</label>
            <input name="fecha_inicio" type="date" className="input" />
          </div>
          <div>
            <label className="label">Fecha de fin</label>
            <input name="fecha_fin" type="date" className="input" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Horas/semana</label>
            <input name="horas_semana" type="number" className="input" defaultValue={16} min={1} max={40} />
          </div>
          <div>
            <label className="label">Nº sesiones</label>
            <input name="num_sesiones" type="number" className="input" defaultValue={8} min={1} max={100} />
          </div>
          <div>
            <label className="label">Horas teóricas</label>
            <input name="horas_teoricas" type="number" className="input" defaultValue={16} min={1} max={100} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">Crear curso</button>
          <Link href="/dashboard/cursos" className="btn-ghost flex-1 text-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
