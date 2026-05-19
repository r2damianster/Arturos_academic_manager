'use client'

import { useState, useTransition, useMemo } from 'react'
import { getActividades } from '@/lib/actions/actividades'
import { ActividadCard } from '@/components/actividades/ActividadCard'
import { QuickAddModal } from '@/components/actividades/QuickAddModal'
import { EditarActividadPanel } from '@/components/actividades/EditarActividadPanel'
import type { Database } from '@/types/database.types'
import { Plus, Inbox } from 'lucide-react'

type ActividadRow = Database['public']['Tables']['actividades_inbox']['Row']
type ActividadConCurso = ActividadRow & { cursos: { asignatura: string } | null }

type Counts = {
  pendiente: number
  en_progreso: number
  cumplida: number
  convertida: number
  archivada: number
}

type Props = {
  counts: Counts
  cursos: { id: string; asignatura: string; codigo: string }[]
  actividadesIniciales: ActividadConCurso[]
}

const TABS: { key: keyof Counts; label: string }[] = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_progreso', label: 'En progreso' },
  { key: 'cumplida', label: 'Cumplidas' },
  { key: 'convertida', label: 'Convertidas' },
  { key: 'archivada', label: 'Archivadas' },
]

const TIPO_OPTS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'idea', label: '💡 Idea' },
  { value: 'tarea', label: '✅ Tarea' },
  { value: 'recordatorio', label: '🔔 Recordatorio' },
]

const PRIORIDAD_OPTS = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'alta', label: '🔴 Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baja', label: 'Baja' },
]

export function ActividadesClient({ counts, cursos, actividadesIniciales }: Props) {
  const [tabActivo, setTabActivo] = useState<keyof Counts>('pendiente')
  const [actividades, setActividades] = useState<ActividadConCurso[]>(actividadesIniciales)
  const [countsState, setCountsState] = useState(counts)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editando, setEditando] = useState<ActividadConCurso | null>(null)
  const [, startTransition] = useTransition()

  async function recargar(estado?: keyof Counts) {
    const tab = estado ?? tabActivo
    const [data, newCounts] = await Promise.all([
      getActividades({
        estado: tab,
        tipo: filtroTipo || undefined,
        cursoId: filtroCurso || undefined,
        prioridad: filtroPrioridad || undefined,
        search: busqueda || undefined,
      }),
      import('@/lib/actions/actividades').then(m => m.getCountsPorEstado()),
    ])
    setActividades(data)
    setCountsState(newCounts)
  }

  function cambiarTab(tab: keyof Counts) {
    setTabActivo(tab)
    startTransition(async () => {
      const data = await getActividades({
        estado: tab,
        tipo: filtroTipo || undefined,
        cursoId: filtroCurso || undefined,
        prioridad: filtroPrioridad || undefined,
        search: busqueda || undefined,
      })
      setActividades(data)
    })
  }

  async function aplicarFiltros() {
    startTransition(async () => {
      const data = await getActividades({
        estado: tabActivo,
        tipo: filtroTipo || undefined,
        cursoId: filtroCurso || undefined,
        prioridad: filtroPrioridad || undefined,
        search: busqueda || undefined,
      })
      setActividades(data)
    })
  }

  const actividadesFiltradas = useMemo(() => {
    if (!busqueda) return actividades
    const q = busqueda.toLowerCase()
    return actividades.filter(a =>
      a.titulo.toLowerCase().includes(q) ||
      (a.descripcion?.toLowerCase().includes(q))
    )
  }, [actividades, busqueda])

  return (
    <div className="space-y-5">
      {/* Botón agregar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {/* Tabs por estado */}
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => cambiarTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tabActivo === t.key
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {t.label}
              {countsState[t.key] > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tabActivo === t.key ? 'bg-brand-600/30 text-brand-300' : 'bg-gray-700 text-gray-400'
                }`}>
                  {countsState[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowQuickAdd(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva actividad
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Buscar..."
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); aplicarFiltros() }}
          className="input text-sm flex-1 min-w-[160px]"
        />
        <select
          value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value); setTimeout(aplicarFiltros, 0) }}
          className="input text-sm"
        >
          {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filtroPrioridad}
          onChange={e => { setFiltroPrioridad(e.target.value); setTimeout(aplicarFiltros, 0) }}
          className="input text-sm"
        >
          {PRIORIDAD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {cursos.length > 0 && (
          <select
            value={filtroCurso}
            onChange={e => { setFiltroCurso(e.target.value); setTimeout(aplicarFiltros, 0) }}
            className="input text-sm"
          >
            <option value="">Todos los cursos</option>
            {cursos.map(c => (
              <option key={c.id} value={c.id}>{c.asignatura}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      {actividadesFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-gray-700 mb-4" strokeWidth={1} />
          <p className="text-gray-500 font-medium">
            {tabActivo === 'pendiente' ? 'Inbox vacío' : `Sin actividades ${tabActivo}s`}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {tabActivo === 'pendiente'
              ? 'Agrega una idea, tarea o recordatorio para empezar'
              : 'Las actividades aparecerán aquí cuando cambies su estado'}
          </p>
          {tabActivo === 'pendiente' && (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="mt-4 btn-primary text-sm"
            >
              + Nueva actividad
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {actividadesFiltradas.map(a => (
            <ActividadCard
              key={a.id}
              actividad={a}
              onEditar={() => setEditando(a)}
              onCambiado={() => recargar()}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {showQuickAdd && (
        <QuickAddModal
          cursos={cursos}
          onClose={() => setShowQuickAdd(false)}
          onGuardado={() => { setShowQuickAdd(false); recargar('pendiente') }}
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
