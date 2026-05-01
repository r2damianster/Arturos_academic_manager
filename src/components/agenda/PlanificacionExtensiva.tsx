'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PlanificarModal } from './PlanificarModal'
import { ReplanificarModal } from './ReplanificarModal'

// ─── Types (mirrors planificacion-client) ─────────────────────────────────────

interface Curso {
  id: string
  asignatura: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

interface Clase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo: boolean
  curso_id: string
  cursos: Curso | null
}

interface BitacoraEntry {
  id: string
  estado: string
  tema: string
  actividades_json: { actividad: string; recurso: string }[]
  observaciones: string | null
  hora_inicio_real: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_LONG = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_S    = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_S   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmt2(n: number) { return String(n).padStart(2, '0') }
function dateToStr(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}` }
function fmt(t: string) { return t?.slice(0, 5) ?? '' }
function fmtFecha(s: string) {
  const d = new Date(s + 'T12:00:00')
  return { dia: `${DIAS_S[d.getDay()]} ${d.getDate()}`, mes: `${MESES_S[d.getMonth()]} ${d.getFullYear()}` }
}
function truncar(tema: string, max = 10) {
  const w = tema.trim().split(/\s+/)
  return w.length <= max ? tema : w.slice(0, max).join(' ') + '…'
}

function generarFechasClase(clases: Clase[], cursoId: string, desde: Date, hasta: Date) {
  const clasesDelCurso = clases.filter(c => (c.cursos?.id ?? c.curso_id) === cursoId && c.tipo !== 'tutoria_curso')
  const diasMap = new Map<string, Clase>()
  for (const c of clasesDelCurso) diasMap.set(c.dia_semana, c)

  const result: { fecha: string; clase: Clase }[] = []
  const cur = new Date(desde)
  while (cur <= hasta) {
    const dayName = DIAS_LONG[cur.getDay()]
    const clase = diasMap.get(dayName)
    if (clase) result.push({ fecha: dateToStr(cur), clase })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  clases: Clase[]
}

export function PlanificacionExtensiva({ clases }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const cursos = useMemo(() => {
    const map = new Map<string, Curso>()
    for (const c of clases) {
      if (c.cursos && c.tipo !== 'tutoria_curso') map.set(c.cursos.id, c.cursos)
    }
    return Array.from(map.values())
  }, [clases])

  const [cursoAId, setCursoAId] = useState(() => cursos[0]?.id ?? '')
  const [cursoBId, setCursoBId] = useState<string | null>(null)
  const [mesesA, setMesesA] = useState(2)
  const [offsetA, setOffsetA] = useState(0)  // semanas desde hoy
  const [offsetB, setOffsetB] = useState(0)  // semanas desde hoy (independiente)
  const [bitacoraMap, setBitacoraMap] = useState<Map<string, BitacoraEntry>>(new Map())
  const [planificarModal, setPlanificarModal] = useState<{ clase: Clase; fecha: string } | null>(null)
  const [replanificarModal, setReplanificarModal] = useState<{ cursoId: string; asignatura: string; fecha: string; tema: string } | null>(null)

  function offsetToDate(offset: number): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset * 7)
    return d
  }

  const { desdeA, hastaA } = useMemo(() => {
    const d = offsetToDate(offsetA)
    const h = new Date(d)
    h.setMonth(h.getMonth() + (cursoBId ? 1 : mesesA))
    return { desdeA: d, hastaA: h }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetA, mesesA, cursoBId])

  const { desdeB, hastaB } = useMemo(() => {
    if (!cursoBId) return { desdeB: new Date(), hastaB: new Date() }
    const d = offsetToDate(offsetB)
    const h = new Date(d)
    h.setMonth(h.getMonth() + 1)
    return { desdeB: d, hastaB: h }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetB, cursoBId])

  const fechasA = useMemo(
    () => cursoAId ? generarFechasClase(clases, cursoAId, desdeA, hastaA) : [],
    [clases, cursoAId, desdeA, hastaA]
  )
  const fechasB = useMemo(
    () => cursoBId ? generarFechasClase(clases, cursoBId, desdeB, hastaB) : [],
    [clases, cursoBId, desdeB, hastaB]
  )

  async function loadBitacoras() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !cursoAId) return

    const cursoIds = [cursoAId, cursoBId].filter(Boolean) as string[]
    // Usar el rango más amplio entre A y B para una sola query
    const fechaMin = dateToStr(new Date(Math.min(desdeA.getTime(), cursoBId ? desdeB.getTime() : desdeA.getTime())))
    const fechaMax = dateToStr(new Date(Math.max(hastaA.getTime(), cursoBId ? hastaB.getTime() : hastaA.getTime())))
    const { data } = await supabase
      .from('bitacora_clase')
      .select('id, curso_id, fecha, estado, tema, actividades_json, observaciones, hora_inicio_real')
      .eq('profesor_id', user.id)
      .in('curso_id', cursoIds)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax)

    const m = new Map<string, BitacoraEntry>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of (data ?? []) as any[]) {
      m.set(`${b.curso_id}|${b.fecha}`, {
        id: b.id,
        estado: b.estado,
        tema: b.tema ?? '',
        actividades_json: Array.isArray(b.actividades_json) ? b.actividades_json : [],
        observaciones: b.observaciones ?? null,
        hora_inicio_real: b.hora_inicio_real ?? null,
      })
    }
    setBitacoraMap(m)
  }

  useEffect(() => {
    if (cursoAId) loadBitacoras()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoAId, cursoBId, desdeA, hastaA, desdeB, hastaB])

  // ── Card ──────────────────────────────────────────────────────────────────

  function renderCard(clase: Clase, fecha: string, cursoId: string) {
    const entry = bitacoraMap.get(`${cursoId}|${fecha}`)
    const curso = cursos.find(c => c.id === cursoId)
    const isCumplido = entry?.estado === 'cumplido'
    const isPlanned  = entry?.estado === 'planificado'

    if (!entry) return (
      <button
        onClick={() => setPlanificarModal({ clase, fecha })}
        className="w-full text-left px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-500/30 hover:bg-yellow-900/30 transition-colors"
      >
        <span className="text-yellow-400 text-xs font-medium">⚠ Sin planificar</span>
        <p className="text-gray-500 text-[10px] mt-0.5">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</p>
        {clase.centro_computo && <span className="text-[9px] text-cyan-400">💻 Cómputo</span>}
      </button>
    )

    return (
      <div className={`px-3 py-2 rounded-lg border space-y-1.5 ${isCumplido ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-sky-900/20 border-sky-500/30'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className={`text-xs font-medium ${isCumplido ? 'text-emerald-400' : 'text-sky-400'}`}>
              {isCumplido ? '✓ Cumplido' : 'Planificado'}
            </span>
            <p className="text-gray-500 text-[10px]">{fmt(clase.hora_inicio)}–{fmt(clase.hora_fin)}</p>
            {entry.tema && <p className="text-gray-300 text-xs mt-0.5 leading-tight">{truncar(entry.tema)}</p>}
          </div>
          {clase.centro_computo && <span className="text-[9px] text-cyan-400 flex-shrink-0">💻</span>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setPlanificarModal({ clase, fecha })}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            {isCumplido ? 'Ver plan' : 'Editar'}
          </button>
          {isPlanned && (
            <>
              <Link
                href={`/dashboard/modo-clase/${entry.id}`}
                className="text-[10px] px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
              >
                ▶ Iniciar
              </Link>
              <button
                onClick={() => setReplanificarModal({
                  cursoId,
                  asignatura: curso?.asignatura ?? '',
                  fecha,
                  tema: entry.tema,
                })}
                className="text-[10px] px-2 py-0.5 rounded border border-amber-600/30 text-amber-400 hover:bg-amber-900/20 transition-colors"
              >
                Replanif.
              </button>
            </>
          )}
          {isCumplido && (
            <Link
              href={`/dashboard/modo-clase/${entry.id}`}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Ver resumen
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (cursos.length === 0) return (
    <p className="text-gray-500 text-sm text-center py-8">No hay cursos con horarios configurados.</p>
  )

  const cursoA = cursos.find(c => c.id === cursoAId)
  const cursoB = cursos.find(c => c.id === cursoBId)

  return (
    <div className="space-y-4">

      {/* Controles */}
      <div className="flex flex-wrap gap-4 items-end p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <div>
          <label className="label">Curso A</label>
          <select value={cursoAId} onChange={e => setCursoAId(e.target.value)} className="input text-sm">
            {cursos.map(c => <option key={c.id} value={c.id}>{c.asignatura}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Curso B — comparar</label>
          <select
            value={cursoBId ?? ''}
            onChange={e => { setCursoBId(e.target.value || null); setOffsetB(0) }}
            className="input text-sm"
          >
            <option value="">Sin comparar</option>
            {cursos.filter(c => c.id !== cursoAId).map(c => (
              <option key={c.id} value={c.id}>{c.asignatura}</option>
            ))}
          </select>
        </div>

        {!cursoBId && (
          <div>
            <label className="label">Horizonte A</label>
            <div className="flex gap-2">
              {[1, 2].map(n => (
                <button key={n} type="button" onClick={() => setMesesA(n)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mesesA === n ? 'border-brand-500 bg-brand-600/20 text-brand-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  {n} {n === 1 ? 'mes' : 'meses'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Columnas */}
      <div className={`grid gap-6 ${cursoBId ? 'md:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Curso A */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200">{cursoA?.asignatura}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setOffsetA(o => o - 1)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs">←</button>
              <span className="text-[10px] text-gray-500 w-20 text-center">{`${MESES_S[desdeA.getMonth()]} – ${MESES_S[hastaA.getMonth()]} ${hastaA.getFullYear()}`}</span>
              <button onClick={() => setOffsetA(o => o + 1)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs">→</button>
              {offsetA !== 0 && <button onClick={() => setOffsetA(0)} className="text-[10px] text-gray-600 hover:text-gray-400 px-1">hoy</button>}
            </div>
          </div>
          {fechasA.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-6">Sin clases en este período.</p>
          ) : (
            fechasA.map(({ fecha, clase }) => {
              const { dia, mes } = fmtFecha(fecha)
              return (
                <div key={fecha} className="flex gap-3">
                  <div className="w-24 flex-shrink-0 pt-2 text-right">
                    <p className="text-xs text-gray-300 font-medium">{dia}</p>
                    <p className="text-[10px] text-gray-600">{mes}</p>
                  </div>
                  <div className="flex-1">
                    {renderCard(clase, fecha, cursoAId)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Curso B */}
        {cursoBId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-200">{cursoB?.asignatura}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setOffsetB(o => o - 1)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs">←</button>
                <span className="text-[10px] text-gray-500 w-20 text-center">{`${MESES_S[desdeB.getMonth()]} – ${MESES_S[hastaB.getMonth()]} ${hastaB.getFullYear()}`}</span>
                <button onClick={() => setOffsetB(o => o + 1)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-800 text-xs">→</button>
                {offsetB !== 0 && <button onClick={() => setOffsetB(0)} className="text-[10px] text-gray-600 hover:text-gray-400 px-1">hoy</button>}
              </div>
            </div>
            {fechasB.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-6">Sin clases en este período.</p>
            ) : (
              fechasB.map(({ fecha, clase }) => {
                const { dia, mes } = fmtFecha(fecha)
                return (
                  <div key={fecha} className="flex gap-3">
                    <div className="w-24 flex-shrink-0 pt-2 text-right">
                      <p className="text-xs text-gray-300 font-medium">{dia}</p>
                      <p className="text-[10px] text-gray-600">{mes}</p>
                    </div>
                    <div className="flex-1">
                      {renderCard(clase, fecha, cursoBId)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {planificarModal && (
        <PlanificarModal
          cursoId={planificarModal.clase.cursos?.id ?? planificarModal.clase.curso_id}
          asignatura={planificarModal.clase.cursos?.asignatura ?? ''}
          fecha={planificarModal.fecha}
          horaInicio={planificarModal.clase.hora_inicio}
          horaFin={planificarModal.clase.hora_fin}
          clases={clases}
          onClose={() => setPlanificarModal(null)}
          onSaved={() => { setPlanificarModal(null); loadBitacoras() }}
        />
      )}

      {replanificarModal && (
        <ReplanificarModal
          cursoId={replanificarModal.cursoId}
          asignatura={replanificarModal.asignatura}
          origenFecha={replanificarModal.fecha}
          origenTema={replanificarModal.tema}
          onClose={() => setReplanificarModal(null)}
          onDone={() => { setReplanificarModal(null); loadBitacoras() }}
        />
      )}
    </div>
  )
}
