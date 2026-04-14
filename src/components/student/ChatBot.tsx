'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// ─── Contextual help per page ─────────────────────────────────────────────────

const PAGE_HELP: Record<string, { title: string; bullets: string[] }> = {
  '/student': {
    title: 'Dashboard del estudiante',
    bullets: [
      'Ver tu porcentaje de asistencia y promedio general',
      'Revisar tus próximas clases y tutorías',
      'Acceder a tus cursos inscritos',
      'Ver el estado de tus trabajos y tareas',
    ],
  },
  '/student/tutorias': {
    title: 'Reserva de tutorías',
    bullets: [
      'Ver los horarios disponibles de tu profesor',
      'Reservar una tutoría individual para una fecha específica',
      'Confirmar tu asistencia a tutorías grupales del curso',
      'Ver tus reservas pendientes y confirmadas',
    ],
  },
  '/student/perfil': {
    title: 'Tu perfil',
    bullets: [
      'Actualizar tu carrera, modalidad y situación de vivienda',
      'Registrar tu número de teléfono de contacto',
      'Ver tu información académica registrada',
    ],
  },
}

// ─── FAQ predefinida ──────────────────────────────────────────────────────────

interface FAQ { q: string; a: string }

const FAQS: FAQ[] = [
  {
    q: '¿Cómo reservo una tutoría?',
    a: 'Ve a la sección "Tutorías" desde el menú. Ahí verás un calendario con los horarios disponibles de tu profesor. Haz clic en el horario que te convenga, elige la fecha y confirma tu reserva.',
  },
  {
    q: '¿Cómo veo mi asistencia?',
    a: 'En el dashboard principal puedes ver tu porcentaje de asistencia general. Para el detalle por clase, habla con tu profesor — él registra la asistencia en cada sesión.',
  },
  {
    q: '¿Cómo cancelo una tutoría?',
    a: 'Actualmente las cancelaciones se coordinan directamente con tu profesor. Puedes contactarle por el correo registrado en el sistema.',
  },
  {
    q: '¿Qué es una tutoría grupal?',
    a: 'Es una sesión de tutoría abierta para todos los estudiantes del curso. Aparece en el horario como "Tutoría grupal". Puedes marcar "Asistiré" para que tu profesor sepa que irás.',
  },
  {
    q: '¿Cómo actualizo mis datos?',
    a: 'Ve a "Mi perfil" (tu nombre en la esquina superior derecha). Ahí puedes actualizar tu carrera, modalidad, situación de vivienda y teléfono de contacto.',
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'bot' | 'user'
  text: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatBot() {
  const pathname = usePathname()
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: '¡Hola! Soy tu asistente. ¿En qué te puedo ayudar?' },
  ])
  const [input, setInput]     = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function addBot(text: string) {
    setMessages(prev => [...prev, { role: 'bot', text }])
  }

  function handleSuggestion(text: string) {
    setMessages(prev => [...prev, { role: 'user', text }])
    respondTo(text)
  }

  function respondTo(text: string) {
    const lower = text.toLowerCase()

    // Contextual: ¿qué puedo hacer aquí?
    if (lower.includes('qué puedo') || lower.includes('que puedo') || lower.includes('aquí') || lower.includes('aqui') || lower.includes('esta página') || lower.includes('esta pagina')) {
      const pageKey = Object.keys(PAGE_HELP).find(k => pathname.startsWith(k) && k !== '/student')
        ?? (pathname === '/student' ? '/student' : null)
      const help = pageKey ? PAGE_HELP[pageKey] : null
      if (help) {
        addBot(`En **${help.title}** puedes:\n${help.bullets.map(b => `• ${b}`).join('\n')}`)
      } else {
        addBot('En esta sección puedes navegar el portal estudiantil. Usa el menú superior para ir a Tutorías o tu Perfil.')
      }
      return
    }

    // FAQ matching
    const match = FAQS.find(f =>
      f.q.toLowerCase().split(' ').some(word => word.length > 4 && lower.includes(word))
    )
    if (match) { addBot(match.a); return }

    // Fallback
    addBot('No estoy seguro de esa respuesta. Prueba con las sugerencias de abajo, o contacta a tu profesor directamente.')
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    respondTo(text)
  }

  const suggestions = [
    '¿Qué puedo hacer aquí?',
    '¿Cómo reservo una tutoría?',
    '¿Cómo veo mi asistencia?',
    '¿Cómo actualizo mis datos?',
  ]

  return (
    <>
      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-20 right-4 w-80 max-h-[70vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">A</div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Asistente</p>
                <p className="text-[11px] text-emerald-400 leading-none mt-0.5">En línea</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Sugerencias rápidas */}
          <div className="px-3 py-2 border-t border-gray-800/60 flex gap-1.5 overflow-x-auto flex-shrink-0">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="text-[11px] whitespace-nowrap bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700 transition-colors flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-800 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Escribe tu pregunta..."
              className="flex-1 text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-4 w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-500 shadow-lg flex items-center justify-center z-50 transition-all hover:scale-105 active:scale-95"
        title="Asistente"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </>
  )
}
