'use client'

import { useState } from 'react'
import { Upload, CheckCircle2 } from 'lucide-react'
import { ParticipacionGrid, type ParticipacionRecord } from './participacion-grid'
import { ResumenEstudiantes, type AsistenciaStats } from './resumen-estudiantes'
import ItemsTab from './items-tab'
import EnCursoTab from './en-curso-tab'
import HistorialImports from './historial-imports'
import WizardImportCalificaciones from './import-wizard/wizard-shell'

interface Estudiante {
  id: string
  nombre: string
  email?: string
  auth_user_id?: string
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  calificaciones: Record<string, unknown>
  numParciales: number
  nombresTareas: string[]
  perfiles: Record<string, unknown>
  participacion: ParticipacionRecord[]
  asistenciaMap: Record<string, AsistenciaStats>
  // nuevos
  calificacionesItems: any[]
  imports: any[]
}

type Tab = 'resumen' | 'items' | 'en_curso' | 'participacion'

export function CalificacionesTabs({
  cursoId, estudiantes, calificaciones, numParciales, nombresTareas, perfiles,
  participacion, asistenciaMap, calificacionesItems, imports,
}: Props) {
  const itemsMoodle = calificacionesItems.filter((i: any) => i.fuente === 'moodle' || i.fuente === 'manual')
  const itemsEnCurso = calificacionesItems.filter((i: any) => i.fuente === 'en_curso')

  const [tab, setTab]                 = useState<Tab>('items')
  const [wizardAbierto, setWizardAbierto] = useState(false)
  const [importadoId, setImportadoId] = useState<string | null>(null)

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'resumen',        label: 'Resumen',           badge: estudiantes.length },
    { id: 'items',          label: 'Notas Moodle',      badge: itemsMoodle.length > 0 ? itemsMoodle.length : undefined },
    { id: 'en_curso',       label: 'En Curso',          badge: itemsEnCurso.length > 0 ? itemsEnCurso.length : undefined },
    { id: 'participacion',  label: 'Participación',     badge: participacion.length > 0 ? participacion.length : undefined },
  ]

  return (
    <div className="space-y-5">
      {/* Header: tabs + botón import */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-white/20' : 'bg-gray-800 text-gray-500'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setImportadoId(null); setWizardAbierto(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="h-4 w-4" />
          Importar de Moodle
        </button>
      </div>

      {/* Banner post-import */}
      {importadoId && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span>Calificaciones importadas exitosamente.</span>
          <button onClick={() => setImportadoId(null)} className="ml-auto text-green-600 hover:text-green-800 text-xs">×</button>
        </div>
      )}

      {/* Historial de imports */}
      {imports.length > 0 && (
        <HistorialImports cursoId={cursoId} imports={imports} />
      )}

      {/* Contenido */}
      {tab === 'resumen' && (
        <ResumenEstudiantes
          estudiantes={estudiantes}
          asistenciaMap={asistenciaMap}
          calificaciones={calificaciones as any}
          participacion={participacion}
        />
      )}
      {tab === 'items' && (
        <ItemsTab
          cursoId={cursoId}
          items={itemsMoodle}
          estudiantes={estudiantes as any}
          numParciales={numParciales}
        />
      )}
      {tab === 'en_curso' && (
        <EnCursoTab
          cursoId={cursoId}
          items={itemsEnCurso}
          estudiantes={estudiantes as any}
          numParciales={numParciales}
        />
      )}
      {tab === 'participacion' && (
        <ParticipacionGrid estudiantes={estudiantes} registros={participacion} />
      )}
      {/* Wizard de import */}
      {wizardAbierto && (
        <WizardImportCalificaciones
          cursoId={cursoId}
          numParciales={numParciales}
          onClose={() => setWizardAbierto(false)}
          onImportado={(id) => {
            setImportadoId(id)
            setWizardAbierto(false)
            setTab('items')
          }}
        />
      )}
    </div>
  )
}
