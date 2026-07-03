import Link from 'next/link'
import type { ReactNode } from 'react'

type TabKey = 'inicial' | 'progreso' | 'reporte'

const TABS: { key: TabKey; label: string; path: string }[] = [
  { key: 'inicial', label: 'Encuesta Inicial', path: 'encuesta' },
  { key: 'progreso', label: 'Encuesta de Progreso', path: 'encuesta-parcial' },
  { key: 'reporte', label: 'Reporte', path: 'encuesta-parcial/reporte' },
]

// Header + tabs compartido por /encuesta, /encuesta-parcial y /encuesta-parcial/reporte
// para que las 3 vistas de la encuesta se vean como una sola sección con estilo idéntico.
export function EncuestaTabsHeader({
  cursoId,
  active,
  title,
  subtitle,
  aside,
}: {
  cursoId: string
  active: TabKey
  title: string
  subtitle: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/cursos/${cursoId}`}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al curso
          </Link>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>
        </div>
        {aside && <div className="text-right flex-shrink-0">{aside}</div>}
      </div>

      <div className="flex gap-2 border-b border-gray-800">
        {TABS.map(tab => (
          tab.key === active ? (
            <span
              key={tab.key}
              className="px-3 py-2 text-sm font-medium text-white border-b-2 border-indigo-500"
            >
              {tab.label}
            </span>
          ) : (
            <Link
              key={tab.key}
              href={`/dashboard/cursos/${cursoId}/${tab.path}`}
              className="px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              {tab.label}
            </Link>
          )
        ))}
      </div>
    </div>
  )
}
