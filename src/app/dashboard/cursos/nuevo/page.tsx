'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { crearCursoBase, actualizarCurso } from '@/lib/actions/cursos'
import { HorariosEditor } from '@/components/cursos/horarios-editor'

// ─── Utilidades ───────────────────────────────────────────────────────────────

function generarCodigo(asignatura: string, periodo: string): string {
  const skip = new Set(['and','or','of','the','a','an','de','la','el','en','y','o','con','para','por','del','los','las'])
  const siglas = asignatura.trim().split(/\s+/)
    .filter(p => p.length > 0 && !skip.has(p.toLowerCase()))
    .map(p => p[0].toLowerCase()).join('')
  const pc = periodo.replace(/^20/, '').replace(/[-_\s]/g, '').toLowerCase().slice(0, 3)
  return (siglas + pc).slice(0, 15)
}

// ─── Stepper UI ───────────────────────────────────────────────────────────────

const STEPS = ['Información', 'Calendario', 'Horarios', 'Evaluación']

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            i === step
              ? 'bg-brand-600/20 border border-brand-600/40 text-brand-400'
              : i < step
              ? 'text-emerald-400'
              : 'text-gray-600'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i < step ? 'bg-emerald-500/20 text-emerald-400' : i === step ? 'bg-brand-600/30 text-brand-300' : 'bg-gray-800 text-gray-600'
            }`}>
              {i < step ? '✓' : i + 1}
            </span>
            {label}
          </div>
          {i < STEPS.length - 1 && <span className="text-gray-700 text-xs">›</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Botones de navegación ────────────────────────────────────────────────────

function NavButtons({
  step, loading, cursoId, onBack, onSkip, submitLabel,
}: {
  step: number
  loading: boolean
  cursoId: string | null
  onBack?: () => void
  onSkip?: () => void
  submitLabel: string
}) {
  const router = useRouter()
  const isLast = step === STEPS.length - 1

  return (
    <div className="flex gap-2 flex-wrap">
      {step > 0 && (
        <button type="button" onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
          ← Atrás
        </button>
      )}
      {step > 0 && !isLast && (
        <button type="button" onClick={onSkip}
          className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
          Saltar
        </button>
      )}
      <button type="submit" disabled={loading} className="btn-primary flex-1 min-w-[140px]">
        {loading ? 'Guardando…' : submitLabel}
      </button>
      {step > 0 && cursoId && (
        <button type="button" onClick={() => router.push(`/dashboard/cursos/${cursoId}`)}
          className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
          Terminar
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NuevoCursoPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [cursoId, setCursoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 0 — Información
  const [asignatura, setAsignatura] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoManual, setCodigoManual] = useState(false)
  const [numParciales, setNumParciales] = useState(2)
  const [esTutorados, setEsTutorados] = useState(false)

  // Step 3 — Evaluación
  const [nombres, setNombres] = useState(['ACD', 'TA', 'PE', 'EX'])

  useEffect(() => {
    if (!codigoManual && (asignatura || periodo)) setCodigo(generarCodigo(asignatura, periodo))
  }, [asignatura, periodo, codigoManual])

  async function handleStep0(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('num_parciales', String(numParciales))
    fd.set('tipo', esTutorados ? 'tutorados' : 'regular')
    const res = await crearCursoBase(fd)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setCursoId(res.cursoId!)
    const goTerminar = (e.nativeEvent as SubmitEvent).submitter?.dataset.action === 'terminar'
    if (goTerminar) { router.push(`/dashboard/cursos/${res.cursoId}`); return }
    setStep(1)
  }

  async function handleStepUpdate(e: React.FormEvent<HTMLFormElement>, nextStep: number) {
    e.preventDefault()
    if (!cursoId) return
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)

    if (step === 3) {
      fd.set('num_parciales', String(numParciales))
      fd.set('nombres_tareas', JSON.stringify(nombres))
    }

    const res = await actualizarCurso(cursoId, fd)
    setLoading(false)
    if (res.error) { setError(res.error); return }

    const goTerminar = (e.nativeEvent as SubmitEvent).submitter?.dataset.action === 'terminar'
    if (goTerminar || step === 3) { router.push(`/dashboard/cursos/${cursoId}`); return }
    setStep(nextStep)
  }

  function skip() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else if (cursoId) router.push(`/dashboard/cursos/${cursoId}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cursos" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo curso</h1>
          <p className="text-gray-400 text-sm">
            {step === 0 ? 'Información básica' : step === 1 ? 'Calendario y carga horaria' : step === 2 ? 'Horarios de clase' : 'Configuración de evaluación'}
          </p>
        </div>
      </div>

      <Stepper step={step} />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* ── Paso 0: Información ── */}
      {step === 0 && (
        <form onSubmit={handleStep0} className="card space-y-5">
          <div>
            <label className="label">Nombre de la asignatura *</label>
            <input name="asignatura" className="input" required maxLength={100}
              placeholder="Academic Reading and Writing II"
              value={asignatura} onChange={e => setAsignatura(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Período *</label>
              <input name="periodo" className="input" required maxLength={20}
                placeholder="2026-1" value={periodo} onChange={e => setPeriodo(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Ej: 2026-1, 2025-II</p>
            </div>
            <div>
              <label className="label">
                Código
                {!codigoManual && <span className="ml-2 text-xs text-brand-400 font-normal">auto</span>}
              </label>
              <input name="codigo" className="input" required maxLength={30} placeholder="arwi261"
                value={codigo}
                onChange={e => { setCodigo(e.target.value); setCodigoManual(true) }}
                onFocus={() => setCodigoManual(true)} />
              {codigoManual && (
                <button type="button" className="text-xs text-gray-500 hover:text-gray-300 mt-1"
                  onClick={() => { setCodigoManual(false); setCodigo(generarCodigo(asignatura, periodo)) }}>
                  ↺ Regenerar
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="label">Institución</label>
            <input name="institucion" className="input" maxLength={200}
              placeholder="Ej: ULEAM — Facultad de Ciencias Informáticas" />
          </div>

          <div>
            <label className="label">Aula</label>
            <input name="aula" className="input" maxLength={100}
              placeholder="Ej: Aula 102 – Bloque PADF" />
          </div>

          <div>
            <label className="label">Número de parciales</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <label key={n} className="flex-1 cursor-pointer">
                  <input type="radio" name="num_parciales_display" value={n}
                    checked={numParciales === n} onChange={() => setNumParciales(n)} className="sr-only" />
                  <div className={`text-center py-2.5 rounded-lg border transition-colors ${
                    numParciales === n ? 'border-brand-500 bg-brand-600/20 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                    <span className="text-lg font-bold block">{n}</span>
                    <span className="text-xs">parciales</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea name="observacion" className="input" rows={2} maxLength={500}
              placeholder="Notas generales, características del grupo, etc." />
          </div>

          <div className="pt-2 border-t border-gray-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={esTutorados}
                onChange={e => setEsTutorados(e.target.checked)}
                className="w-4 h-4 accent-purple-600" />
              <div>
                <span className="text-sm text-gray-300">Grupo de tutorados (asesoría de trabajos)</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Seguimiento individual de tesis, artículos o proyectos. No usa pase de lista ni calificaciones.
                </p>
              </div>
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" data-action="continuar" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creando…' : 'Crear y continuar →'}
            </button>
            <button type="submit" data-action="terminar" disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              Crear y terminar
            </button>
          </div>
        </form>
      )}

      {/* ── Paso 1: Calendario y carga ── */}
      {step === 1 && cursoId && (
        <form onSubmit={e => handleStepUpdate(e, 2)} className="card space-y-4">
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
              <label className="label">Horas / semana</label>
              <input name="horas_semana" type="number" className="input" defaultValue={64} min={1} max={200} />
            </div>
            <div>
              <label className="label">Nº sesiones</label>
              <input name="num_sesiones" type="number" className="input" defaultValue={32} min={1} max={200} />
            </div>
            <div>
              <label className="label">Horas teóricas</label>
              <input name="horas_teoricas" type="number" className="input" defaultValue={64} min={1} max={200} />
            </div>
          </div>
          <NavButtons step={step} loading={loading} cursoId={cursoId}
            onBack={() => setStep(0)} onSkip={skip}
            submitLabel="Guardar y siguiente →" />
        </form>
      )}

      {/* ── Paso 2: Horarios ── */}
      {step === 2 && cursoId && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-400">
            Define días y horas de clase. Se usarán para cruzar con tutorías y exportar asistencia.
          </p>
          <HorariosEditor cursoId={cursoId} initialClases={[]} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              ← Atrás
            </button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary flex-1">
              Siguiente →
            </button>
            <button type="button" onClick={() => router.push(`/dashboard/cursos/${cursoId}`)}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              Terminar
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: Evaluación ── */}
      {step === 3 && cursoId && (
        <form onSubmit={e => handleStepUpdate(e, 3)} className="card space-y-5">
          <div>
            <label className="label">Número de parciales</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" onClick={() => setNumParciales(n)}
                  className={`flex-1 py-2.5 rounded-lg border transition-colors ${
                    numParciales === n ? 'border-brand-500 bg-brand-600/20 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  <span className="text-lg font-bold block">{n}</span>
                  <span className="text-xs">parciales</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Nombres de componentes</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Componente 1','Componente 2','Componente 3','Componente 4']).map((label, i) => (
                <div key={i}>
                  <label className="label">{label}</label>
                  <input className="input" value={nombres[i]} maxLength={8} required
                    placeholder={['ACD','TA','PE','EX'][i]}
                    onChange={e => { const n = [...nombres]; n[i] = e.target.value; setNombres(n) }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Ej: ACD (Actividades), TA (Trabajos), PE (Prueba escrita), EX (Examen)</p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              ← Atrás
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando…' : 'Guardar y terminar ✓'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
