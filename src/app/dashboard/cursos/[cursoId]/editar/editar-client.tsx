'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { actualizarCurso, eliminarCurso } from '@/lib/actions/cursos'
import { HorariosEditor } from '@/components/cursos/horarios-editor'
import type { HorarioClase } from '@/components/cursos/horarios-form-fields'

type Tab = 'info' | 'calendario' | 'horarios' | 'evaluacion' | 'peligro'

interface Curso {
  asignatura: string
  codigo: string
  periodo: string
  aula?: string | null
  institucion?: string | null
  observacion?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  horas_semana: number
  num_sesiones: number
  horas_teoricas: number
  num_parciales?: number | null
  nombres_tareas?: string[] | null
}

interface Props {
  cursoId: string
  curso: Curso
  clases: HorarioClase[]
  profesorInstitucion?: string | null
  defaultTab: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'info',       label: 'Información' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'horarios',   label: 'Horarios' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'peligro',    label: '⚠ Zona peligrosa' },
]

export function EditarClient({ cursoId, curso, clases, profesorInstitucion, defaultTab }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>((TABS.find(t => t.id === defaultTab)?.id) ?? 'info')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Evaluación — estado local
  const numParcialesInicial = curso.num_parciales ?? 2
  const nombresInicial: string[] = Array.isArray(curso.nombres_tareas) && curso.nombres_tareas.length === 4
    ? curso.nombres_tareas
    : ['ACD', 'TA', 'PE', 'EX']
  const [numParciales, setNumParciales] = useState(numParcialesInicial)
  const [nombres, setNombres] = useState(nombresInicial)
  const [pendingReducir, setPendingReducir] = useState(false)

  // Zona peligrosa — doble confirmación
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteLoading, setDeleteLoading] = useState(false)

  function changeTab(t: Tab) {
    setTab(t)
    setSuccess('')
    setError('')
    setPendingReducir(false)
    setDeleteStep(0)
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')
    const fd = new FormData(e.currentTarget)

    if (tab === 'evaluacion') {
      fd.set('num_parciales', String(numParciales))
      fd.set('nombres_tareas', JSON.stringify(nombres))
      if (numParciales < numParcialesInicial) {
        if (!pendingReducir) {
          setLoading(false)
          setPendingReducir(true)
          return
        }
        fd.set('confirmacion_borrado', '1')
      }
    }

    const res = await actualizarCurso(cursoId, fd)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setSuccess('Guardado correctamente')
    setPendingReducir(false)
    setTimeout(() => setSuccess(''), 3000)
    router.refresh()
  }

  async function handleEliminar() {
    if (deleteStep < 1) { setDeleteStep(1); return }
    setDeleteLoading(true)
    await eliminarCurso(cursoId)
    // eliminarCurso redirige — no necesitamos manejar nada más
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar curso</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => changeTab(t.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-600/20 text-brand-400 border border-brand-600/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            } ${t.id === 'peligro' && tab !== 'peligro' ? 'hover:text-red-400' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab — Información */}
      {tab === 'info' && (
        <form onSubmit={submitForm} className="card space-y-4">
          <div>
            <label className="label">Institución</label>
            <input name="institucion" className="input" maxLength={200}
              defaultValue={curso.institucion ?? ''}
              placeholder={profesorInstitucion ?? 'Ej: ULEAM — Facultad de Ciencias Informáticas'} />
          </div>
          <div>
            <label className="label">Nombre de la asignatura</label>
            <input name="asignatura" className="input" required maxLength={100} defaultValue={curso.asignatura} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Período</label>
              <input name="periodo" className="input" required maxLength={20} defaultValue={curso.periodo} />
            </div>
            <div>
              <label className="label">Código</label>
              <input name="codigo" className="input" required maxLength={30} defaultValue={curso.codigo} />
            </div>
          </div>
          <div>
            <label className="label">Aula</label>
            <input name="aula" className="input" maxLength={100} defaultValue={curso.aula ?? ''}
              placeholder="Ej: Aula 102 – Bloque PADF" />
          </div>
          <div>
            <label className="label">Observaciones</label>
            <textarea name="observacion" className="input" rows={3} maxLength={500}
              defaultValue={curso.observacion ?? ''}
              placeholder="Notas generales, características del grupo, etc." />
          </div>
          <Feedback success={success} error={error} />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando…' : 'Guardar información'}
            </button>
          </div>
        </form>
      )}

      {/* Tab — Calendario y carga */}
      {tab === 'calendario' && (
        <form onSubmit={submitForm} className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de inicio</label>
              <input name="fecha_inicio" type="date" className="input"
                defaultValue={curso.fecha_inicio ?? ''} />
            </div>
            <div>
              <label className="label">Fecha de fin</label>
              <input name="fecha_fin" type="date" className="input"
                defaultValue={curso.fecha_fin ?? ''} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Horas / semana</label>
              <input name="horas_semana" type="number" className="input" required
                defaultValue={curso.horas_semana} min={1} max={200} />
            </div>
            <div>
              <label className="label">Nº sesiones</label>
              <input name="num_sesiones" type="number" className="input" required
                defaultValue={curso.num_sesiones} min={1} max={200} />
            </div>
            <div>
              <label className="label">Horas teóricas</label>
              <input name="horas_teoricas" type="number" className="input" required
                defaultValue={curso.horas_teoricas} min={1} max={200} />
            </div>
          </div>
          <Feedback success={success} error={error} />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando…' : 'Guardar calendario'}
            </button>
          </div>
        </form>
      )}

      {/* Tab — Horarios */}
      {tab === 'horarios' && (
        <div className="card">
          <p className="text-sm text-gray-400 mb-4">
            Los horarios definen los días y horas de clase. Se usan para cruzar con tutorías y exportar asistencia.
          </p>
          <HorariosEditor cursoId={cursoId} initialClases={clases} />
        </div>
      )}

      {/* Tab — Evaluación */}
      {tab === 'evaluacion' && (
        <form onSubmit={submitForm} className="card space-y-5">
          {/* Parciales */}
          <div>
            <label className="label">Número de parciales</label>
            {numParciales < numParcialesInicial && !pendingReducir && (
              <div className="mb-3 px-3 py-2 bg-amber-900/20 border border-amber-600/40 rounded-lg text-xs text-amber-300">
                ⚠ Al guardar se borrarán las notas del Parcial {numParciales + 1}
                {numParciales + 1 < numParcialesInicial ? ` al ${numParcialesInicial}` : ''} de todos los estudiantes.
              </div>
            )}
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setNumParciales(n); setPendingReducir(false) }}
                  className={`flex-1 py-2.5 rounded-lg border transition-colors ${
                    numParciales === n
                      ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="text-lg font-bold block">{n}</span>
                  <span className="text-xs">parciales</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nombres de componentes */}
          <div>
            <label className="label">Nombres de componentes de calificación</label>
            <p className="text-xs text-gray-500 mb-3">
              Cada parcial tiene 4 componentes. Aplica para todos los parciales.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(['Componente 1', 'Componente 2', 'Componente 3', 'Componente 4']).map((label, i) => (
                <div key={i}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    value={nombres[i]}
                    onChange={e => {
                      const n = [...nombres]; n[i] = e.target.value; setNombres(n)
                    }}
                    maxLength={8}
                    placeholder={['ACD', 'TA', 'PE', 'EX'][i]}
                    required
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Ej: ACD (Actividades), TA (Trabajos), PE (Prueba escrita), EX (Examen)</p>
          </div>

          {/* Confirmación de borrado de notas */}
          {pendingReducir && (
            <div className="space-y-3 p-3 bg-red-900/20 border border-red-700/50 rounded-xl">
              <p className="text-sm text-red-300 font-medium">
                ¿Confirmas que deseas borrar las notas del Parcial {numParciales + 1}
                {numParciales + 1 < numParcialesInicial ? ` al ${numParcialesInicial}` : ''}?
              </p>
              <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50">
                  {loading ? 'Borrando…' : 'Sí, borrar y guardar'}
                </button>
                <button type="button" onClick={() => setPendingReducir(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-200 text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <Feedback success={success} error={error} />

          {!pendingReducir && (
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Guardando…' : 'Guardar evaluación'}
            </button>
          )}
        </form>
      )}

      {/* Tab — Zona peligrosa */}
      {tab === 'peligro' && (
        <div className="card border-red-900/50 space-y-4">
          <div>
            <h3 className="font-semibold text-red-400 mb-1">Eliminar curso</h3>
            <p className="text-sm text-gray-400">
              Se eliminarán permanentemente el curso, sus estudiantes, asistencias, calificaciones y bitácoras.
              Esta acción no se puede deshacer.
            </p>
          </div>

          {deleteStep === 0 && (
            <button
              type="button"
              onClick={handleEliminar}
              className="px-4 py-2 rounded-lg border border-red-700/60 text-red-400 hover:bg-red-900/20 text-sm transition-colors"
            >
              Eliminar curso
            </button>
          )}

          {deleteStep === 1 && (
            <div className="space-y-3 p-3 bg-red-900/20 border border-red-700/50 rounded-xl">
              <p className="text-sm text-red-300 font-medium">
                ¿Estás seguro? Escribe el nombre de la asignatura para confirmar.
              </p>
              <ConfirmarNombreDelete
                nombre={curso.asignatura}
                loading={deleteLoading}
                onConfirm={handleEliminar}
                onCancel={() => setDeleteStep(0)}
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Feedback({ success, error }: { success: string; error: string }) {
  if (success) return <p className="text-emerald-400 text-sm">{success}</p>
  if (error)   return <p className="text-red-400 text-sm">{error}</p>
  return null
}

function ConfirmarNombreDelete({
  nombre, loading, onConfirm, onCancel,
}: {
  nombre: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [texto, setTexto] = useState('')
  return (
    <div className="space-y-3">
      <input
        className="input text-sm"
        placeholder={nombre}
        value={texto}
        onChange={e => setTexto(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={texto !== nombre || loading}
          onClick={onConfirm}
          className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Eliminando…' : 'Confirmar eliminación'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-200 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
