'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generarHtmlSemanal, generarGuiaSemanal, generarEvaluacionMoodle, mejorarContenido } from '@/lib/actions/generar-contenido'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Curso {
  id: string
  asignatura: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

interface Clase {
  curso_id: string
  cursos: Curso | null
}

interface BitacoraItem {
  id: string
  fecha: string
  tema: string
  estado: string
  actividades_count: number
}

interface LogroItem {
  id: string
  descripcion: string
}

type Tab = 'html' | 'guia' | 'evaluacion'
type TipoPregunta = 'multichoice' | 'truefalse' | 'matching' | 'shortanswer'
type Step = 1 | 2 | 3

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  clases: Clase[]
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function descargaTxt(contenido: string, nombreBase: string) {
  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreBase}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

async function descargaDocx(guia: string, titulo: string) {
  const res = await fetch('/api/generar-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guia, titulo }),
  })
  if (!res.ok) throw new Error('Error generando Word')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    titulo
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}

async function descargaPdf(guia: string, titulo: string) {
  const res = await fetch('/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guia, titulo }),
  })
  if (!res.ok) throw new Error('Error generando PDF')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    titulo
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') + '.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

function descargaXml(contenido: string, nombreBase: string) {
  const blob = new Blob([contenido], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreBase}.xml`
  a.click()
  URL.revokeObjectURL(url)
}

function calcularSemana(fechaInicio: string | null, fechasBitacoras: string[]): number {
  if (!fechaInicio || fechasBitacoras.length === 0) return 1
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const primera = new Date(Math.min(...fechasBitacoras.map(f => new Date(f + 'T00:00:00').getTime())))
  const diffDias = Math.floor((primera.getTime() - inicio.getTime()) / (24 * 3600 * 1000))
  return Math.max(1, Math.floor(diffDias / 7) + 1)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneradorPanel({ clases, onClose }: Props) {
  const cursosUnicos = Array.from(
    new Map(
      clases
        .filter(c => c.cursos)
        .map(c => [c.cursos!.id, c.cursos!])
    ).values()
  )

  // ── State ──
  const [activeTab, setActiveTab] = useState<Tab>('html')
  const [step, setStep] = useState<Step>(1)

  // Paso 1
  const [selectedCursoId, setSelectedCursoId] = useState(cursosUnicos[0]?.id ?? '')
  const [bitacoras, setBitacoras] = useState<BitacoraItem[]>([])
  const [loadingBit, setLoadingBit] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Paso 2
  const [semanaOverride, setSemanaOverride] = useState<number | null>(null)
  const [instruccionAdicional, setInstruccionAdicional] = useState('')
  const [nivel, setNivel] = useState<'basico' | 'avanzado'>('basico')
  const [logros, setLogros] = useState<LogroItem[]>([])
  const [selectedLogroId, setSelectedLogroId] = useState<string>('')

  // Paso 2 — evaluación
  const [tiposPregunta, setTiposPregunta] = useState<Set<TipoPregunta>>(new Set(['multichoice']))
  const [totalPreguntas, setTotalPreguntas] = useState(10)
  const [categoriaMoodle, setCategoriaMoodle] = useState('')

  // Paso 3
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [docxLoading, setDocxLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const selectedCurso = cursosUnicos.find(c => c.id === selectedCursoId)

  // Semana auto-calculada desde fecha_inicio del curso + fechas de bitácoras seleccionadas
  const semanaAutoDetectada = useMemo(() => {
    const fechasSeleccionadas = bitacoras
      .filter(b => selectedIds.has(b.id))
      .map(b => b.fecha)
    return calcularSemana(selectedCurso?.fecha_inicio ?? null, fechasSeleccionadas)
  }, [selectedIds, bitacoras, selectedCurso])

  const semanaFinal = semanaOverride ?? semanaAutoDetectada

  // Cargar logros al cambiar curso
  useEffect(() => {
    if (!selectedCursoId) return
    setLogros([])
    setSelectedLogroId('')
    const supabase = createClient()
    supabase
      .from('logros_aprendizaje')
      .select('id, descripcion')
      .eq('curso_id', selectedCursoId)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => setLogros(data ?? []))
  }, [selectedCursoId])

  // Cargar bitácoras al cambiar curso
  useEffect(() => {
    if (!selectedCursoId) return
    setLoadingBit(true)
    setSelectedIds(new Set())
    const supabase = createClient()
    supabase
      .from('bitacora_clase')
      .select('id, fecha, tema, estado, actividades_json')
      .eq('curso_id', selectedCursoId)
      .in('estado', ['planificado', 'cumplido'])
      .order('fecha', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setBitacoras(
          (data ?? []).map(b => ({
            id: b.id,
            fecha: b.fecha,
            tema: b.tema ?? '(sin tema)',
            estado: b.estado,
            actividades_count: Array.isArray(b.actividades_json) ? (b.actividades_json as unknown[]).length : 0,
          }))
        )
        setLoadingBit(false)
      })
  }, [selectedCursoId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Resetear semana override cuando cambian las bitácoras seleccionadas
  useEffect(() => {
    setSemanaOverride(null)
  }, [selectedIds])

  function resetearChat() {
    setChatMessages([])
    setChatInput('')
  }

  function toggleBitacora(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodas() {
    if (selectedIds.size === bitacoras.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bitacoras.map(b => b.id)))
    }
  }

  async function handleGenerar() {
    if (selectedIds.size === 0) return
    setGenerating(true)
    setGenError(null)
    resetearChat()

    const ids = Array.from(selectedIds)
    const asignatura = selectedCurso?.asignatura ?? ''
    const instruccion = instruccionAdicional.trim() || undefined

    if (activeTab === 'html') {
      const result = await generarHtmlSemanal({
        bitacoraIds: ids,
        asignatura,
        semanaNum: semanaFinal,
        instruccionAdicional: instruccion,
        cursoId: selectedCursoId ?? undefined,
      })
      if (result.error) {
        setGenError(result.error)
      } else {
        setGeneratedContent(result.html)
        setStep(3)
      }
    } else if (activeTab === 'evaluacion') {
      if (tiposPregunta.size === 0) {
        setGenError('Selecciona al menos un tipo de pregunta.')
        setGenerating(false)
        return
      }
      const result = await generarEvaluacionMoodle({
        bitacoraIds: ids,
        asignatura,
        semanaNum: semanaFinal,
        tipos: Array.from(tiposPregunta),
        totalPreguntas,
        categoria: categoriaMoodle.trim() || undefined,
        instruccionAdicional: instruccion,
        cursoId: selectedCursoId ?? undefined,
      })
      if (result.error) {
        setGenError(result.error)
      } else {
        setGeneratedContent(result.xml)
        setStep(3)
      }
    } else {
      const logroSeleccionado = logros.find(l => l.id === selectedLogroId)
      const result = await generarGuiaSemanal({
        bitacoraIds: ids,
        asignatura,
        semanaNum: semanaFinal,
        nivel,
        instruccionAdicional: instruccion,
        logroDescripcion: logroSeleccionado?.descripcion,
        cursoId: selectedCursoId ?? undefined,
      })
      if (result.error) {
        setGenError(result.error)
      } else {
        setGeneratedContent(result.guia)
        setStep(3)
      }
    }
    setGenerating(false)
  }

  async function handleMejorar() {
    const solicitud = chatInput.trim()
    if (!solicitud || chatLoading || !generatedContent) return

    setChatMessages(prev => [...prev, { role: 'user', content: solicitud }])
    setChatInput('')
    setChatLoading(true)

    const result = await mejorarContenido({
      tipo: activeTab,
      contenidoActual: generatedContent,
      solicitud,
    })

    if (result.error) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${result.error}` },
      ])
    } else {
      setGeneratedContent(result.content)
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: '✓ Contenido actualizado.' },
      ])
    }
    setChatLoading(false)
  }

  async function handleCopiar() {
    await navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDocx() {
    if (docxLoading) return
    setDocxLoading(true)
    try {
      const titulo = `Guía Semana ${semanaFinal} - ${selectedCurso?.asignatura ?? 'Curso'}`
      await descargaDocx(generatedContent, titulo)
    } catch {
      alert('Error generando el archivo Word.')
    } finally {
      setDocxLoading(false)
    }
  }

  async function handlePdf() {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      const titulo = `Guía Semana ${semanaFinal} - ${selectedCurso?.asignatura ?? 'Curso'}`
      await descargaPdf(generatedContent, titulo)
    } catch {
      alert('Error generando el PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Render ──

  const seleccionadas = selectedIds.size

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-[860px] z-50 bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">Generador de contenido semanal</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {step === 1 ? 'Selecciona las clases a incluir' : step === 2 ? 'Revisa y configura' : 'Resultado listo para usar'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0 flex-shrink-0">
          {(['html', 'guia', 'evaluacion'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (step === 3) {
                  setStep(2)
                  setGeneratedContent('')
                  resetearChat()
                }
              }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-white border-brand-500 bg-gray-900'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab === 'html' ? '📄 HTML Semanal' : tab === 'guia' ? '📚 Guía de Estudio' : '❓ Evaluación Moodle'}
            </button>
          ))}
        </div>

        <div className="h-px bg-gray-800 flex-shrink-0" />

        {/* Pasos */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-gray-900/50">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-brand-600 text-white' : step > s ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs ${step === s ? 'text-gray-200' : 'text-gray-600'}`}>
                {s === 1 ? 'Clases' : s === 2 ? 'Configurar' : 'Resultado'}
              </span>
              {s < 3 && <span className="text-gray-700 ml-1">›</span>}
            </div>
          ))}
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* ── PASO 1 ── */}
          {step === 1 && (
            <div className="p-5 space-y-5">
              {/* Selector curso */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Asignatura</label>
                {cursosUnicos.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay cursos disponibles.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cursosUnicos.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCursoId(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          selectedCursoId === c.id
                            ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                        }`}
                      >
                        {c.asignatura}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista bitácoras */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">
                    Clases a incluir
                    {seleccionadas > 0 && (
                      <span className="ml-2 text-brand-400">
                        {seleccionadas} seleccionada{seleccionadas !== 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                  {bitacoras.length > 0 && (
                    <button onClick={toggleTodas} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                      {selectedIds.size === bitacoras.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                  )}
                </div>

                {loadingBit ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />)}
                  </div>
                ) : bitacoras.length === 0 ? (
                  <div className="rounded-lg border border-gray-800 p-6 text-center">
                    <p className="text-gray-500 text-sm">No hay clases planificadas o cumplidas en este curso.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {bitacoras.map(b => {
                      const checked = selectedIds.has(b.id)
                      return (
                        <label
                          key={b.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-brand-900/20 border-brand-600/50'
                              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBitacora(b.id)}
                            className="mt-0.5 accent-brand-500 w-4 h-4 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-300 text-sm font-medium truncate">{b.tema}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                b.estado === 'cumplido'
                                  ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-400'
                                  : 'bg-sky-900/30 border-sky-600/40 text-sky-400'
                              }`}>
                                {b.estado === 'cumplido' ? '✓ Cumplida' : 'Planificada'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-gray-500 text-xs">{b.fecha}</span>
                              {b.actividades_count > 0 && (
                                <span className="text-gray-600 text-xs">
                                  {b.actividades_count} actividad{b.actividades_count !== 1 ? 'es' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 2 ── */}
          {step === 2 && (
            <div className="p-5 space-y-5">
              {/* Resumen selección */}
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-center gap-2">
                <span className="text-emerald-400 text-sm">✓</span>
                <span className="text-gray-400 text-sm">
                  {seleccionadas} clase{seleccionadas !== 1 ? 's' : ''} de{' '}
                  <strong className="text-gray-200">{selectedCurso?.asignatura}</strong>
                  {' '}— recursos y videos incluidos automáticamente desde los planes
                </span>
              </div>

              {/* Número de semana (auto-calculado) */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Número de semana</label>
                <p className="text-gray-600 text-xs mb-2">
                  Calculado automáticamente desde {selectedCurso?.fecha_inicio ?? 'fecha de inicio del curso'}.
                  Ajusta si es necesario.
                </p>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={semanaFinal}
                  onChange={e => setSemanaOverride(Number(e.target.value))}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                />
                {semanaOverride === null && (
                  <span className="ml-3 text-xs text-brand-400">auto-detectado</span>
                )}
              </div>

              {/* Nivel — solo para Guía */}
              {activeTab === 'guia' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Nivel del curso</label>
                  <div className="flex gap-4">
                    {(['basico', 'avanzado'] as const).map(n => (
                      <label key={n} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={n}
                          checked={nivel === n}
                          onChange={() => setNivel(n)}
                          className="accent-brand-500"
                        />
                        <span className="text-sm text-gray-300">
                          {n === 'basico' ? 'Básico / introductorio' : 'Avanzado (último año)'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Logro de aprendizaje — solo para Guía */}
              {activeTab === 'guia' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Logro / Objetivo de aprendizaje
                    <span className="text-gray-600 ml-1">(opcional)</span>
                  </label>
                  {logros.length === 0 ? (
                    <p className="text-xs text-gray-600 italic">
                      Sin logros definidos para esta asignatura. La IA generará uno automáticamente.{' '}
                      <a
                        href={`/dashboard/cursos/${selectedCursoId}/editar?tab=logros`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-400 hover:underline"
                      >
                        Definir logros →
                      </a>
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="logro"
                          value=""
                          checked={selectedLogroId === ''}
                          onChange={() => setSelectedLogroId('')}
                          className="mt-0.5 accent-brand-500 flex-shrink-0"
                        />
                        <span className="text-xs text-gray-500 italic group-hover:text-gray-300 transition-colors">
                          Generar automáticamente según las actividades
                        </span>
                      </label>
                      {logros.map((l, i) => (
                        <label key={l.id} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="logro"
                            value={l.id}
                            checked={selectedLogroId === l.id}
                            onChange={() => setSelectedLogroId(l.id)}
                            className="mt-0.5 accent-brand-500 flex-shrink-0"
                          />
                          <span className={`text-xs leading-relaxed transition-colors ${
                            selectedLogroId === l.id ? 'text-brand-300' : 'text-gray-400 group-hover:text-gray-200'
                          }`}>
                            <span className="font-semibold text-gray-500 mr-1">{i + 1}.</span>
                            {l.descripcion}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Config evaluación */}
              {activeTab === 'evaluacion' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Tipos de pregunta</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'multichoice', label: 'Opción múltiple' },
                        { value: 'truefalse', label: 'Verdadero/Falso' },
                        { value: 'matching', label: 'Emparejamiento' },
                        { value: 'shortanswer', label: 'Respuesta corta' },
                      ] as const).map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={tiposPregunta.has(value)}
                            onChange={() => {
                              setTiposPregunta(prev => {
                                const next = new Set(prev)
                                next.has(value) ? next.delete(value) : next.add(value)
                                return next
                              })
                            }}
                            className="accent-brand-500 w-4 h-4"
                          />
                          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Total de preguntas
                    </label>
                    <p className="text-gray-600 text-xs mb-2">
                      La IA reparte entre los tipos seleccionados. Máximo recomendado: 15.
                    </p>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={totalPreguntas}
                      onChange={e => setTotalPreguntas(Math.max(1, Math.min(50, Number(e.target.value))))}
                      className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Categoría Moodle <span className="text-gray-600">(opcional)</span>
                    </label>
                    <p className="text-gray-600 text-xs mb-2">
                      Ruta donde se organizan las preguntas en el banco. Default: $course$/Semana {semanaFinal} - {selectedCurso?.asignatura ?? 'Asignatura'}.
                    </p>
                    <input
                      type="text"
                      value={categoriaMoodle}
                      onChange={e => setCategoriaMoodle(e.target.value)}
                      placeholder={`$course$/Semana ${semanaFinal} - ${selectedCurso?.asignatura ?? 'Asignatura'}`}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </>
              )}

              {/* Instrucción adicional */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Instrucción adicional <span className="text-gray-600">(opcional)</span>
                </label>
                <p className="text-gray-600 text-xs mb-2">
                  Directriz, énfasis, link externo o cualquier contexto extra que la IA debe considerar.
                </p>
                <textarea
                  value={instruccionAdicional}
                  onChange={e => setInstruccionAdicional(e.target.value)}
                  rows={3}
                  placeholder={activeTab === 'evaluacion'
                    ? 'ej: "Enfócate en los conceptos clave de la unidad, nivel básico"'
                    : 'ej: "Céntrate únicamente en las actividades de comparación"\n     "Incluye este artículo: https://..."'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Error */}
              {genError && (
                <div className="rounded-lg bg-red-900/20 border border-red-500/40 px-4 py-3 text-red-400 text-sm">
                  {genError}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3 ── */}
          {step === 3 && (
            <div className="p-5 space-y-4">
              {/* Textarea + botones descarga */}
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-xs font-medium text-gray-400">
                    {activeTab === 'html' ? 'Código HTML' : activeTab === 'evaluacion' ? 'Banco de preguntas (Moodle XML)' : 'Guía de estudio'}
                    <span className="ml-2 text-gray-600">— editable directamente</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCopiar}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors text-xs"
                    >
                      {copied ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                    <button
                      onClick={() =>
                        descargaTxt(
                          generatedContent,
                          activeTab === 'html'
                            ? `html-semana${semanaFinal}-${selectedCurso?.asignatura ?? 'curso'}`
                            : activeTab === 'evaluacion'
                            ? `banco-semana${semanaFinal}-${selectedCurso?.asignatura ?? 'curso'}`
                            : `guia-semana${semanaFinal}-${selectedCurso?.asignatura ?? 'curso'}`
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors text-xs"
                    >
                      ⬇ .txt
                    </button>
                    {activeTab === 'evaluacion' && (
                      <button
                        onClick={() =>
                          descargaXml(
                            generatedContent,
                            `banco-semana${semanaFinal}-${selectedCurso?.asignatura ?? 'curso'}`
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 border border-emerald-600 text-white hover:bg-emerald-600 transition-colors text-xs"
                      >
                        ⬇ Moodle XML (.xml)
                      </button>
                    )}
                    {activeTab === 'guia' && (
                      <>
                        <button
                          onClick={handleDocx}
                          disabled={docxLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors text-xs disabled:opacity-50"
                        >
                          {docxLoading ? '⏳ Generando…' : '⬇ Word (.docx)'}
                        </button>
                        <button
                          onClick={handlePdf}
                          disabled={pdfLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 border border-red-600 text-white hover:bg-red-600 transition-colors text-xs disabled:opacity-50"
                        >
                          {pdfLoading ? '⏳ Generando…' : '⬇ PDF'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={generatedContent}
                  onChange={e => setGeneratedContent(e.target.value)}
                  rows={18}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 text-xs font-mono focus:outline-none focus:border-gray-600 resize-y leading-relaxed"
                />
              </div>

              {/* Mini chat */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-800">
                  <span className="text-xs font-medium text-gray-400">💬 Pedir mejoras al contenido</span>
                </div>

                {chatMessages.length > 0 && (
                  <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2.5">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-brand-700/30 border border-brand-600/30 text-gray-200'
                            : 'bg-gray-800 border border-gray-700 text-gray-300'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-500">
                          Aplicando cambios…
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                <div className="flex gap-2 p-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMejorar() } }}
                    placeholder={
                      activeTab === 'html'
                        ? 'ej: "cambia los colores de encabezado a verde"'
                        : activeTab === 'evaluacion'
                        ? 'ej: "agrega 2 preguntas de emparejamiento sobre el vocabulario"'
                        : 'ej: "agrega más ejemplos prácticos en Desarrollo del Tema"'
                    }
                    disabled={chatLoading}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-600 disabled:opacity-50"
                  />
                  <button
                    onClick={handleMejorar}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navegación */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-950">
          <button
            onClick={() => {
              if (step === 1) onClose()
              else if (step === 2) setStep(1)
              else {
                setStep(2)
                setGeneratedContent('')
                resetearChat()
              }
            }}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors text-sm"
          >
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={seleccionadas === 0}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continuar →
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleGenerar}
              disabled={generating || seleccionadas === 0}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generando…
                </>
              ) : (
                `✦ Generar ${activeTab === 'html' ? 'HTML' : activeTab === 'evaluacion' ? 'evaluación' : 'guía'}`
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => { setStep(2); setGeneratedContent(''); resetearChat() }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              ↻ Regenerar
            </button>
          )}
        </div>
      </div>
    </>
  )
}
