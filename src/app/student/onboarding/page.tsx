'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEncuesta } from './actions'

type Step = 1 | 2 | 3 | 4 | 5

const TOTAL_STEPS = 5

const LIKERT_GENERAL = [
  { v: 1, label: 'No, para nada' },
  { v: 2, label: 'Poco' },
  { v: 3, label: 'A veces' },
  { v: 4, label: 'Bastante' },
  { v: 5, label: 'Sí, totalmente' },
]

const LIKERT_IA = [
  { v: 1, label: 'Nunca' },
  { v: 2, label: 'Rara vez' },
  { v: 3, label: 'A veces' },
  { v: 4, label: 'Seguido' },
  { v: 5, label: 'Siempre' },
]

const IA_KEYS: { key: string; label: string }[] = [
  { key: 'uso_ia_comprension', label: 'Comprender textos' },
  { key: 'uso_ia_resumen',     label: 'Resumir contenido' },
  { key: 'uso_ia_ideas',       label: 'Generar ideas' },
  { key: 'uso_ia_redaccion',   label: 'Redactar textos' },
  { key: 'uso_ia_tareas',      label: 'Resolver tareas' },
  { key: 'uso_ia_verificacion',label: 'Verificar información' },
  { key: 'uso_ia_critico',     label: 'Análisis crítico' },
  { key: 'uso_ia_traduccion',  label: 'Traducción de textos' },
  { key: 'uso_ia_idiomas',     label: 'Aprender idiomas' },
]

const CARRERAS_GRADO = [
  'Pedagogía de los Idiomas Nacionales y Extranjeros',
  'Psicología Educativa',
  'Medicina',
  'Medicina Veterinaria',
  'Otra',
]

const CARRERAS_POSGRADO = [
  'Maestría en Educación con Mención en Innovaciones Pedagógicas',
  'Maestría en Educación con Mención en Lingüística y Literatura',
  'Maestría en Pedagogía de los Idiomas Nacionales y Extranjeros Mención Inglés',
  'Otra',
]

const REFLECTION_NOTE = (
  <p className="text-xs italic text-gray-500 mb-1">
    💡 Tómate un momento para reflexionar y responder con la mayor honestidad posible. Tus respuestas son confidenciales.
  </p>
)

interface LikertRowProps {
  label: string
  value: number | null
  onChange: (v: number) => void
  options?: { v: number; label: string }[]
  errorMsg?: string
}

function LikertRow({ label, value, onChange, options = LIKERT_GENERAL, errorMsg }: LikertRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-300">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              value === o.v
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {o.v} – {o.label}
          </button>
        ))}
      </div>
      {errorMsg && <p className="text-xs text-red-400 mt-0.5">{errorMsg}</p>}
    </div>
  )
}

type FormState = {
  // Step 1
  genero: string
  // Step 2
  nivelEstudio: 'grado' | 'posgrado' | ''
  carreraSeleccionada: string
  carreraPersonalizada: string
  modalidad_carrera: string
  situacion_vivienda: string
  es_foraneo: boolean | null
  carrera_inicio_deseada: number | null
  carrera_actual_deseada: number | null
  // Step 3
  nivel_tecnologia: number | null
  // Step 4
  gusto_escritura: number | null
  uso_ia_comprension: number | null
  uso_ia_resumen: number | null
  uso_ia_ideas: number | null
  uso_ia_redaccion: number | null
  uso_ia_tareas: number | null
  uso_ia_verificacion: number | null
  uso_ia_critico: number | null
  uso_ia_traduccion: number | null
  uso_ia_idiomas: number | null
}

const initialFormState: FormState = {
  genero: '',
  nivelEstudio: '',
  carreraSeleccionada: '',
  carreraPersonalizada: '',
  modalidad_carrera: '',
  situacion_vivienda: '',
  es_foraneo: null,
  carrera_inicio_deseada: null,
  carrera_actual_deseada: null,
  nivel_tecnologia: null,
  gusto_escritura: null,
  uso_ia_comprension: null,
  uso_ia_resumen: null,
  uso_ia_ideas: null,
  uso_ia_redaccion: null,
  uso_ia_tareas: null,
  uso_ia_verificacion: null,
  uso_ia_critico: null,
  uso_ia_traduccion: null,
  uso_ia_idiomas: null,
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [trabaja, setTrabaja] = useState(false)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [consentimiento, setConsentimiento] = useState(false)

  const [formState, setFormState] = useState<FormState>(initialFormState)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState(prev => ({ ...prev, [key]: value }))
    setStepErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {}
    if (!formState.genero) {
      errors['genero'] = 'Por favor selecciona tu género.'
    }
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep2(): boolean {
    const errors: Record<string, string> = {}
    if (!formState.nivelEstudio) {
      errors['nivelEstudio'] = 'Por favor selecciona el nivel de estudio.'
    }
    if (!formState.carreraSeleccionada) {
      errors['carreraSeleccionada'] = 'Por favor selecciona tu carrera.'
    }
    if (formState.carreraSeleccionada === 'Otra' && !formState.carreraPersonalizada.trim()) {
      errors['carreraPersonalizada'] = 'Por favor escribe el nombre de tu carrera.'
    }
    if (!formState.modalidad_carrera) {
      errors['modalidad_carrera'] = 'Por favor selecciona la modalidad.'
    }
    if (!formState.situacion_vivienda) {
      errors['situacion_vivienda'] = 'Por favor escoge tu situación de vivienda.'
    }
    if (formState.es_foraneo === null) {
      errors['es_foraneo'] = 'Esta pregunta es requerida.'
    }
    if (formState.carrera_inicio_deseada === null) {
      errors['carrera_inicio_deseada'] = 'Esta pregunta es requerida.'
    }
    if (formState.carrera_actual_deseada === null) {
      errors['carrera_actual_deseada'] = 'Esta pregunta es requerida.'
    }
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep3(): boolean {
    const errors: Record<string, string> = {}
    if (formState.nivel_tecnologia === null) {
      errors['nivel_tecnologia'] = 'Por favor selecciona tu nivel de comodidad con tecnología.'
    }
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep4(): boolean {
    const errors: Record<string, string> = {}
    if (formState.gusto_escritura === null) {
      errors['gusto_escritura'] = 'Esta pregunta es requerida.'
    }
    for (const { key } of IA_KEYS) {
      const k = key as keyof FormState
      if (formState[k] === null) {
        errors[key] = 'Esta pregunta es requerida.'
      }
    }
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep5(): boolean {
    const errors: Record<string, string> = {}
    if (!consentimiento) {
      errors['consentimiento'] = 'Debes aceptar el consentimiento para continuar.'
    }
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  function nextStep() {
    let valid = false
    if (step === 1) valid = validateStep1()
    else if (step === 2) valid = validateStep2()
    else if (step === 3) valid = validateStep3()
    else if (step === 4) valid = validateStep4()
    else valid = true

    if (!valid) return
    setStep(s => Math.min(s + 1, TOTAL_STEPS) as Step)
    window.scrollTo(0, 0)
  }

  function prevStep() {
    setStepErrors({})
    setStep(s => Math.max(s - 1, 1) as Step)
    window.scrollTo(0, 0)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validateStep5()) return

    const fd = new FormData(e.currentTarget)

    // Inject controlled state values into FormData
    fd.set('genero', formState.genero)
    fd.set('nivel_estudio', formState.nivelEstudio)
    const carreraFinal =
      formState.carreraSeleccionada === 'Otra'
        ? formState.carreraPersonalizada
        : formState.carreraSeleccionada
    fd.set('carrera', carreraFinal)
    fd.set('modalidad_carrera', formState.modalidad_carrera)
    fd.set('situacion_vivienda', formState.situacion_vivienda)
    fd.set('es_foraneo', formState.es_foraneo !== null ? formState.es_foraneo.toString() : '')
    fd.set('carrera_inicio_deseada', formState.carrera_inicio_deseada?.toString() ?? '')
    fd.set('carrera_actual_deseada', formState.carrera_actual_deseada?.toString() ?? '')
    fd.set('nivel_tecnologia', formState.nivel_tecnologia?.toString() ?? '')
    fd.set('gusto_escritura', formState.gusto_escritura?.toString() ?? '')
    for (const { key } of IA_KEYS) {
      const k = key as keyof FormState
      fd.set(key, (formState[k] as number | null)?.toString() ?? '')
    }

    setServerError(null)
    startTransition(async () => {
      const result = await guardarEncuesta(fd)
      if (result?.error) {
        setServerError(result.error)
      } else {
        router.push('/student')
      }
    })
  }

  const carreraOptions =
    formState.nivelEstudio === 'grado'
      ? CARRERAS_GRADO
      : formState.nivelEstudio === 'posgrado'
      ? CARRERAS_POSGRADO
      : []

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
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${n <= step ? 'bg-brand-500' : 'bg-gray-800'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-500 text-right">Paso {step} de {TOTAL_STEPS}</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* PASO 1: Datos personales */}
          {step === 1 && (
            <div className="card space-y-5">
              {REFLECTION_NOTE}
              <h2 className="font-semibold text-white">Datos personales</h2>

              <div>
                <label className="label">
                  Género <span className="text-red-400">*</span>
                </label>
                <select
                  name="genero"
                  className="input"
                  value={formState.genero}
                  onChange={e => setField('genero', e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                  <option value="prefiero_no_decir">Prefiero no decir</option>
                </select>
                {stepErrors['genero'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['genero']}</p>
                )}
              </div>

              <div>
                <label className="label">Fecha de nacimiento <span className="text-gray-500">(opcional)</span></label>
                <input type="date" name="fecha_nac" className="input" />
              </div>

              <div>
                <label className="label">Teléfono <span className="text-gray-500">(opcional)</span></label>
                <input type="tel" name="telefono" className="input" placeholder="+593 99 000 0000" />
              </div>

              <div>
                <label className="label">Gmail personal <span className="text-gray-500">(opcional)</span></label>
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
              {REFLECTION_NOTE}
              <h2 className="font-semibold text-white">Tu carrera</h2>

              {/* Nivel de estudio */}
              <div>
                <label className="label">
                  Nivel de estudio <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3">
                  {(['grado', 'posgrado'] as const).map(nivel => (
                    <label key={nivel} className="flex-1">
                      <input
                        type="radio"
                        name="nivel_estudio_radio"
                        value={nivel}
                        checked={formState.nivelEstudio === nivel}
                        onChange={() => {
                          setField('nivelEstudio', nivel)
                          setField('carreraSeleccionada', '')
                          setField('carreraPersonalizada', '')
                        }}
                        className="sr-only peer"
                      />
                      <span className="block text-center px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 cursor-pointer peer-checked:bg-brand-600/20 peer-checked:border-brand-500 peer-checked:text-white transition-colors capitalize">
                        {nivel === 'grado' ? 'Grado' : 'Posgrado'}
                      </span>
                    </label>
                  ))}
                </div>
                {stepErrors['nivelEstudio'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['nivelEstudio']}</p>
                )}
              </div>

              {/* Carrera options (conditional) */}
              {formState.nivelEstudio && (
                <div>
                  <label className="label">
                    Carrera que estudias <span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-2">
                    {carreraOptions.map(carrera => (
                      <label key={carrera} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-800 hover:border-gray-600 cursor-pointer">
                        <input
                          type="radio"
                          name="carrera_radio"
                          value={carrera}
                          checked={formState.carreraSeleccionada === carrera}
                          onChange={() => {
                            setField('carreraSeleccionada', carrera)
                            if (carrera !== 'Otra') setField('carreraPersonalizada', '')
                          }}
                          className="rounded-full border-gray-600 bg-gray-800"
                        />
                        <span className="text-sm text-gray-300">{carrera}</span>
                      </label>
                    ))}
                  </div>
                  {stepErrors['carreraSeleccionada'] && (
                    <p className="text-xs text-red-400 mt-1">{stepErrors['carreraSeleccionada']}</p>
                  )}

                  {formState.carreraSeleccionada === 'Otra' && (
                    <div className="mt-3">
                      <label className="label">Escribe el nombre de tu carrera <span className="text-red-400">*</span></label>
                      <input
                        name="carrera_personalizada"
                        className="input"
                        placeholder="Nombre de tu carrera"
                        value={formState.carreraPersonalizada}
                        onChange={e => setField('carreraPersonalizada', e.target.value)}
                      />
                      {stepErrors['carreraPersonalizada'] && (
                        <p className="text-xs text-red-400 mt-1">{stepErrors['carreraPersonalizada']}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Modalidad de carrera */}
              <div>
                <label className="label">
                  Modalidad de estudio <span className="text-red-400">*</span>
                </label>
                <select
                  name="modalidad_carrera"
                  className="input"
                  value={formState.modalidad_carrera}
                  onChange={e => setField('modalidad_carrera', e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Virtual">Virtual / En línea</option>
                  <option value="Híbrida">Híbrida / Semipresencial</option>
                  <option value="Otra">Otra</option>
                </select>
                {stepErrors['modalidad_carrera'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['modalidad_carrera']}</p>
                )}
              </div>

              {/* Situacion de Vivienda */}
              <div>
                <label className="label">
                  Situación de vivienda actual <span className="text-red-400">*</span>
                </label>
                <select
                  name="situacion_vivienda"
                  className="input"
                  value={formState.situacion_vivienda}
                  onChange={e => setField('situacion_vivienda', e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="Casa propia">Casa propia</option>
                  <option value="Con padres">Con mis padres</option>
                  <option value="Familiar">Con otros familiares</option>
                  <option value="Arrienda">Arriendo (Inquilino)</option>
                  <option value="Residencia universitaria">Residencia universitaria</option>
                  <option value="Otra">Otra</option>
                </select>
                {stepErrors['situacion_vivienda'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['situacion_vivienda']}</p>
                )}
              </div>

              {/* Foraneo */}
              <div>
                <label className="label">
                  ¿Eres foráneo? (naciste o tu familia vive en una ciudad distinta a la universidad) <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3 mt-1">
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="es_foraneo_radio"
                      value="true"
                      checked={formState.es_foraneo === true}
                      onChange={() => setField('es_foraneo', true)}
                      className="sr-only peer"
                    />
                    <span className="block text-center px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 cursor-pointer peer-checked:bg-brand-600/20 peer-checked:border-brand-500 peer-checked:text-white transition-colors">
                      Sí, soy foráneo/a
                    </span>
                  </label>
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="es_foraneo_radio"
                      value="false"
                      checked={formState.es_foraneo === false}
                      onChange={() => setField('es_foraneo', false)}
                      className="sr-only peer"
                    />
                    <span className="block text-center px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 cursor-pointer peer-checked:bg-brand-600/20 peer-checked:border-brand-500 peer-checked:text-white transition-colors">
                      No
                    </span>
                  </label>
                </div>
                {stepErrors['es_foraneo'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['es_foraneo']}</p>
                )}
              </div>

              {/* Hidden inputs for submission */}
              <input type="hidden" name="nivel_estudio" value={formState.nivelEstudio} />
              <input
                type="hidden"
                name="carrera"
                value={
                  formState.carreraSeleccionada === 'Otra'
                    ? formState.carreraPersonalizada
                    : formState.carreraSeleccionada
                }
              />

              <div>
                <label className="label">Universidad / Institución <span className="text-gray-500">(opcional)</span></label>
                <input name="institucion" className="input" placeholder="Ej. ULEAM" />
              </div>

              <div className="space-y-4 pt-2 border-t border-gray-800">
                <p className="text-sm text-gray-400">
                  Las siguientes preguntas son <span className="text-red-400">requeridas</span>:
                </p>
                <LikertRow
                  label="Al principio de la carrera, ¿sentías que estudiabas lo que querías?"
                  value={formState.carrera_inicio_deseada}
                  onChange={v => setField('carrera_inicio_deseada', v)}
                  errorMsg={stepErrors['carrera_inicio_deseada']}
                />
                <LikertRow
                  label="¿Actualmente sientes que es la carrera que querías estudiar?"
                  value={formState.carrera_actual_deseada}
                  onChange={v => setField('carrera_actual_deseada', v)}
                  errorMsg={stepErrors['carrera_actual_deseada']}
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
              {REFLECTION_NOTE}
              <h2 className="font-semibold text-white">Tecnología y trabajo</h2>

              <div>
                <label className="label">
                  ¿Qué tan cómodo/a te sientes usando tecnología? <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    [1, 'Básico'], [2, 'Regular'], [3, 'Intermedio'], [4, 'Avanzado'], [5, 'Experto']
                  ].map(([v, lbl]) => (
                    <label key={v} className="flex-1 min-w-[80px]">
                      <input
                        type="radio"
                        name="nivel_tecnologia"
                        value={v}
                        checked={formState.nivel_tecnologia === v}
                        onChange={() => setField('nivel_tecnologia', v as number)}
                        className="sr-only peer"
                      />
                      <span className="block text-center px-2 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 cursor-pointer peer-checked:bg-brand-600/20 peer-checked:border-brand-500 peer-checked:text-white transition-colors">
                        {v} – {lbl}
                      </span>
                    </label>
                  ))}
                </div>
                {stepErrors['nivel_tecnologia'] && (
                  <p className="text-xs text-red-400 mt-1">{stepErrors['nivel_tecnologia']}</p>
                )}
              </div>

              <div className="space-y-3">
                <label className="label">Dispositivos que tienes <span className="text-gray-500">(opcional, marca los que apliquen)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['tiene_laptop', 'Laptop'],
                    ['tiene_pc_escritorio', 'PC de escritorio'],
                    ['comparte_pc', 'Comparto computadora'],
                    ['sin_computadora', 'Ninguna'],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-800 hover:border-gray-600 cursor-pointer">
                      <input type="checkbox" name={name} value="true" className="rounded border-gray-600 bg-gray-800" />
                      <span className="text-sm text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Teléfono móvil <span className="text-gray-500">(opcional)</span></label>
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
                  <div className="space-y-3">
                    <div>
                      <label className="label">Tipo de trabajo <span className="text-gray-500">(opcional)</span></label>
                      <input name="tipo_trabajo" className="input" placeholder="Ej. tiempo parcial, remoto, familiar..." />
                    </div>
                    <div>
                      <label className="label">Horas diarias de trabajo <span className="text-gray-500">(opcional)</span></label>
                      <input type="number" name="horas_trabajo_diarias" className="input" min={1} max={24} placeholder="Ej. 4" />
                    </div>
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
              {REFLECTION_NOTE}
              <h2 className="font-semibold text-white">Lectura e Inteligencia Artificial</h2>

              <div>
                <label className="label">¿Cuántos libros lees al año (aprox.)? <span className="text-gray-500">(opcional)</span></label>
                <input type="number" name="libros_anio" className="input" min={0} max={200} placeholder="0" />
              </div>

              <LikertRow
                label="¿Cuánto te gusta escribir? *"
                value={formState.gusto_escritura}
                onChange={v => setField('gusto_escritura', v)}
                errorMsg={stepErrors['gusto_escritura']}
              />

              <div className="border-t border-gray-800 pt-4 space-y-4">
                <p className="text-sm text-gray-400">
                  ¿Con qué frecuencia usas IA (ChatGPT, Gemini, etc.) para...?{' '}
                  <span className="text-red-400">*</span>
                  <span className="block text-xs mt-1 text-gray-600">1 = Nunca · 5 = Siempre</span>
                </p>
                {IA_KEYS.map(({ key, label }) => (
                  <LikertRow
                    key={key}
                    label={label}
                    value={(formState[key as keyof FormState] as number | null)}
                    onChange={v => setField(key as keyof FormState, v as never)}
                    options={LIKERT_IA}
                    errorMsg={stepErrors[key]}
                  />
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
              {REFLECTION_NOTE}
              <h2 className="font-semibold text-white">Últimas preguntas</h2>

              <div>
                <label className="label">
                  ¿Tienes alguna situación personal o académica que pudiera afectar tu desempeño en el curso?{' '}
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
                    checked={consentimiento}
                    onChange={e => {
                      setConsentimiento(e.target.checked)
                      if (e.target.checked) {
                        setStepErrors(prev => {
                          const next = { ...prev }
                          delete next['consentimiento']
                          return next
                        })
                      }
                    }}
                    className="mt-0.5 rounded border-gray-600 bg-gray-800 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-300">
                    He leído el aviso anterior y consiento que mis datos sean usados con fines de investigación educativa
                  </span>
                </label>
                {stepErrors['consentimiento'] && (
                  <p className="text-xs text-red-400">{stepErrors['consentimiento']}</p>
                )}
              </div>

              {serverError && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {serverError}
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
