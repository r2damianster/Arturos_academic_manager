'use client'

import { useState, useTransition } from 'react'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { crearGrupos, crearGruposConIntegrantes } from '@/lib/actions/grupos'
import { ExclusionPanel } from './ExclusionPanel'

type Student = { id: string; nombre: string; estado?: string | null }
type Categoria = { id: string; nombre: string; valores: string[] }
type TipoTab = 'aleatoria' | 'manual' | 'afinidad'

const COLORS = [
  { bg: 'bg-indigo-900/50', border: 'border-indigo-700', text: 'text-indigo-200', ring: 'ring-indigo-500/50' },
  { bg: 'bg-emerald-900/50', border: 'border-emerald-700', text: 'text-emerald-200', ring: 'ring-emerald-500/50' },
  { bg: 'bg-rose-900/50', border: 'border-rose-700', text: 'text-rose-200', ring: 'ring-rose-500/50' },
  { bg: 'bg-amber-900/50', border: 'border-amber-700', text: 'text-amber-200', ring: 'ring-amber-500/50' },
  { bg: 'bg-violet-900/50', border: 'border-violet-700', text: 'text-violet-200', ring: 'ring-violet-500/50' },
  { bg: 'bg-cyan-900/50', border: 'border-cyan-700', text: 'text-cyan-200', ring: 'ring-cyan-500/50' },
  { bg: 'bg-pink-900/50', border: 'border-pink-700', text: 'text-pink-200', ring: 'ring-pink-500/50' },
  { bg: 'bg-lime-900/50', border: 'border-lime-700', text: 'text-lime-200', ring: 'ring-lime-500/50' },
]
const getColor = (i: number) => COLORS[i % COLORS.length]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── DnD subcomponentes ────────────────────────────────────────

function DraggableStudent({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`text-xs px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? 'opacity-30' : 'text-gray-100 hover:bg-white/10'
      }`}
    >
      {student.nombre}
    </div>
  )
}

function DroppableColumn({
  id, title, colorIdx, students,
}: {
  id: string
  title: string
  colorIdx: number | null  // null → columna "Sin asignar" (gris)
  students: Student[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const c = colorIdx !== null ? getColor(colorIdx) : null
  const bgCls = c ? `${c.bg} ${c.border}` : 'bg-gray-800/60 border-gray-700'
  const textCls = c ? c.text : 'text-gray-400'
  const ringCls = c ? `ring-2 ${c.ring}` : 'ring-2 ring-gray-500/50'

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[140px] border rounded-xl p-3 transition-all ${bgCls} ${
        isOver ? ringCls : ''
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-2 ${textCls} opacity-80`}>
        {title}
        <span className="ml-1 font-normal opacity-50">({students.length})</span>
      </p>
      <div className="space-y-0.5 min-h-[48px]">
        {students.map(s => <DraggableStudent key={s.id} student={s} />)}
      </div>
    </div>
  )
}

// ── Config compartida (categoría + selector enlazado) ─────────

function GrupoConfig({
  categorias, categoriaId, onCategoriaChange,
  numGrupos, maxPorGrupo, activeCount,
  onNumGrupos, onMaxPorGrupo,
  nombresGrupos, onNombresChange,
}: {
  categorias: Categoria[]
  categoriaId: string | null
  onCategoriaChange: (id: string) => void
  numGrupos: number
  maxPorGrupo: number
  activeCount: number
  onNumGrupos: (n: number) => void
  onMaxPorGrupo: (n: number) => void
  nombresGrupos: string[]
  onNombresChange: (names: string[]) => void
}) {
  const catActual = categorias.find(c => c.id === categoriaId)
  const isCustom = !catActual || catActual.valores.length === 0

  return (
    <div className="space-y-4">
      {/* Categoría */}
      <div>
        <p className="label text-xs mb-1">Categoría de nombres</p>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoriaChange(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoriaId === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Selector enlazado N grupos ↔ máx por grupo */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="label text-xs">N.° de grupos</label>
          <input
            type="number"
            min={2}
            max={Math.min(10, activeCount)}
            value={numGrupos}
            onChange={e => onNumGrupos(Math.max(2, Number(e.target.value)))}
            className="input w-20"
          />
        </div>
        <span className="text-gray-500 pb-2.5 text-sm">↔</span>
        <div>
          <label className="label text-xs">Máx. por grupo</label>
          <input
            type="number"
            min={1}
            max={activeCount}
            value={maxPorGrupo}
            onChange={e => onMaxPorGrupo(Math.max(1, Number(e.target.value)))}
            className="input w-20"
          />
        </div>
        <p className="text-xs text-gray-500 pb-2.5">
          {activeCount} activos → {numGrupos} grupos de ~{maxPorGrupo}
        </p>
      </div>

      {/* Nombres de grupos */}
      <div>
        <p className="label text-xs mb-1">Nombres de grupos</p>
        <div className="flex flex-wrap gap-2">
          {nombresGrupos.map((name, i) => {
            const c = getColor(i)
            return isCustom ? (
              <input
                key={i}
                type="text"
                value={name}
                onChange={e => {
                  const next = [...nombresGrupos]
                  next[i] = e.target.value
                  onNombresChange(next)
                }}
                placeholder={`Grupo ${i + 1}`}
                className="input w-28 text-xs"
              />
            ) : (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${c.bg} ${c.border} ${c.text}`}
              >
                {name}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────

export function Agrupacion({
  students,
  cursoId = '',
  bitacoraId,
  categorias = [],
}: {
  students: Student[]
  cursoId?: string
  bitacoraId?: string | null
  categorias?: Categoria[]
}) {
  const [tab, setTab] = useState<TipoTab>('aleatoria')

  // Exclusión compartida — retirados arrancam excluidos
  const [excluded, setExcluded] = useState<Set<string>>(
    new Set(students.filter(s => s.estado === 'retirado').map(s => s.id))
  )
  const activeStudents = students.filter(s => !excluded.has(s.id))
  const activeCount = activeStudents.length

  // Config compartida
  const defaultCatId = categorias[0]?.id ?? null
  const [categoriaId, setCategoriaId] = useState<string | null>(defaultCatId)
  const [numGrupos, setNumGruposState] = useState(3)
  const [maxPorGrupo, setMaxPorGrupoState] = useState(Math.ceil(activeCount / 3))
  const [nombresGrupos, setNombresGrupos] = useState<string[]>(() => {
    const cat = categorias[0]
    return cat?.valores.slice(0, 3) ?? ['Grupo 1', 'Grupo 2', 'Grupo 3']
  })

  function buildNombres(n: number, catId: string | null, current: string[]): string[] {
    const cat = categorias.find(c => c.id === catId)
    const source = cat && cat.valores.length > 0 ? cat.valores : current
    return Array.from({ length: n }, (_, i) => source[i] ?? `Grupo ${i + 1}`)
  }

  function handleNumGrupos(n: number) {
    const capped = Math.min(n, Math.min(10, activeCount))
    setNumGruposState(capped)
    setMaxPorGrupoState(Math.ceil(activeCount / capped))
    setNombresGrupos(buildNombres(capped, categoriaId, nombresGrupos))
  }

  function handleMaxPorGrupo(max: number) {
    const n = Math.min(10, Math.max(2, Math.ceil(activeCount / Math.max(1, max))))
    setNumGruposState(n)
    setMaxPorGrupoState(Math.ceil(activeCount / n))
    setNombresGrupos(buildNombres(n, categoriaId, nombresGrupos))
  }

  function handleCategoria(id: string) {
    setCategoriaId(id)
    const cat = categorias.find(c => c.id === id)
    if (cat && cat.valores.length > 0) {
      setNombresGrupos(cat.valores.slice(0, numGrupos))
    } else {
      setNombresGrupos(Array.from({ length: numGrupos }, (_, i) => `Grupo ${i + 1}`))
    }
  }

  if (students.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No hay estudiantes en este curso.
      </div>
    )
  }

  const configProps = {
    categorias, categoriaId, onCategoriaChange: handleCategoria,
    numGrupos, maxPorGrupo, activeCount,
    onNumGrupos: handleNumGrupos, onMaxPorGrupo: handleMaxPorGrupo,
    nombresGrupos, onNombresChange: setNombresGrupos,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
        {(['aleatoria', 'manual', 'afinidad'] as TipoTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'aleatoria' ? 'Aleatoria' : t === 'manual' ? 'Manual' : 'Por afinidad'}
          </button>
        ))}
      </div>

      {/* Layout: contenido + panel exclusión */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {tab === 'aleatoria' && (
            <TabAleatoria
              activeStudents={activeStudents}
              configProps={configProps}
              nombresGrupos={nombresGrupos}
              cursoId={cursoId}
              bitacoraId={bitacoraId}
              categoriaActual={categorias.find(c => c.id === categoriaId)?.nombre ?? null}
            />
          )}
          {tab === 'manual' && (
            <TabManual
              activeStudents={activeStudents}
              configProps={configProps}
              nombresGrupos={nombresGrupos}
              cursoId={cursoId}
              bitacoraId={bitacoraId}
              categoriaActual={categorias.find(c => c.id === categoriaId)?.nombre ?? null}
            />
          )}
          {tab === 'afinidad' && (
            <TabAfinidad
              activeStudents={activeStudents}
              configProps={configProps}
              nombresGrupos={nombresGrupos}
              cursoId={cursoId}
              bitacoraId={bitacoraId}
              categoriaActual={categorias.find(c => c.id === categoriaId)?.nombre ?? null}
            />
          )}
        </div>

        {/* Panel de exclusión */}
        <div className="w-52 shrink-0 border border-gray-700/50 rounded-xl p-3 bg-gray-800/40">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Participantes
          </p>
          <ExclusionPanel students={students} excluded={excluded} onChange={setExcluded} />
        </div>
      </div>
    </div>
  )
}

// ── Tab Aleatoria ─────────────────────────────────────────────

function TabAleatoria({
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
}) {
  const [grupos, setGrupos] = useState<{ nombre: string; members: Student[] }[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function generar() {
    const shuffled = shuffle(activeStudents)
    const n = nombresGrupos.length
    const result = nombresGrupos.map((nombre, i) => ({
      nombre,
      members: shuffled.filter((_, j) => j % n === i),
    }))
    setGrupos(result)
    setSaved(false)
  }

  function guardar() {
    if (!grupos) return
    startTransition(async () => {
      const result = await crearGruposConIntegrantes(
        bitacoraId ?? null,
        grupos.map((g, i) => ({ nombre: g.nombre, orden: i, estudianteIds: g.members.map(m => m.id) })),
        'aleatoria',
        categoriaActual,
        cursoId,
      )
      if (!result.error) setSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      <GrupoConfig {...configProps} />

      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={generar} className="btn-primary px-6 py-2.5">
          {grupos ? 'Re-mezclar' : 'Generar grupos'}
        </button>
        {grupos && !saved && (
          <button
            onClick={guardar}
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl border border-emerald-600 text-emerald-400 hover:bg-emerald-900/30 text-sm font-medium transition-colors disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : '💾 Guardar grupos'}
          </button>
        )}
        {saved && <span className="text-sm text-emerald-400">✓ Grupos guardados — ve al tab Grupos →</span>}
      </div>

      {grupos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {grupos.map((g, i) => {
            const c = getColor(i)
            return (
              <div key={g.nombre} className={`border rounded-xl p-4 ${c.bg} ${c.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${c.text} opacity-70`}>
                  {g.nombre}
                </p>
                <ul className="space-y-1.5">
                  {g.members.map(s => (
                    <li key={s.id} className="text-sm text-gray-100">{s.nombre}</li>
                  ))}
                </ul>
                <p className={`text-xs opacity-40 mt-3 ${c.text}`}>
                  {g.members.length} integrante{g.members.length !== 1 ? 's' : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Manual (DnD) ──────────────────────────────────────────

function TabManual({
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
}) {
  const [configured, setConfigured] = useState(false)
  // studId → groupName | '__unassigned__'
  const [manualMap, setManualMap] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  // Excluidos del manual map cuando cambia configured
  const studentsForDnd = activeStudents

  function confirmarConfig() {
    setManualMap({})
    setConfigured(true)
    setSaved(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const studId = active.id as string
    const target = over.id as string
    setManualMap(prev => {
      if (target === '__unassigned__') {
        const next = { ...prev }
        delete next[studId]
        return next
      }
      return { ...prev, [studId]: target }
    })
  }

  function guardar() {
    startTransition(async () => {
      const result = await crearGruposConIntegrantes(
        bitacoraId ?? null,
        nombresGrupos.map((nombre, i) => ({
          nombre,
          orden: i,
          estudianteIds: Object.entries(manualMap)
            .filter(([, g]) => g === nombre)
            .map(([id]) => id),
        })),
        'manual',
        categoriaActual,
        cursoId,
      )
      if (!result.error) setSaved(true)
    })
  }

  if (!configured) {
    return (
      <div className="space-y-5">
        <GrupoConfig {...configProps} />
        <button onClick={confirmarConfig} className="btn-primary px-6 py-2.5">
          Listo, asignar estudiantes
        </button>
      </div>
    )
  }

  const sinAsignarIds = studentsForDnd.filter(s => !(s.id in manualMap)).map(s => s.id)
  const getStudents = (groupName: string) =>
    studentsForDnd.filter(s => manualMap[s.id] === groupName)
  const getUnassigned = () =>
    studentsForDnd.filter(s => !(s.id in manualMap))

  const allAssigned = sinAsignarIds.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Arrastra a los estudiantes a su grupo</p>
        <button
          onClick={() => { setConfigured(false); setManualMap({}) }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Cambiar configuración
        </button>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Sin asignar */}
          <DroppableColumn
            id="__unassigned__"
            title="Sin asignar"
            colorIdx={null}
            students={getUnassigned()}
          />
          {/* Grupos */}
          {nombresGrupos.map((nombre, i) => (
            <DroppableColumn
              key={nombre}
              id={nombre}
              title={nombre}
              colorIdx={i}
              students={getStudents(nombre)}
            />
          ))}
        </div>
      </DndContext>

      {saved ? (
        <p className="text-sm text-emerald-400">✓ Grupos guardados</p>
      ) : (
        <button
          onClick={guardar}
          disabled={isPending || !allAssigned}
          className="btn-primary px-6 py-2.5 disabled:opacity-40"
        >
          {isPending ? 'Guardando…' : allAssigned ? 'Guardar grupos' : `Quedan ${sinAsignarIds.length} sin asignar`}
        </button>
      )}
    </div>
  )
}

// ── Tab Por afinidad ──────────────────────────────────────────

function TabAfinidad({
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [creados, setCreados] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function crear() {
    const grupos = nombresGrupos.map((nombre, i) => ({ nombre, orden: i }))
    startTransition(async () => {
      setError(null)
      const result = await crearGrupos(
        bitacoraId ?? null,
        grupos,
        'afinidad',
        categoriaActual,
        cursoId,
      )
      if (result.error) setError(result.error)
      else setCreados(true)
    })
  }

  if (creados) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-emerald-900/30 border border-emerald-700/50 space-y-2">
          <p className="text-emerald-300 font-medium text-sm">
            ✓ Grupos publicados — los estudiantes pueden elegir desde su portal
          </p>
          <p className="text-xs text-emerald-400/70">
            {nombresGrupos.length} grupos creados: {nombresGrupos.join(', ')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {nombresGrupos.map((nombre, i) => {
            const c = getColor(i)
            return (
              <div key={nombre} className={`border rounded-xl p-4 ${c.bg} ${c.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-widest ${c.text} opacity-70`}>
                  {nombre}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  0 / {configProps.maxPorGrupo} integrantes
                </p>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setCreados(false)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Cambiar configuración
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300">
        Los estudiantes verán estos grupos en su portal y podrán unirse al de su preferencia.
      </div>

      <GrupoConfig {...configProps} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={crear}
        disabled={isPending}
        className="btn-primary px-6 py-2.5 disabled:opacity-40"
      >
        {isPending ? 'Creando…' : 'Publicar grupos para estudiantes'}
      </button>
    </div>
  )
}
