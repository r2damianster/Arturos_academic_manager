'use client'

import { useState, useTransition } from 'react'
import { getActividades, getCounts } from '@/lib/actions/actividades'
import { ActividadCard } from '@/components/actividades/ActividadCard'
import { QuickAddModal } from '@/components/actividades/QuickAddModal'
import { EditarActividadPanel } from '@/components/actividades/EditarActividadPanel'
import type { ActividadConCurso } from '@/lib/actions/actividades'
import { Plus, StickyNote, Search } from 'lucide-react'

type Counts = { total: number; archivadas: number; fijadas: number }

type Props = {
  counts: Counts
  cursos: { id: string; asignatura: string; codigo: string }[]
  actividadesIniciales: ActividadConCurso[]
}

const TIPO_OPTS = [
  { value: '', label: 'Todas' },
  { value: 'nota', label: '📝 Notas' },
  { value: 'tarea', label: '✅ Tareas' },
  { value: 'recordatorio', label: '🔔 Recordatorios' },
]

const COLOR_OPTS = [
  { value: '', label: 'Todos los colores', dot: '' },
  { value: 'rojo',     label: 'Rojo',     dot: 'bg-red-500' },
  { value: 'naranja',  label: 'Naranja',  dot: 'bg-orange-500' },
  { value: 'amarillo', label: 'Amarillo', dot: 'bg-yellow-400' },
  { value: 'verde',    label: 'Verde',    dot: 'bg-green-500' },
  { value: 'teal',     label: 'Teal',     dot: 'bg-teal-400' },
  { value: 'azul',     label: 'Azul',     dot: 'bg-blue-500' },
  { value: 'morado',   label: 'Morado',   dot: 'bg-purple-500' },
]

export function ActividadesClient({ counts, cursos, actividadesIniciales }: Props) {
  const [vistaArchivadas, setVistaArchivadas] = useState(false)
  const [actividades, setActividades] = useState<ActividadConCurso[]>(actividadesIniciales)
  const [countsState, setCountsState] = useState(counts)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroColor, setFiltroColor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editando, setEditando] = useState<ActividadConCurso | null>(null)
  const [, startTransition] = useTransition()

  async function recargar(archivada?: boolean) {
    const archivar = archivada ?? vistaArchivadas
    const [data, newCounts] = await Promise.all([
      getActividades({
        archivada: archivar,
        tipo: filtroTipo || undefined,
        cursoId: filtroCurso || undefined,
        color: filtroColor || undefined,
        search: busqueda || undefined,
      }),
      getCounts(),
    ])
    setActividades(data)
    setCountsState(newCounts)
  }

  async function cambiarVista(archivada: boolean) {
    setVistaArchivadas(archivada)
    startTransition(async () => {
      const data = await getActividades({
        archivada,
        tipo: filtroTipo || undefined,
        cursoId: filtroCurso || undefined,
        color: filtroColor || undefined,
      })
      setActividades(data)
    })
  }

  async function aplicarFiltros(overrides: Record<string, string> = {}) {
    const tipo = overrides.tipo ?? filtroTipo
    const cursoId = overrides.cursoId ?? filtroCurso
    const color = overrides.color ?? filtroColor
    const search = overrides.search ?? busqueda
    startTransition(async () => {
      const data = await getActividades({
        archivada: vistaArchivadas,
        tipo: tipo || undefined,
        cursoId: cursoId || undefined,
        color: color || undefined,
        search: search || undefined,
      })
      setActividades(data)
    })
  }

  // Split pinned / normal (solo en vista activa)
  const fijadas = !vistaArchivadas ? actividades.filter(a => a.pinned) : []
  const noFijadas = !vistaArchivadas ? actividades.filter(a => !a.pinned) : actividades

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar notas..."
            value={busqueda}
            onChange={e => {
              setBusqueda(e.target.value)
              aplicarFiltros({ search: e.target.value })
            }}
            className="input pl-9 w-full text-sm"
          />
        </div>

        {/* Vista tabs */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => cambiarVista(false)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              !vistaArchivadas ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Notas {countsState.total > 0 && <span className="ml-1 text-xs text-gray-500">{countsState.total}</span>}
          </button>
          <button
            onClick={() => cambiarVista(true)}
            className={`px-3 py-1.5 text-sm border-l border-gray-700 transition-colors ${
              vistaArchivadas ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Archivadas {countsState.archivadas > 0 && <span className="ml-1 text-xs text-gray-500">{countsState.archivadas}</span>}
          </button>
        </div>

        {/* Nueva nota */}
        <button onClick={() => setShowQuickAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" />
          Nueva nota
        </button>
      </div>

      {/* Filtros secundarios */}
      <div className="flex gap-2 flex-wrap">
        {/* Tipo */}
        <div className="flex gap-1">
          {TIPO_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => { setFiltroTipo(o.value); aplicarFiltros({ tipo: o.value }) }}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                filtroTipo === o.value
                  ? 'bg-gray-700 text-gray-200 border-gray-600'
                  : 'text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-400'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Color */}
        <div className="flex gap-1 items-center ml-2">
          {COLOR_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => { setFiltroColor(o.value); aplicarFiltros({ color: o.value }) }}
              title={o.label}
              className={`transition-all ${
                o.value === ''
                  ? `text-xs px-2 py-1 rounded-lg border ${filtroColor === '' ? 'bg-gray-700 text-gray-200 border-gray-600' : 'text-gray-500 border-gray-800 hover:border-gray-700'}`
                  : `w-4 h-4 rounded-full ${o.dot} ${filtroColor === o.value ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-950 scale-110' : 'opacity-60 hover:opacity-100'}`
              }`}
            >
              {o.value === '' ? 'Color' : ''}
            </button>
          ))}
        </div>

        {/* Curso */}
        {cursos.length > 0 && (
          <select
            value={filtroCurso}
            onChange={e => { setFiltroCurso(e.target.value); aplicarFiltros({ cursoId: e.target.value }) }}
            className="input text-xs ml-2"
          >
            <option value="">Todos los cursos</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.asignatura}</option>)}
          </select>
        )}
      </div>

      {/* Grid masonry */}
      {actividades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <StickyNote className="w-14 h-14 text-gray-800 mb-4" strokeWidth={1} />
          <p className="text-gray-500 font-medium">
            {vistaArchivadas ? 'Sin notas archivadas' : 'Tu tablero está vacío'}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {!vistaArchivadas && 'Captura ideas, tareas y recordatorios'}
          </p>
          {!vistaArchivadas && (
            <button onClick={() => setShowQuickAdd(true)} className="mt-4 btn-primary text-sm">
              + Nueva nota
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fijadas */}
          {fijadas.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">Fijadas</p>
              <div className="columns-2 md:columns-3 lg:columns-4" style={{ columnGap: '0.75rem' }}>
                {fijadas.map(a => (
                  <ActividadCard key={a.id} actividad={a} onEditar={() => setEditando(a)} onCambiado={() => recargar()} />
                ))}
              </div>
            </div>
          )}

          {/* Notas / Otras */}
          {noFijadas.length > 0 && (
            <div>
              {fijadas.length > 0 && (
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">Otras</p>
              )}
              <div className="columns-2 md:columns-3 lg:columns-4" style={{ columnGap: '0.75rem' }}>
                {noFijadas.map(a => (
                  <ActividadCard key={a.id} actividad={a} onEditar={() => setEditando(a)} onCambiado={() => recargar()} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showQuickAdd && (
        <QuickAddModal
          cursos={cursos}
          onClose={() => setShowQuickAdd(false)}
          onGuardado={() => { setShowQuickAdd(false); recargar(false) }}
        />
      )}

      {editando && (
        <EditarActividadPanel
          actividad={editando}
          cursos={cursos}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); recargar() }}
        />
      )}
    </div>
  )
}
