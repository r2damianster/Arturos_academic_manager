'use client'

import { useState, useTransition } from 'react'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { formatNombreCorto } from '@/lib/format'
import { CSS } from '@dnd-kit/utilities'
import {
  crearGrupos,
  copiarGruposASesion, guardarComoPlantilla,
  cerrarAfinidad, reabrirAfinidad,
} from '@/lib/actions/grupos'
import type { GrupoBase, PlantillaGrupo } from '@/lib/actions/grupos'
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

// ── Guardar como plantilla (inline) ──────────────────────────

function GuardarPlantillaInline({
  bitacoraId,
  cursoId,
}: {
  bitacoraId?: string | null
  cursoId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [nombre, setNombre] = useState('')
  const [isPending, startTransition] = useTransition()
  const [ok, setOk] = useState(false)

  if (!bitacoraId) return null
  if (ok) return <span className="text-xs text-amber-400">⭐ Plantilla guardada</span>

  return expanded ? (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        placeholder="Nombre de la plantilla…"
        className="input text-xs w-44 py-1"
        autoFocus
      />
      <button
        onClick={() => {
          if (!nombre.trim()) return
          startTransition(async () => {
            const r = await guardarComoPlantilla(nombre.trim(), bitacoraId, cursoId)
            if (!r.error) setOk(true)
          })
        }}
        disabled={isPending || !nombre.trim()}
        className="text-xs px-3 py-1.5 rounded-lg border border-amber-600 text-amber-400 hover:bg-amber-900/30 disabled:opacity-40 transition-colors"
      >
        {isPending ? '…' : 'Guardar'}
      </button>
      <button onClick={() => setExpanded(false)} className="text-xs text-gray-500 hover:text-gray-300">✕</button>
    </div>
  ) : (
    <button
      onClick={() => setExpanded(true)}
      className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:border-amber-600 hover:text-amber-400 transition-colors"
    >
      ⭐ Guardar como plantilla
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────

export function Agrupacion({
  students,
  cursoId = '',
  bitacoraId,
  categorias = [],
  gruposUltimaSesion,
  plantillas = [],
  onSaved,
  afinidadAbierta = false,
}: {
  students: Student[]
  cursoId?: string
  bitacoraId?: string | null
  categorias?: Categoria[]
  gruposUltimaSesion?: GrupoBase[] | null
  plantillas?: PlantillaGrupo[]
  onSaved?: () => void
  afinidadAbierta?: boolean
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

  // ── Reusar / Plantillas ───────────────────────────────────────
  const [isPendingReusar, startReusar] = useTransition()
  const [reusarMsg, setReusarMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleReusarUltima() {
    if (!gruposUltimaSesion || !bitacoraId) return
    startReusar(async () => {
      setReusarMsg(null)
      const r = await copiarGruposASesion(gruposUltimaSesion, bitacoraId, cursoId)
      if (r.error) {
        setReusarMsg({ type: 'err', text: r.error })
      } else {
        setReusarMsg({ type: 'ok', text: '✓ Grupos cargados' })
        onSaved?.()
      }
    })
  }

  function handleCargarPlantilla(nombrePlantilla: string) {
    if (!nombrePlantilla || !bitacoraId) return
    const plantilla = plantillas.find(p => p.nombre === nombrePlantilla)
    if (!plantilla) return
    startReusar(async () => {
      setReusarMsg(null)
      const r = await copiarGruposASesion(plantilla.grupos, bitacoraId, cursoId)
      if (r.error) {
        setReusarMsg({ type: 'err', text: r.error })
      } else {
        setReusarMsg({ type: 'ok', text: `✓ Plantilla "${nombrePlantilla}" cargada` })
        onSaved?.()
      }
    })
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
      {/* Banner reusar / plantillas */}
      {bitacoraId && (gruposUltimaSesion || plantillas.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-800/60 border border-gray-700/60 rounded-xl">
          <span className="text-xs text-gray-500 font-medium shrink-0">Reusar:</span>
          {gruposUltimaSesion && (
            <button
              onClick={handleReusarUltima}
              disabled={isPendingReusar}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-40 transition-colors"
            >
              {isPendingReusar ? '…' : '↩ Clase anterior'}
            </button>
          )}
          {plantillas.length > 0 && (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) handleCargarPlantilla(e.target.value) }}
              disabled={isPendingReusar}
              className="text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 py-1.5 hover:border-indigo-500 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <option value="">⭐ Mis plantillas…</option>
              {plantillas.map(p => (
                <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
          )}
          {reusarMsg && (
            <span className={`text-xs ${reusarMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {reusarMsg.text}
            </span>
          )}
        </div>
      )}

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
              onSaved={onSaved}
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
              onSaved={onSaved}
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
              afinidadAbiertaInicial={afinidadAbierta}
              onSaved={onSaved}
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
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual, onSaved,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
  onSaved?: () => void
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
      const result = await crearGrupos(
        bitacoraId ?? null,
        grupos.map((g, i) => ({ nombre: g.nombre, orden: i, estudianteIds: g.members.map(m => m.id) })),
        'aleatoria',
        categoriaActual,
        cursoId,
      )
      if (!result.error) {
        setSaved(true)
        onSaved?.()
      }
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
        {saved && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-emerald-400">✓ Grupos guardados</span>
            <GuardarPlantillaInline bitacoraId={bitacoraId} cursoId={cursoId} />
          </div>
        )}
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
                    <li key={s.id} className="text-sm text-gray-100">{formatNombreCorto(s.nombre)}</li>
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
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual, onSaved,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
  onSaved?: () => void
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
      const result = await crearGrupos(
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
      if (!result.error) {
        setSaved(true)
        onSaved?.()
      }
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
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-emerald-400">✓ Grupos guardados</span>
          <GuardarPlantillaInline bitacoraId={bitacoraId} cursoId={cursoId} />
        </div>
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
  activeStudents, configProps, nombresGrupos, cursoId, bitacoraId, categoriaActual, afinidadAbiertaInicial, onSaved,
}: {
  activeStudents: Student[]
  configProps: Parameters<typeof GrupoConfig>[0]
  nombresGrupos: string[]
  cursoId: string
  bitacoraId?: string | null
  categoriaActual: string | null
  afinidadAbiertaInicial?: boolean
  onSaved?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [creados, setCreados] = useState(afinidadAbiertaInicial ?? false)
  const [cerrado, setCerrado] = useState(false)
  const [sinGrupoCount, setSinGrupoCount] = useState(0)
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
      else { setCreados(true); setCerrado(false); setSinGrupoCount(0) }
    })
  }

  function cerrar() {
    startTransition(async () => {
      setError(null)
      const result = await cerrarAfinidad(bitacoraId ?? null, cursoId)
      if (result.error) { setError(result.error); return }
      setSinGrupoCount(result.sinGrupoCount ?? 0)
      setCerrado(true)
      onSaved?.()
    })
  }

  function reabrir() {
    startTransition(async () => {
      setError(null)
      const result = await reabrirAfinidad(bitacoraId ?? null, cursoId)
      if (result.error) setError(result.error)
      else { setCerrado(false); onSaved?.() }
    })
  }

  if (creados) {
    return (
      <div className="space-y-4">
        {cerrado ? (
          <div className="p-4 rounded-xl bg-gray-800/60 border border-gray-700 space-y-3">
            <div className="space-y-1">
              <p className="text-gray-300 font-medium text-sm">
                ✓ Inscripción cerrada — grupos conformados
              </p>
              {sinGrupoCount > 0 && (
                <p className="text-xs text-amber-400">
                  {sinGrupoCount} estudiante{sinGrupoCount !== 1 ? 's' : ''} sin grupo asignado →
                  movidos a &ldquo;Sin grupo&rdquo; con asistencia Ausente (modificable en la lista).
                </p>
              )}
              {sinGrupoCount === 0 && (
                <p className="text-xs text-gray-500">
                  Todos los estudiantes quedaron en un grupo.
                </p>
              )}
            </div>
            <button
              onClick={reabrir}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-700/80 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40"
            >
              {isPending ? 'Reabriendo…' : 'Reabrir inscripción'}
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-900/30 border border-emerald-700/50 space-y-3">
            <div className="space-y-1">
              <p className="text-emerald-300 font-medium text-sm">
                ✓ Grupos publicados — los estudiantes pueden elegir desde su portal
              </p>
              <p className="text-xs text-emerald-400/70">
                {nombresGrupos.length} grupos creados: {nombresGrupos.join(', ')}
              </p>
            </div>
            <button
              onClick={cerrar}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-amber-700/80 hover:bg-amber-600 text-white transition-colors disabled:opacity-40"
            >
              {isPending ? 'Cerrando…' : 'Cerrar inscripción'}
            </button>
          </div>
        )}

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

        {!cerrado && (
          <button
            onClick={() => setCreados(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Cambiar configuración
          </button>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
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
