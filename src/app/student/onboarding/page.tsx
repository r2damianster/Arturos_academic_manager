'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEncuesta } from './actions'

type Step = 1 | 2 | 3 | 4 | 5

const TOTAL_STEPS = 5

const LIKERT = [
  { v: 1, label: 'No, para nada' },
  { v: 2, label: 'Poco' },
  { v: 3, label: 'A veces' },
  { v: 4, label: 'Bastante' },
  { v: 5, label: 'Sí, totalmente' },
]

const IA_LABELS: Record<string, string> = {
  comprension: 'Comprender textos',
  resumen:     'Resumir contenido',
  ideas:       'Generar ideas',
  redaccion:   'Redactar textos',
  tareas:      'Resolver tareas',
  verificacion:'Verificar información',
  critico:     'Análisis crítico',
}

function LikertRow({ name, label }: { name: string; label: string }) {
  const [val, setVal] = useState<number | null>(null)
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-300">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {LIKERT.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => setVal(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              val === o.v
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {o.v} – {o.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={val ?? ''} />
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [trabaja, setTrabaja] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await guardarEncuesta(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/student')
      }
    })
  }

  function nextStep() {
    setStep(s => Math.min(s + 1, TOTAL_STEPS) as Step)
    window.scrollTo(0, 0)
  }
  function prevStep() {
    setStep(s => Math.max(s - 1, 1) as Step)
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-start pt-10 pb-20 px-4">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Ficha de estudiante</h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Completa esta ficha una sola vez. Nos ayuda a conocerte mejor y personalizar tu experiencia.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n => (
            <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${n <= step ? 'bg-brand-500' : 'bg-gray-800'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-500 text-right">Paso {step} de {TOTAL_STEPS}</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* PASO 1: Datos personales */}
          {step === 1 && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-white">Datos personales</h2>

              <div>
                <label className="label">Género</label>
                <select name="genero" className="input">
                  <option value="">Prefiero no indicar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                  <option value="prefiero_no_decir">Prefiero no decir</option>
                </select>
              </div>

              <div>
                <label className="label">Fecha de nacimiento</label>
                <input type="date" name="fecha_nac" className="input" />
              </div>

              <div>
                <label className="label">Teléfono</label>
                <input type="tel" name="telefono" className="input" placeholder="+593 99 000 0000" />
              </div>

              <div>
                <label className="label">Gmail personal <span className="text-gray-500">(si tienes)</span></label>
                <input type="email" name="gmail" className="input" placeholder="tucorreo@gmail.com" />
              </div>

              <button type="button" onClick={nextStep} className="btn-primary w-full">
                Siguiente →
              </button>
            </div>
          )}

          {/* PASO 2: Carrera */}
          {step === 2 && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-white">Tu carrera</h2>

              <div>
                <label className="label">Carrera que estudias</label>
                <input name="carrera" className="input" placeholder="Ej. Comunicación Social" />
              </div>

              <div>
                <label className="label">Universidad / Institución</label>
                <input name="institucion" className="input" placeholder="Ej. ULEAM" />
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-800">
                <p className="text-sm text-gray-400">Las siguientes preguntas son opcionales pero muy valiosas:</p>

                <LikertRow
                  name="carrera_inicio_deseada"
                  label="Al principio de la carrera, ¿sentías que estudiabas lo que querías?"
                />
                <LikertRow
                  name="carrera_actual_deseada"
                  label="¿Actualmente sientes que es la carrera que querías estudiar?"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={prevStep} className="btn-ghost flex-1">← Atrás</button>
                <button type="button" onClick={nextStep} className="btn-primary flex-1">Siguiente →</button>
              </div>
            </div>
          )}

          {/* PASO 3: Tecnología y trabajo */}
          {step === 3 && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-white">Tecnología y trabajo</h2>

              <div>
                <label className="label">¿Qué tan cómodo/a te sientes usando tecnología?</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    [1,'Básico'],[2,'Regular'],[3,'Intermedio'],[4,'Avanzado'],[5,'Experto']
                  ].map(([v, lbl]) => (
                    <label key={v} className="flex-1 min-w-[80px]">
                      <input type="radio" name="nivel_tecnologia" value={v} className="sr-only peer" />
                      <span className="block text-center px-2 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 cursor-pointer peer-checked:bg-brand-600/20 peer-checked:border-brand-500 peer-checked:text-white transition-colors">
                        {v} – {lbl}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="label">Dispositivos que tienes <span className="text-gray-500">(marca los que apliquen)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['tiene_laptop','Laptop'],
                    ['tiene_pc_escritorio','PC de escritorio'],
                    ['comparte_pc','Comparto computadora'],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-800 hover:border-gray-600 cursor-pointer">
                      <input type="checkbox" name={name} value="true" className="rounded border-gray-600 bg-gray-800" />
                      <span className="text-sm text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Teléfono móvil</label>
                <select name="dispositivo_movil" className="input">
                  <option value="">Seleccionar</option>
                  <option value="android">Android</option>
                  <option value="ios">iPhone (iOS)</option>
                  <option value="ambos">Tengo ambos</option>
                  <option value="ninguno">No tengo</option>
                </select>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="trabaja_check"
                    checked={trabaja}
                    onChange={e => setTrabaja(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  <input type="hidden" name="trabaja" value={trabaja ? 'true' : 'false'} />
                  <span className="text-sm text-gray-300">Actualmente trabajo</span>
                </label>

                {trabaja && (
                  <div>
                    <label className="label">Tipo de trabajo</label>
                    <input name="tipo_trabajo" className="input" placeholder="Ej. tiempo parcial, remoto, familiar..." />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={prevStep} className="btn-ghost flex-1">← Atrás</button>
                <button type="button" onClick={nextStep} className="btn-primary flex-1">Siguiente →</button>
              </div>
            </div>
          )}

          {/* PASO 4: Lectura e IA */}
          {step === 4 && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-white">Lectura e Inteligencia Artificial</h2>

              <div>
                <label className="label">¿Cuántos libros lees al año (aprox.)?</label>
                <input type="number" name="libros_anio" className="input" min={0} max={200} placeholder="0" />
              </div>

              <LikertRow
                name="gusto_escritura"
                label="¿Cuánto te gusta escribir?"
              />

              <div className="border-t border-gray-800 pt-4 space-y-4">
                <p className="text-sm text-gray-400">
                  ¿Con qué frecuencia usas IA (ChatGPT, Gemini, etc.) para...?
                  <span className="block text-xs mt-1 text-gray-600">1 = Nunca · 5 = Siempre</span>
                </p>
                {Object.entries(IA_LABELS).map(([key, label]) => (
                  <LikertRow key={key} name={`uso_ia_${key}`} label={label} />
                ))}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={prevStep} className="btn-ghost flex-1">← Atrás</button>
                <button type="button" onClick={nextStep} className="btn-primary flex-1">Siguiente →</button>
              </div>
            </div>
          )}

          {/* PASO 5: Problemas y consentimiento */}
          {step === 5 && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-white">Últimas preguntas</h2>

              <div>
                <label className="label">
                  ¿Tienes algún problema o situación que quieras reportar?{' '}
                  <span className="text-gray-500">(opcional)</span>
                </label>
                <textarea
                  name="problemas_reportados"
                  className="input min-h-[80px] resize-y"
                  placeholder="Ej. problemas de conectividad, situación personal, etc."
                />
              </div>

              <div className="border border-gray-700 rounded-xl p-4 space-y-3 bg-gray-900/50">
                <p className="text-sm font-medium text-gray-300">Aviso importante</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Esta plataforma <strong className="text-gray-400">no es un sistema oficial</strong> de tu institución.
                  Es una herramienta académica de apoyo docente. Los datos que ingreses pueden ser utilizados
                  con fines de <strong className="text-gray-400">investigación educativa</strong>, siempre de forma
                  anónima y agregada.
                </p>
                <label className="flex items-start gap-3 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    name="consentimiento"
                    value="true"
                    required
                    className="mt-0.5 rounded border-gray-600 bg-gray-800 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-300">
                    He leído el aviso anterior y consiento que mis datos sean usados con fines de investigación educativa
                  </span>
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={prevStep} className="btn-ghost flex-1">← Atrás</button>
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Guardando...' : 'Completar ficha ✓'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  )
}
