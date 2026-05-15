'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generarHtmlSemanal, generarGuiaSemanal, mejorarContenido } from '@/lib/actions/generar-contenido'

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

type Tab = 'html' | 'guia'
type Step = 1 | 2 | 3

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Props ────────────────────────────────────────────────────────────────────

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
  a.download = titulo.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneradorPanel({ clases, onClose }: Props) {
  // Cursos únicos
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
  const [semanaNum, setSemanaNum] = useState(1)
  const [videoUrl, setVideoUrl] = useState('')
  const [recursos, setRecursos] = useState('')
  const [nivel, setNivel] = useState<'basico' | 'avanzado'>('basico')

  // Paso 3
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [docxLoading, setDocxLoading] = useState(false)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedCurso = cursosUnicos.find(c => c.id === selectedCursoId)

  // Cargar bitácoras cuando cambia el curso
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

  // Resetear chat al cambiar de tab o regenerar
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

    if (activeTab === 'html') {
      const result = await generarHtmlSemanal({
        bitacoraIds: ids,
        asignatura,
        semanaNum,
        videoUrl: videoUrl.trim() || undefined,
        recursos: recursos.trim() || undefined,
      })
      if (result.error) {
        setGenError(result.error)
      } else {
        setGeneratedContent(result.html)
        setStep(3)
      }
    } else {
      const result = await generarGuiaSemanal({
        bitacoraIds: ids,
        asignatura,
        semanaNum,
        nivel,
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

    const userMsg: ChatMessage = { role: 'user', content: solicitud, timestamp: new Date() }
    setChatMessages(prev => [...prev, userMsg])
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
        { role: 'assistant', content: `Error: ${result.error}`, timestamp: new Date() },
      ])
    } else {
      setGeneratedContent(result.content)
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: '✓ Contenido actualizado según tu solicitud.', timestamp: new Date() },
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
      const titulo = `Guía Semana ${semanaNum} - ${selectedCurso?.asignatura ?? 'Curso'}`
      await descargaDocx(generatedContent, titulo)
    } catch {
      alert('Error generando el archivo Word. Inténtalo de nuevo.')
    } finally {
      setDocxLoading(false)
    }
  }

  // ── Render ──

  const totalBitacoras = bitacoras.length
  const seleccionadas = selectedIds.size

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-[860px] z-50 bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">Generador de contenido semanal</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {step === 1 ? 'Selecciona las clases a incluir' : step === 2 ? 'Configura los parámetros' : 'Resultado listo para usar'}
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
          {(['html', 'guia'] as const).map(tab => (
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
              {tab === 'html' ? '📄 HTML Semanal' : '📚 Guía de Estudio'}
            </button>
          ))}
        </div>

        {/* Separador bajo tabs */}
        <div className="h-px bg-gray-800 flex-shrink-0" />

        {/* Pasos indicadores */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-gray-900/50">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s
                  ? 'bg-brand-600 text-white'
                  : step > s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-500'
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

          {/* ── PASO 1: Seleccionar clases ─────────────────────────────────── */}
          {step === 1 && (
            <div className="p-5 space-y-5">
              {/* Selector de curso */}
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

              {/* Lista de bitácoras */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">
                    Clases a incluir
                    {seleccionadas > 0 && (
                      <span className="ml-2 text-brand-400">{seleccionadas} seleccionada{seleccionadas !== 1 ? 's' : ''}</span>
                    )}
                  </label>
                  {totalBitacoras > 0 && (
                    <button
                      onClick={toggleTodas}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {selectedIds.size === totalBitacoras ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                  )}
                </div>

                {loadingBit ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : bitacoras.length === 0 ? (
                  <div className="rounded-lg border border-gray-800 p-6 text-center">
                    <p className="text-gray-500 text-sm">No hay clases planificadas o cumplidas en este curso.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
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
                                <span className="text-gray-600 text-xs">{b.actividades_count} actividad{b.actividades_count !== 1 ? 'es' : ''}</span>
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

          {/* ── PASO 2: Configurar ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-5 space-y-5">
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-center gap-2">
                <span className="text-emerald-400 text-sm">✓</span>
                <span className="text-gray-400 text-sm">
                  {seleccionadas} clase{seleccionadas !== 1 ? 's' : ''} seleccionada{seleccionadas !== 1 ? 's' : ''} de <strong className="text-gray-200">{selectedCurso?.asignatura}</strong>
                </span>
              </div>

              {/* Número de semana */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Número de semana</label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={semanaNum}
                  onChange={e => setSemanaNum(Number(e.target.value))}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Inputs específicos del tab */}
              {activeTab === 'html' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      URL de video YouTube <span className="text-gray-600">(opcional)</span>
                    </label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Recursos adicionales <span className="text-gray-600">(opcional — links, materiales)</span>
                    </label>
                    <textarea
                      value={recursos}
                      onChange={e => setRecursos(e.target.value)}
                      rows={3}
                      placeholder={'Slide: https://docs.google.com/...\nPDF: https://...'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none font-mono"
                    />
                  </div>
                </>
              )}

              {activeTab === 'guia' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Nivel del curso</label>
                  <div className="flex gap-3">
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

              {/* Error */}
              {genError && (
                <div className="rounded-lg bg-red-900/20 border border-red-500/40 px-4 py-3 text-red-400 text-sm">
                  {genError}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3: Resultado ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="p-5 space-y-4">
              {/* Textarea editable */}
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-xs font-medium text-gray-400">
                    {activeTab === 'html' ? 'Código HTML generado' : 'Guía generada'}
                    <span className="ml-2 text-gray-600">(editable directamente)</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCopiar}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors text-xs"
                    >
                      {copied ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                    <button
                      onClick={() => descargaTxt(
                        generatedContent,
                        activeTab === 'html'
                          ? `html-semana${semanaNum}-${selectedCurso?.asignatura ?? 'curso'}`
                          : `guia-semana${semanaNum}-${selectedCurso?.asignatura ?? 'curso'}`
                      )}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors text-xs"
                    >
                      ⬇ .txt
                    </button>
                    {activeTab === 'guia' && (
                      <button
                        onClick={handleDocx}
                        disabled={docxLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors text-xs disabled:opacity-50"
                      >
                        {docxLoading ? '⏳ Generando…' : '⬇ Word (.docx)'}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={generatedContent}
                  onChange={e => setGeneratedContent(e.target.value)}
                  rows={18}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 text-xs font-mono focus:outline-none focus:border-gray-600 resize-y leading-relaxed"
                />
              </div>

              {/* Mini chat */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-800">
                  <span className="text-xs font-medium text-gray-400">💬 Pedir mejoras</span>
                </div>

                {/* Historial */}
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

                {/* Input */}
                <div className="flex gap-2 p-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMejorar() } }}
                    placeholder={activeTab === 'html'
                      ? 'ej: "cambia los colores de encabezado a verde"'
                      : 'ej: "agrega más ejemplos en Conceptos Clave"'
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

        {/* Footer con botones de navegación */}
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
                `✦ Generar ${activeTab === 'html' ? 'HTML' : 'guía'}`
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => {
                setStep(2)
                setGeneratedContent('')
                resetearChat()
              }}
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
