'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { actualizarCurso, eliminarCurso } from '@/lib/actions/cursos'
import { addLogro, updateLogro, deleteLogro } from '@/lib/actions/logros'
import { OcrLogroModal } from '@/components/logros/OcrLogroModal'
import { HorariosEditor } from '@/components/cursos/horarios-editor'
import type { HorarioClase } from '@/components/cursos/horarios-form-fields'

type Tab = 'info' | 'calendario' | 'horarios' | 'evaluacion' | 'logros' | 'peligro'

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
  encuesta_inicial_habilitada?: boolean | null
  encuesta_parcial_habilitada?: boolean | null
}

interface LogroItem {
  id: string
  descripcion: string
  orden: number
}

interface Props {
  cursoId: string
  curso: Curso
  clases: HorarioClase[]
  logros: LogroItem[]
  profesorInstitucion?: string | null
  defaultTab: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'info',       label: 'Información' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'horarios',   label: 'Horarios' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'logros',     label: 'Logros' },
  { id: 'peligro',    label: '⚠ Zona peligrosa' },
]

export function EditarClient({ cursoId, curso, clases, logros: logrosInit, profesorInstitucion, defaultTab }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>((TABS.find(t => t.id === defaultTab)?.id) ?? 'info')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Encuestas — estado controlado (checkboxes)
  const [encuestaInicialHab, setEncuestaInicialHab] = useState(curso.encuesta_inicial_habilitada ?? true)
  const [encuestaParcialHab, setEncuestaParcialHab] = useState(curso.encuesta_parcial_habilitada ?? true)

  // Evaluación — estado local
  const numParcialesInicial = curso.num_parciales ?? 2
  const [numParciales, setNumParciales] = useState(numParcialesInicial)
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

    if (tab === 'info') {
      fd.set('encuesta_inicial_habilitada', encuestaInicialHab ? '1' : '0')
      fd.set('encuesta_parcial_habilitada', encuestaParcialHab ? '1' : '0')
    }

    if (tab === 'evaluacion') {
      fd.set('num_parciales', String(numParciales))
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
          {/* Encuestas */}
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Encuestas</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encuestaInicialHab}
                  onChange={e => setEncuestaInicialHab(e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-sm text-gray-300">Habilitar ficha inicial del estudiante</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encuestaParcialHab}
                  onChange={e => setEncuestaParcialHab(e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-sm text-gray-300">
                  Habilitar encuesta de progreso
                  <span className="text-gray-500 ml-1">(se activa al 50% del semestre)</span>
                </span>
              </label>
            </div>
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

      {/* Tab — Logros de aprendizaje */}
      {tab === 'logros' && (
        <LogrosTab cursoId={cursoId} logrosInit={logrosInit} />
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

function LogrosTab({ cursoId, logrosInit }: { cursoId: string; logrosInit: LogroItem[] }) {
  const [logros, setLogros] = useState<LogroItem[]>(logrosInit)
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [ocrOpen, setOcrOpen] = useState(false)

  async function handleAdd() {
    if (!nuevoTexto.trim()) return
    setAdding(true)
    setErrMsg('')
    const res = await addLogro(cursoId, nuevoTexto.trim())
    if (res.error) { setErrMsg(res.error); setAdding(false); return }
    setLogros(prev => [...prev, { id: res.id!, descripcion: nuevoTexto.trim(), orden: prev.length }])
    setNuevoTexto('')
    setAdding(false)
  }

  async function handleUpdate(id: string) {
    if (!editTexto.trim()) return
    setSaving(true)
    setErrMsg('')
    const res = await updateLogro(id, editTexto.trim())
    if (res.error) { setErrMsg(res.error); setSaving(false); return }
    setLogros(prev => prev.map(l => l.id === id ? { ...l, descripcion: editTexto.trim() } : l))
    setEditId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await deleteLogro(id)
    if (res.error) { setErrMsg(res.error); return }
    setLogros(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="card space-y-5">
      <div>
        <h3 className="font-semibold text-white mb-1">Logros / Objetivos de aprendizaje</h3>
        <p className="text-xs text-gray-500">
          Define los logros de la asignatura. Al generar una guía de estudio con IA, podrás seleccionar
          el logro al que aporta esa semana.
        </p>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {logros.length === 0 && (
          <p className="text-sm text-gray-500 italic">Sin logros definidos aún.</p>
        )}
        {logros.map((l, i) => (
          <div key={l.id} className="flex gap-2 items-start group">
            <span className="flex-shrink-0 w-6 h-6 mt-1 rounded-full bg-brand-600/20 border border-brand-600/40 text-brand-400 text-xs flex items-center justify-center font-bold">
              {i + 1}
            </span>
            {editId === l.id ? (
              <div className="flex-1 flex gap-2">
                <textarea
                  className="input flex-1 text-sm resize-none"
                  rows={2}
                  value={editTexto}
                  onChange={e => setEditTexto(e.target.value)}
                  maxLength={500}
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdate(l.id)}
                    disabled={saving}
                    className="px-2 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50"
                  >
                    {saving ? '…' : '✓'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="px-2 py-1 text-xs rounded border border-gray-600 text-gray-400 hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="flex-1 text-sm text-gray-200 leading-relaxed pt-1">{l.descripcion}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditId(l.id); setEditTexto(l.descripcion) }}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800 text-xs"
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/20 text-xs"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Agregar */}
      <div className="space-y-2 pt-2 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <label className="label">Agregar logro</label>
          <button
            type="button"
            onClick={() => setOcrOpen(true)}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
            title="Importar desde imagen con IA"
          >
            📷 Desde imagen
          </button>
        </div>
        <textarea
          className="input text-sm resize-none"
          rows={3}
          value={nuevoTexto}
          onChange={e => setNuevoTexto(e.target.value)}
          maxLength={500}
          placeholder="Ej: Analiza y aplica los principios de la programación orientada a objetos para resolver problemas de software de mediana complejidad."
        />
        {errMsg && <p className="text-red-400 text-xs">{errMsg}</p>}
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !nuevoTexto.trim()}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {adding ? 'Agregando…' : '+ Agregar logro'}
        </button>
      </div>

      {ocrOpen && (
        <OcrLogroModal
          cursoId={cursoId}
          nextOrden={logros.length}
          onInserted={inserted => setLogros(prev => [...prev, ...inserted])}
          onClose={() => setOcrOpen(false)}
        />
      )}
    </div>
  )
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
