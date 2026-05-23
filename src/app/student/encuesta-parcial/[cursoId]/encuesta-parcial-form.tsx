'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEncuestaParcial } from '@/lib/actions/encuesta-parcial'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FormData {
  // Paso 1
  trabaja_actual: string
  tipo_trabajo_actual: string
  horas_trabajo_actual: number | null
  tiene_laptop_actual: boolean
  tiene_pc_escritorio_actual: boolean
  comparte_pc_actual: boolean
  sin_computadora_actual: boolean
  dispositivo_movil_actual: string
  situacion_vivienda_actual: string
  carrera_sigue_deseada: number | null
  horas_dedicacion_estudio: string
  // Paso 2
  uso_ia_comprension_actual: number | null
  uso_ia_resumen_actual: number | null
  uso_ia_ideas_actual: number | null
  uso_ia_redaccion_actual: number | null
  uso_ia_tareas_actual: number | null
  uso_ia_verificacion_actual: number | null
  uso_ia_critico_actual: number | null
  uso_ia_traduccion_actual: number | null
  uso_ia_idiomas_actual: number | null
  gusto_escritura_actual: number | null
  // Paso 3
  autopercepcion_aprendizaje: number | null
  esfuerzo_dedicado: number | null
  comprension_temas_propia: number | null
  preparacion_evaluacion: number | null
  cumplimiento_entregas: number | null
  dificultades: string[]
  detalle_dificultades: string
  // Paso 4
  utilidad_profesional: number | null
  aplicacion_practica: number | null
  actualidad_contenidos: number | null
  motivacion_post_curso: number | null
  // Paso 5
  claridad_explicaciones: number | null
  pertinencia_tareas: number | null
  claridad_instrucciones: number | null
  ritmo_clase: number | null
  calidad_recursos: number | null
  justicia_evaluacion: number | null
  retroalimentacion_recibida: number | null
  puntualidad_docente: number | null
  trato_docente: number | null
  dominio_tema: number | null
  estrategias_didacticas: number | null
  disponibilidad_docente: number | null
  satisfaccion_tutorias: number | null
  facilidad_reserva_tutoria: number | null
  fortalezas_curso: string
  sugerencias_mejora: string
  comentario_libre: string
}

const INITIAL_DATA: FormData = {
  trabaja_actual: 'sin_trabajo',
  tipo_trabajo_actual: '',
  horas_trabajo_actual: null,
  tiene_laptop_actual: false,
  tiene_pc_escritorio_actual: false,
  comparte_pc_actual: false,
  sin_computadora_actual: false,
  dispositivo_movil_actual: '',
  situacion_vivienda_actual: '',
  carrera_sigue_deseada: null,
  horas_dedicacion_estudio: '',
  uso_ia_comprension_actual: null,
  uso_ia_resumen_actual: null,
  uso_ia_ideas_actual: null,
  uso_ia_redaccion_actual: null,
  uso_ia_tareas_actual: null,
  uso_ia_verificacion_actual: null,
  uso_ia_critico_actual: null,
  uso_ia_traduccion_actual: null,
  uso_ia_idiomas_actual: null,
  gusto_escritura_actual: null,
  autopercepcion_aprendizaje: null,
  esfuerzo_dedicado: null,
  comprension_temas_propia: null,
  preparacion_evaluacion: null,
  cumplimiento_entregas: null,
  dificultades: [],
  detalle_dificultades: '',
  utilidad_profesional: null,
  aplicacion_practica: null,
  actualidad_contenidos: null,
  motivacion_post_curso: null,
  claridad_explicaciones: null,
  pertinencia_tareas: null,
  claridad_instrucciones: null,
  ritmo_clase: null,
  calidad_recursos: null,
  justicia_evaluacion: null,
  retroalimentacion_recibida: null,
  puntualidad_docente: null,
  trato_docente: null,
  dominio_tema: null,
  estrategias_didacticas: null,
  disponibilidad_docente: null,
  satisfaccion_tutorias: null,
  facilidad_reserva_tutoria: null,
  fortalezas_curso: '',
  sugerencias_mejora: '',
  comentario_libre: '',
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function LikertRow({
  label,
  value,
  onChange,
  labelMin,
  labelMax,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
  labelMin?: string
  labelMax?: string
}) {
  return (
    <div className="py-3 border-b border-gray-800 last:border-0">
      <p className="text-gray-300 text-sm mb-2">{label}</p>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-brand-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
        {(labelMin || labelMax) && (
          <div className="ml-2 flex gap-3 text-[10px] text-gray-500">
            {labelMin && <span>1 — {labelMin}</span>}
            {labelMax && <span>5 — {labelMax}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function LikertRowNullable({
  label,
  value,
  onChange,
  labelMin,
  labelMax,
  withNA,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  labelMin?: string
  labelMax?: string
  withNA?: boolean
}) {
  return (
    <div className="py-3 border-b border-gray-800 last:border-0">
      <p className="text-gray-300 text-sm mb-2">{label}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-brand-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
        {withNA && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`px-3 h-10 rounded-full text-xs font-medium transition-colors ${
              value === null
                ? 'bg-gray-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            N/A
          </button>
        )}
        {(labelMin || labelMax) && (
          <div className="w-full mt-1 flex gap-3 text-[10px] text-gray-500">
            {labelMin && <span>1 — {labelMin}</span>}
            {labelMax && <span>5 — {labelMax}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  cursoId: string
  asignatura: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encuestaExistente: any | null
}

export function EncuestaParcialForm({ cursoId, asignatura, encuestaExistente }: Props) {
  const router = useRouter()
  const TOTAL_PASOS = 5
  const STORAGE_KEY = `encuesta-parcial-${cursoId}`

  const [paso, setPaso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completado, setCompletado] = useState(false)

  // Inicializar data desde encuesta existente o borrador localStorage
  const [data, setData] = useState<FormData>(() => {
    if (encuestaExistente) {
      const merged: FormData = { ...INITIAL_DATA }
      for (const key of Object.keys(INITIAL_DATA) as Array<keyof FormData>) {
        const val = encuestaExistente[key]
        if (val !== undefined && val !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(merged as any)[key] = val
        }
      }
      return merged
    }
    return INITIAL_DATA
  })

  // Cargar borrador desde localStorage en mount (solo si no hay encuesta existente)
  useEffect(() => {
    if (encuestaExistente) return
    try {
      const draft = localStorage.getItem(STORAGE_KEY)
      if (draft) {
        const parsed = JSON.parse(draft)
        setData(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignorar
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guardar borrador en localStorage en cada cambio
  useEffect(() => {
    if (completado) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // ignorar
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleDificultad = useCallback((val: string) => {
    setData(prev => {
      const current = prev.dificultades
      if (val === 'ninguna') {
        return { ...prev, dificultades: current.includes('ninguna') ? [] : ['ninguna'] }
      }
      const withoutNinguna = current.filter(d => d !== 'ninguna')
      return {
        ...prev,
        dificultades: withoutNinguna.includes(val)
          ? withoutNinguna.filter(d => d !== val)
          : [...withoutNinguna, val],
      }
    })
  }, [])

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      curso_id: cursoId,
      ...data,
    }
    // Limpiar strings vacíos a undefined para que no fallen validaciones opcionales
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = undefined
    }
    const result = await guardarEncuestaParcial(payload)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
      setCompletado(true)
      setTimeout(() => router.push('/student'), 2500)
    }
  }

  // ─── Estado completado ────────────────────────────────────────────────────

  if (completado) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-white text-xl font-semibold">¡Gracias por completar la encuesta!</h2>
        <p className="text-gray-400 mt-2">Tu retroalimentación es muy valiosa.</p>
        <p className="text-gray-500 text-sm mt-4">Redirigiendo al portal...</p>
      </div>
    )
  }

  // ─── Barra de progreso ────────────────────────────────────────────────────

  const ProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>Paso {paso} de {TOTAL_PASOS}</span>
        <span>{Math.round((paso / TOTAL_PASOS) * 100)}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div
          className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(paso / TOTAL_PASOS) * 100}%` }}
        />
      </div>
      <div className="flex gap-2 mt-3 text-[10px] text-gray-600 justify-between">
        {['Tu situación', 'Uso de IA', 'Aprendizaje', 'Asignatura', 'El curso'].map((label, i) => (
          <span key={i} className={paso === i + 1 ? 'text-brand-400 font-semibold' : ''}>{label}</span>
        ))}
      </div>
    </div>
  )

  // ─── Botones de navegación ────────────────────────────────────────────────

  const NavButtons = () => (
    <div className="flex gap-3 mt-6">
      {paso > 1 && (
        <button
          type="button"
          onClick={() => setPaso(p => p - 1)}
          className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Anterior
        </button>
      )}
      {paso < TOTAL_PASOS ? (
        <button
          type="button"
          onClick={() => setPaso(p => p + 1)}
          className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Siguiente
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Enviar encuesta'}
        </button>
      )}
    </div>
  )

  // ─── Paso 1: Tu situación actual ──────────────────────────────────────────

  const Paso1 = () => (
    <div className="space-y-5">
      {/* Situación laboral */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Situación laboral</h3>
        <div className="space-y-2">
          {[
            { value: 'sin_trabajo', label: 'No trabajo actualmente' },
            { value: 'parcial', label: 'Trabajo a tiempo parcial' },
            { value: 'completo', label: 'Trabajo a tiempo completo' },
            { value: 'practicas', label: 'Prácticas / pasantías' },
            { value: 'otro', label: 'Otra situación' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors">
              <input
                type="radio"
                name="trabaja_actual"
                value={opt.value}
                checked={data.trabaja_actual === opt.value}
                onChange={() => set('trabaja_actual', opt.value)}
                className="accent-brand-600"
              />
              <span className="text-gray-300 text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        {data.trabaja_actual !== 'sin_trabajo' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">¿En qué trabajas?</label>
              <input
                type="text"
                value={data.tipo_trabajo_actual}
                onChange={e => set('tipo_trabajo_actual', e.target.value)}
                placeholder="Ej: atención al cliente, asistente administrativo..."
                className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-full placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Horas de trabajo por día</label>
              <input
                type="number"
                min={1}
                max={12}
                value={data.horas_trabajo_actual ?? ''}
                onChange={e => set('horas_trabajo_actual', e.target.value ? Number(e.target.value) : null)}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-28"
              />
            </div>
          </div>
        )}
      </div>

      {/* Acceso tecnológico */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Acceso tecnológico</h3>
        <div className="space-y-2">
          {[
            { key: 'tiene_laptop_actual' as const, label: 'Tengo laptop' },
            { key: 'tiene_pc_escritorio_actual' as const, label: 'Tengo PC de escritorio' },
            { key: 'comparte_pc_actual' as const, label: 'Comparto computadora con otros' },
            { key: 'sin_computadora_actual' as const, label: 'No tengo computadora' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={data[item.key]}
                onChange={e => set(item.key, e.target.checked)}
                className="accent-brand-600 w-4 h-4"
              />
              <span className="text-gray-300 text-sm">{item.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-gray-400 text-xs mb-2">Dispositivo móvil</label>
          <div className="flex gap-2 flex-wrap">
            {['Android', 'iOS', 'Ambos', 'Ninguno'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('dispositivo_movil_actual', opt)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  data.dispositivo_movil_actual === opt
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vivienda y carrera */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Vivienda y carrera</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Situación de vivienda actual</label>
            <select
              value={data.situacion_vivienda_actual}
              onChange={e => set('situacion_vivienda_actual', e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded-lg p-2.5 text-sm w-full"
            >
              <option value="">Seleccionar...</option>
              <option value="familiar">Con familia</option>
              <option value="arrendado_solo">Arrendado solo</option>
              <option value="arrendado_compartido">Arrendado compartido</option>
              <option value="residencia">Residencia universitaria</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <LikertRow
            label="¿Sigues queriendo estudiar esta carrera?"
            value={data.carrera_sigue_deseada}
            onChange={v => set('carrera_sigue_deseada', v)}
            labelMin="Para nada"
            labelMax="Completamente"
          />
        </div>
      </div>

      {/* Horas de estudio */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Dedicación al estudio</h3>
        <p className="text-gray-400 text-xs mb-3">¿Cuántas horas dedicas al estudio fuera de clases (por día)?</p>
        <div className="space-y-2">
          {[
            { value: 'menos_2h', label: 'Menos de 2 horas' },
            { value: '2a4h', label: 'Entre 2 y 4 horas' },
            { value: '4a6h', label: 'Entre 4 y 6 horas' },
            { value: 'mas_6h', label: 'Más de 6 horas' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors">
              <input
                type="radio"
                name="horas_dedicacion_estudio"
                value={opt.value}
                checked={data.horas_dedicacion_estudio === opt.value}
                onChange={() => set('horas_dedicacion_estudio', opt.value)}
                className="accent-brand-600"
              />
              <span className="text-gray-300 text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  // ─── Paso 2: Uso de IA ────────────────────────────────────────────────────

  const Paso2 = () => {
    const iaItems: { key: keyof FormData; label: string }[] = [
      { key: 'uso_ia_comprension_actual', label: 'Comprensión de textos' },
      { key: 'uso_ia_resumen_actual', label: 'Resumen de contenidos' },
      { key: 'uso_ia_ideas_actual', label: 'Generación de ideas' },
      { key: 'uso_ia_redaccion_actual', label: 'Redacción de textos' },
      { key: 'uso_ia_tareas_actual', label: 'Realización de tareas' },
      { key: 'uso_ia_verificacion_actual', label: 'Verificación de información' },
      { key: 'uso_ia_critico_actual', label: 'Pensamiento crítico' },
      { key: 'uso_ia_traduccion_actual', label: 'Traducción' },
      { key: 'uso_ia_idiomas_actual', label: 'Práctica de idiomas' },
    ]
    return (
      <div className="space-y-5">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Uso de inteligencia artificial</h3>
          <p className="text-gray-500 text-xs mb-4">¿Con qué frecuencia usas IA para estas tareas? (1 = Nunca, 5 = Siempre)</p>
          {iaItems.map(item => (
            <LikertRow
              key={item.key}
              label={item.label}
              value={data[item.key] as number | null}
              onChange={v => set(item.key, v)}
            />
          ))}
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <LikertRow
            label="¿Cuánto disfrutas escribir actualmente?"
            value={data.gusto_escritura_actual}
            onChange={v => set('gusto_escritura_actual', v)}
            labelMin="Nada"
            labelMax="Mucho"
          />
        </div>
      </div>
    )
  }

  // ─── Paso 3: Tu aprendizaje ───────────────────────────────────────────────

  const Paso3 = () => {
    const autoItems: { key: keyof FormData; label: string }[] = [
      { key: 'autopercepcion_aprendizaje', label: 'Mi propio aprendizaje en este curso' },
      { key: 'esfuerzo_dedicado', label: 'Esfuerzo que estoy dedicando' },
      { key: 'comprension_temas_propia', label: 'Comprensión de los temas vistos' },
      { key: 'preparacion_evaluacion', label: 'Preparación para el próximo parcial' },
      { key: 'cumplimiento_entregas', label: 'Cumplimiento de entregas y tareas' },
    ]
    const dificultadesOpts = [
      { value: 'comprension_temas', label: 'Dificultad para entender los temas' },
      { value: 'falta_tiempo', label: 'Falta de tiempo' },
      { value: 'carga_trabajo_externo', label: 'Mi trabajo/prácticas afectan el estudio' },
      { value: 'problemas_tecnologicos', label: 'Conectividad o equipo' },
      { value: 'dificultades_personales', label: 'Situación personal o familiar' },
      { value: 'carga_otras_materias', label: 'Muchas materias simultáneas' },
      { value: 'metodologia', label: 'No me adapto a la metodología del curso' },
      { value: 'bajo_rendimiento', label: 'Bajo rendimiento en evaluaciones previas' },
      { value: 'ninguna', label: 'No tengo dificultades significativas' },
    ]
    const hayDificultades = data.dificultades.some(d => d !== 'ninguna') && data.dificultades.length > 0

    return (
      <div className="space-y-5">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Autopercepción de aprendizaje</h3>
          <p className="text-gray-500 text-xs mb-4">¿Cómo valoras... (1 = Muy bajo, 5 = Muy alto)</p>
          {autoItems.map(item => (
            <LikertRow
              key={item.key}
              label={item.label}
              value={data[item.key] as number | null}
              onChange={v => set(item.key, v)}
            />
          ))}
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Dificultades actuales</h3>
          <div className="space-y-2">
            {dificultadesOpts.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/60 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={data.dificultades.includes(opt.value)}
                  onChange={() => toggleDificultad(opt.value)}
                  className="accent-brand-600 w-4 h-4"
                />
                <span className="text-gray-300 text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
          {hayDificultades && (
            <div className="mt-4">
              <label className="block text-gray-400 text-xs mb-1.5">
                ¿Quieres describir? <span className="text-gray-600">(opcional — visible solo para el docente)</span>
              </label>
              <textarea
                value={data.detalle_dificultades}
                onChange={e => set('detalle_dificultades', e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Describe brevemente tu situación..."
                className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-full placeholder-gray-600 resize-none"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Paso 4: Esta asignatura ──────────────────────────────────────────────

  const Paso4 = () => {
    const items: { key: keyof FormData; label: string; labelMin?: string; labelMax?: string }[] = [
      { key: 'utilidad_profesional', label: 'Esta asignatura aporta a mi formación profesional', labelMin: 'Nada', labelMax: 'Mucho' },
      { key: 'aplicacion_practica', label: 'Veo aplicación práctica en mi carrera', labelMin: 'Nada', labelMax: 'Mucho' },
      { key: 'actualidad_contenidos', label: 'Los contenidos son actualizados y relevantes', labelMin: 'Desactualizado', labelMax: 'Muy actual' },
      { key: 'motivacion_post_curso', label: 'Esta asignatura aumenta mi motivación hacia la carrera', labelMin: 'La reduce', labelMax: 'La aumenta' },
    ]
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-1">Relevancia de la asignatura</h3>
        <p className="text-gray-500 text-xs mb-4">{asignatura}</p>
        {items.map(item => (
          <LikertRow
            key={item.key}
            label={item.label}
            value={data[item.key] as number | null}
            onChange={v => set(item.key, v)}
            labelMin={item.labelMin}
            labelMax={item.labelMax}
          />
        ))}
      </div>
    )
  }

  // ─── Paso 5: Sobre el curso ───────────────────────────────────────────────

  const Paso5 = () => {
    type NullableKey = keyof FormData
    const contenidoItems: { key: NullableKey; label: string; labelMin?: string; labelMax?: string }[] = [
      { key: 'claridad_explicaciones', label: 'Claridad de las explicaciones', labelMin: 'Muy poco clara', labelMax: 'Muy clara' },
      { key: 'pertinencia_tareas', label: 'Pertinencia de las tareas asignadas', labelMin: 'Nada pertinente', labelMax: 'Muy pertinente' },
      { key: 'claridad_instrucciones', label: 'Claridad de las instrucciones de actividades', labelMin: 'Confusa', labelMax: 'Muy clara' },
      { key: 'ritmo_clase', label: 'Ritmo de la clase', labelMin: 'Muy lento', labelMax: 'Muy rápido' },
      { key: 'calidad_recursos', label: 'Calidad de los recursos de aprendizaje', labelMin: 'Muy baja', labelMax: 'Muy alta' },
    ]
    const evaluacionItems: { key: NullableKey; label: string; labelMin?: string; labelMax?: string }[] = [
      { key: 'justicia_evaluacion', label: 'Justicia en la evaluación', labelMin: 'Muy injusta', labelMax: 'Muy justa' },
      { key: 'retroalimentacion_recibida', label: 'Retroalimentación recibida sobre mi trabajo', labelMin: 'Ninguna', labelMax: 'Muy buena' },
    ]
    const docenteItems: { key: NullableKey; label: string; labelMin?: string; labelMax?: string }[] = [
      { key: 'puntualidad_docente', label: 'Puntualidad del docente', labelMin: 'Nunca puntual', labelMax: 'Siempre puntual' },
      { key: 'trato_docente', label: 'Trato y respeto del docente', labelMin: 'Inapropiado', labelMax: 'Excelente' },
      { key: 'dominio_tema', label: 'Dominio del tema por parte del docente', labelMin: 'Muy bajo', labelMax: 'Muy alto' },
      { key: 'estrategias_didacticas', label: 'Estrategias didácticas utilizadas', labelMin: 'Ineficaces', labelMax: 'Muy efectivas' },
      { key: 'disponibilidad_docente', label: 'Disponibilidad para resolver dudas', labelMin: 'Nula', labelMax: 'Excelente' },
    ]

    return (
      <div className="space-y-5">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Contenido y actividades</h3>
          {contenidoItems.map(item => (
            <LikertRow
              key={item.key}
              label={item.label}
              value={data[item.key] as number | null}
              onChange={v => set(item.key, v)}
              labelMin={item.labelMin}
              labelMax={item.labelMax}
            />
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Evaluación</h3>
          {evaluacionItems.map(item => (
            <LikertRow
              key={item.key}
              label={item.label}
              value={data[item.key] as number | null}
              onChange={v => set(item.key, v)}
              labelMin={item.labelMin}
              labelMax={item.labelMax}
            />
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Desempeño docente</h3>
          {docenteItems.map(item => (
            <LikertRow
              key={item.key}
              label={item.label}
              value={data[item.key] as number | null}
              onChange={v => set(item.key, v)}
              labelMin={item.labelMin}
              labelMax={item.labelMax}
            />
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Tutorías</h3>
          <LikertRowNullable
            label="Satisfacción con las tutorías del docente"
            value={data.satisfaccion_tutorias}
            onChange={v => set('satisfaccion_tutorias', v)}
            labelMin="Muy insatisfecho"
            labelMax="Muy satisfecho"
            withNA
          />
          <LikertRowNullable
            label="Facilidad para reservar una tutoría"
            value={data.facilidad_reserva_tutoria}
            onChange={v => set('facilidad_reserva_tutoria', v)}
            labelMin="Muy difícil"
            labelMax="Muy fácil"
            withNA
          />
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Comentarios libres</h3>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">¿Qué aspectos valoras más de este curso? <span className="text-gray-600">(opcional)</span></label>
            <textarea
              value={data.fortalezas_curso}
              onChange={e => set('fortalezas_curso', e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Fortalezas, lo que funciona bien..."
              className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-full placeholder-gray-600 resize-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">¿Qué mejorarías? <span className="text-gray-600">(opcional)</span></label>
            <textarea
              value={data.sugerencias_mejora}
              onChange={e => set('sugerencias_mejora', e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Sugerencias de mejora..."
              className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-full placeholder-gray-600 resize-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Comentario adicional <span className="text-gray-600">(opcional)</span></label>
            <textarea
              value={data.comentario_libre}
              onChange={e => set('comentario_libre', e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Cualquier otro aspecto que quieras compartir..."
              className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 text-sm w-full placeholder-gray-600 resize-none"
            />
          </div>
        </div>
      </div>
    )
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  return (
    <div>
      <ProgressBar />

      {paso === 1 && <Paso1 />}
      {paso === 2 && <Paso2 />}
      {paso === 3 && <Paso3 />}
      {paso === 4 && <Paso4 />}
      {paso === 5 && <Paso5 />}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      <NavButtons />
    </div>
  )
}
