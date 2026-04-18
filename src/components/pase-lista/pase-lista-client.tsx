'use client'

import { useEffect, useState, useTransition } from 'react'
import { registrarAsistenciaMasiva, type RegistroAsistenciaInput } from '@/lib/actions/asistencia'
import { guardarBitacoraData } from '@/lib/actions/bitacora'
import { asignarTutoriaDirecta } from '@/lib/actions/tutorias'
import { useRouter } from 'next/navigation'
import type { EstudiantePerfil } from '@/app/dashboard/cursos/[cursoId]/pase-lista/page'
import { TrabajoEditPanel, type Trabajo } from '@/components/trabajos/trabajo-edit-panel'
import { StudentProfilePanel } from './student-profile-panel'

type EstadoAsistencia = 'Presente' | 'Ausente' | 'Atraso'
type Paso = 'bitacora' | 'lista' | 'resumen'

interface Estudiante {
  id: string
  nombre: string
  email: string
  tutoria: boolean
  auth_user_id: string | null
}

interface HorarioTutoria {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  disponible_hasta: string | null
}

interface RegistroLocal {
  estado: EstadoAsistencia
  atraso: boolean
  horas: number
  participacion: number | null
  observacion_part: string
  obs_trabajo: string
}

interface BitacoraLocal {
  tema: string
  actividades: string
  materiales: string
  observaciones: string
}

interface Props {
  cursoId: string
  estudiantes: Estudiante[]
  fecha: string
  horasSesion: number
  perfiles: Record<string, EstudiantePerfil>
  horariosTutoria: HorarioTutoria[]
}

const COLORES_BTN: Record<number, string> = {
  1: 'bg-red-600 hover:bg-red-500',
  2: 'bg-orange-600 hover:bg-orange-500',
  3: 'bg-yellow-600 hover:bg-yellow-500',
  4: 'bg-lime-600 hover:bg-lime-500',
  5: 'bg-emerald-600 hover:bg-emerald-500',
}
const COLORES_TEXT: Record<number, string> = {
  1: 'text-red-400', 2: 'text-orange-400', 3: 'text-yellow-400',
  4: 'text-lime-400', 5: 'text-emerald-400',
}
const ETIQUETAS: Record<number, string> = {
  1: 'Nula', 2: 'Baja', 3: 'Media', 4: 'Alta', 5: 'Excelente',
}

function fmt(t: string) { return t?.slice(0, 5) ?? '' }
function todayStr() { return new Date().toISOString().split('T')[0] }

export function PaseListaClient({ cursoId, estudiantes, fecha, horasSesion, perfiles, horariosTutoria }: Props) {
  const [paso, setPaso] = useState<Paso>('bitacora')
  const [bitacora, setBitacora] = useState<BitacoraLocal>({ tema: '', actividades: '', materiales: '', observaciones: '' })
  const [indice, setIndice] = useState(0)
  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isLoadingFecha, setIsLoadingFecha] = useState(false)
  const [existingRecords, setExistingRecords] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadRegistroFecha() {
      setIsLoadingFecha(true)
      setExistingRecords(null)
      try {
        const res = await fetch(`/api/asistencia/registro?cursoId=${cursoId}&fecha=${fecha}`, {
          cache: 'no-store',
        })
        const data = await res.json()
        if (!active) return
        if (res.ok && data?.registros) {
          setRegistros(data.registros)
          setExistingRecords(Object.keys(data.registros).length)
          if (data.bitacora) {
            setBitacora({
              tema: data.bitacora.tema || '',
              actividades: data.bitacora.actividades || '',
              materiales: data.bitacora.materiales || '',
              observaciones: data.bitacora.observaciones || ''
            })
          } else {
            setBitacora({ tema: '', actividades: '', materiales: '', observaciones: '' })
          }
        } else {
          setRegistros({})
          setExistingRecords(0)
          setBitacora({ tema: '', actividades: '', materiales: '', observaciones: '' })
        }
      } catch {
        if (!active) return
        setRegistros({})
        setExistingRecords(0)
        setBitacora({ tema: '', actividades: '', materiales: '', observaciones: '' })
      } finally {
        if (active) setIsLoadingFecha(false)
      }
    }

    loadRegistroFecha()
    return () => {
      active = false
    }
  }, [cursoId, fecha])

  // Per-student tutoría assignment state
  const [tutOpen, setTutOpen]   = useState<string | null>(null)  // student id
  const [tutHor,  setTutHor]    = useState<string>('')
  const [tutDate, setTutDate]   = useState<string>(todayStr())
  const [tutNota, setTutNota]   = useState<string>('')
  const [tutSaving, setTutSaving] = useState(false)
  const [tutMsg, setTutMsg]     = useState<string | null>(null)

  // Track the task being edited
  const [selectedTrabajo, setSelectedTrabajo] = useState<Trabajo | null>(null)
  
  // Track if profile panel is open
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const horas = Math.max(1, Math.round(horasSesion))
  const actual = estudiantes[indice]
  const total = estudiantes.length
  const completados = Object.keys(registros).length

  function marcarAsistencia(estado: EstadoAsistencia) {
    setRegistros(prev => ({
      ...prev,
      [actual.id]: {
        estado,
        atraso: estado === 'Atraso',
        horas: estado === 'Ausente' ? 0 : estado === 'Atraso' ? Math.max(1, Math.round(horas / 2)) : horas,
        participacion: prev[actual.id]?.participacion ?? null,
        observacion_part: prev[actual.id]?.observacion_part ?? '',
        obs_trabajo: prev[actual.id]?.obs_trabajo ?? '',
      },
    }))
  }

  function setObsTrabajo(texto: string) {
    setRegistros(prev => ({
      ...prev,
      [actual.id]: { ...prev[actual.id], obs_trabajo: texto },
    }))
  }

  function setParticipacion(nivel: number) {
    setRegistros(prev => ({
      ...prev,
      [actual.id]: {
        ...prev[actual.id],
        participacion: prev[actual.id]?.participacion === nivel ? null : nivel,
      },
    }))
  }

  function setObservacion(texto: string) {
    setRegistros(prev => ({
      ...prev,
      [actual.id]: { ...prev[actual.id], observacion_part: texto },
    }))
  }

  async function asignarTutoria(est: Estudiante) {
    if (!est.auth_user_id) { setTutMsg('❌ Sin cuenta vinculada'); return }
    if (!tutHor || !tutDate) { setTutMsg('❌ Selecciona horario y fecha'); return }
    setTutSaving(true); setTutMsg(null)
    const res = await asignarTutoriaDirecta({
      horarioId:        Number(tutHor),
      fecha:            tutDate,
      authUserId:       est.auth_user_id,
      estudianteNombre: est.nombre,
      estudianteEmail:  est.email,
      nota:             tutNota.trim() || null,
    })
    if (res.error) {
      setTutMsg(`❌ ${res.error}`)
    } else {
      const h = horariosTutoria.find(x => x.id === Number(tutHor))
      setTutMsg(`✓ Tutoría asignada — ${tutDate}${h ? ' ' + fmt(h.hora_inicio) : ''}`)
      setTutHor(''); setTutNota('')
    }
    setTutSaving(false)
  }

  function siguiente() {
    if (indice < total - 1) setIndice(i => i + 1)
    else setPaso('resumen')
  }

  function guardar() {
    setError(null)
    const inputs: RegistroAsistenciaInput[] = estudiantes.map(est => {
      const reg = registros[est.id]
      const perfil = perfiles[est.id]
      return {
        estudiante_id: est.id,
        estado: reg?.estado ?? 'Ausente',
        atraso: reg?.atraso ?? false,
        horas: reg?.horas ?? 0,
        participacion: reg?.participacion ?? null,
        observacion_part: reg?.observacion_part?.trim() || null,
        obs_trabajo: reg?.obs_trabajo?.trim() || null,
        trabajo_id: perfil?.ultimo_trabajo?.id ?? null,
      }
    })
    startTransition(async () => {
      const res = await registrarAsistenciaMasiva(cursoId, fecha, inputs)
      if (res.error) { setError(res.error); return }
      if (bitacora.tema.trim()) {
        const bRes = await guardarBitacoraData(cursoId, { ...bitacora, fecha })
        if (bRes.error) { setError(bRes.error); return }
      }
      router.push(`/dashboard/cursos/${cursoId}`)
    })
  }

  // ── PASO 1: Bitácora ──────────────────────────────────────────────────────
  if (paso === 'bitacora') {
    return (
      <div className="space-y-4">
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Bitácora de la clase</h2>
            <span className="text-xs text-gray-500">Paso 1 de 3</span>
          </div>
          <div>
            <label className="label">Tema de la clase *</label>
            <input className="input" placeholder="Introducción a..." value={bitacora.tema}
              onChange={e => setBitacora(p => ({ ...p, tema: e.target.value }))} />
          </div>
          <div>
            <label className="label">Actividades realizadas</label>
            <textarea className="input h-20 resize-none" placeholder="Ejercicio práctico, trabajo grupal..."
              value={bitacora.actividades} onChange={e => setBitacora(p => ({ ...p, actividades: e.target.value }))} />
          </div>
          <div>
            <label className="label">Materiales utilizados</label>
            <input className="input" placeholder="Diapositivas Cap. 3, dataset..." value={bitacora.materiales}
              onChange={e => setBitacora(p => ({ ...p, materiales: e.target.value }))} />
          </div>
          <div>
            <label className="label">Observaciones generales</label>
            <textarea className="input h-16 resize-none" placeholder="Grupo participativo..."
              value={bitacora.observaciones} onChange={e => setBitacora(p => ({ ...p, observaciones: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setPaso('lista')} className="btn-ghost flex-1 text-sm">Omitir bitácora</button>
          <button onClick={() => setPaso('lista')} disabled={!bitacora.tema.trim()}
            className="btn-primary flex-1 disabled:opacity-40">
            Continuar al pase de lista →
          </button>
        </div>
      </div>
    )
  }

  // ── PASO 3: Resumen ───────────────────────────────────────────────────────
  if (paso === 'resumen') {
    const presentes   = Object.values(registros).filter(r => r.estado === 'Presente').length
    const ausentes    = Object.values(registros).filter(r => r.estado === 'Ausente').length
    const atrasos     = Object.values(registros).filter(r => r.estado === 'Atraso').length
    const sinRegistro = total - completados
    const conParticipacion = Object.values(registros).filter(r => r.participacion != null).length

    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Resumen de la sesión</h2>
            <span className="text-xs text-gray-500">Paso 3 de 3</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Presentes',    value: presentes,   color: 'text-emerald-400' },
              { label: 'Atrasos',      value: atrasos,     color: 'text-yellow-400' },
              { label: 'Ausentes',     value: ausentes,    color: 'text-red-400' },
              { label: 'Sin registro', value: sinRegistro, color: 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
          {conParticipacion > 0 && (
            <div className="text-sm text-gray-400 mb-3">
              <span className="text-brand-400 font-medium">{conParticipacion}</span> participación(es) registrada(s)
            </div>
          )}
          {bitacora.tema.trim() && (
            <div className="border border-gray-700 rounded-lg px-3 py-2 text-sm">
              <p className="text-xs text-gray-500 mb-0.5">Bitácora</p>
              <p className="text-gray-300 font-medium">{bitacora.tema}</p>
            </div>
          )}
        </div>
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setPaso('lista'); setIndice(total - 1) }} className="btn-ghost flex-1">← Revisar</button>
          <button onClick={guardar} disabled={isPending} className="btn-primary flex-1">
            {isPending ? 'Guardando...' : 'Guardar sesión'}
          </button>
        </div>
      </div>
    )
  }

  // ── PASO 2: Lista ─────────────────────────────────────────────────────────
  const regActual = registros[actual.id]
  const puedeParticipacion = regActual?.estado !== 'Ausente'

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <button onClick={() => setPaso('bitacora')} className="text-xs text-gray-500 hover:text-gray-300">← Bitácora</button>
        <span className="text-xs text-gray-500">Paso 2 de 3</span>
      </div>

      {(isLoadingFecha || existingRecords != null) && (
        <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-gray-300">
          {isLoadingFecha ? (
            <span>Cargando asistencia para {fecha}...</span>
          ) : existingRecords && existingRecords > 0 ? (
            <span>{existingRecords} registro(s) existente(s) cargados para {fecha}. Puedes editar y guardar.</span>
          ) : (
            <span>No se encontraron registros para {fecha}. Completa la asistencia y guarda.</span>
          )}
        </div>
      )}

      {/* Barra de progreso */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
          <div className="bg-brand-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(completados / total) * 100}%` }} />
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">{completados}/{total}</span>
      </div>

      {/* Dots de navegación */}
      <div className="flex gap-1 flex-wrap justify-center">
        {estudiantes.map((est, i) => {
          const reg = registros[est.id]
          return (
            <button key={est.id} onClick={() => setIndice(i)} title={est.nombre}
              className={`w-3 h-3 rounded-full transition-all ${
                i === indice     ? 'scale-150 bg-brand-500' :
                !reg             ? 'bg-gray-700' :
                reg.estado === 'Presente' ? 'bg-emerald-600' :
                reg.estado === 'Atraso'   ? 'bg-yellow-600' : 'bg-red-600'
              }`} />
          )
        })}
      </div>

      {/* Tarjeta del estudiante */}
      <div className="card space-y-4">
        {/* Info básica */}
        <div className="text-center pt-4">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-3xl font-bold text-gray-400 mx-auto mb-3">
            {actual.nombre.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-white mb-0.5">{actual.nombre}</h2>
          <p className="text-gray-500 text-sm">{actual.email}</p>
          
          <div className="mt-3 flex justify-center">
            {perfiles[actual.id]?.encuesta ? (
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-brand-900/40 text-brand-400 border border-brand-800 rounded-full hover:bg-brand-900/60 transition-colors"
                title="Ver encuesta y ficha del estudiante"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Ver Perfil
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-gray-900 text-gray-500 border border-gray-800 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Sin Perfil
              </span>
            )}
          </div>

          {actual.tutoria && (
            <div className="mt-2 inline-block px-3 py-1 bg-blue-900/40 border border-blue-700 rounded-lg text-blue-300 text-xs font-medium">
              Citado a tutoría
            </div>
          )}
        </div>

        {/* Stats del perfil */}
        {(() => {
          const p = perfiles[actual.id]
          const stats = [
            p?.pct_asistencia != null
              ? { label: 'Asistencia', value: `${p.pct_asistencia}%`, color: p.pct_asistencia >= 80 ? 'text-emerald-400' : p.pct_asistencia >= 60 ? 'text-yellow-400' : 'text-red-400' }
              : null,
            p?.promedio != null && p.promedio > 0
              ? { label: 'Promedio', value: String(p.promedio), color: p.promedio >= 7 ? 'text-emerald-400' : p.promedio >= 5 ? 'text-yellow-400' : 'text-red-400' }
              : null,
          ].filter(Boolean)
          return stats.length > 0 ? (
            <div className="flex justify-center gap-8 py-2 border-y border-gray-800 text-xs">
              {stats.map(s => s && (
                <div key={s.label} className="text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-600">{s.label}</p>
                </div>
              ))}
            </div>
          ) : null
        })()}

        {/* Último trabajo */}
        {(() => {
          const t = perfiles[actual.id]?.ultimo_trabajo
          if (!t) return null
          const c = t.estado === 'Pendiente' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
            : t.estado === 'En progreso'     ? 'text-blue-400 bg-blue-900/30 border-blue-800'
            : t.estado === 'Entregado'       ? 'text-purple-400 bg-purple-900/30 border-purple-800'
            : t.estado === 'Aprobado'        ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
            :                                  'text-red-400 bg-red-900/30 border-red-800'
          return (
            <div className="px-1">
              <p className="text-xs text-gray-500 mb-1">Trabajo</p>
              <button 
                onClick={() => setSelectedTrabajo({ ...t, estudiante_id: actual.id } as Trabajo)}
                className="w-full flex items-center justify-between gap-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-800/60 border border-transparent hover:border-gray-700/60 transition-colors text-left"
                title="Editar este trabajo"
              >
                <p className="text-xs text-gray-300 truncate"><span className="font-medium">{t.tipo}</span>{t.tema ? ` · ${t.tema}` : ''}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${c}`}>{t.estado}</span>
              </button>
            </div>
          )
        })()}

        {/* Última observación de clase */}
        {perfiles[actual.id]?.ultima_obs_clase && (
          <div className="px-1 border-l-2 border-blue-800">
            <p className="text-xs text-gray-500 mb-0.5">
              Última obs. de clase <span className="text-gray-600">({new Date(perfiles[actual.id].ultima_obs_clase!.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})</span>
            </p>
            <p className="text-xs text-gray-400 italic line-clamp-2">&ldquo;{perfiles[actual.id].ultima_obs_clase!.observacion}&rdquo;</p>
          </div>
        )}

        {/* Última observación del trabajo */}
        {perfiles[actual.id]?.ultima_observacion && (
          <div className="px-1 border-l-2 border-gray-700">
            <p className="text-xs text-gray-500 mb-0.5">Última obs. del trabajo</p>
            <p className="text-xs text-gray-400 italic line-clamp-2">&ldquo;{perfiles[actual.id].ultima_observacion}&rdquo;</p>
          </div>
        )}

        {/* Observación de avance del trabajo */}
        {perfiles[actual.id]?.ultimo_trabajo && (
          <div className="px-1">
            <label className="text-xs text-gray-500 block mb-1">
              Observación de avance <span className="text-gray-600">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Avanzó en la investigación, falta conclusión..."
              value={registros[actual.id]?.obs_trabajo ?? ''}
              onChange={e => setObsTrabajo(e.target.value)}
              maxLength={300}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}

        {/* ── Asignar tutoría ── */}
        {horariosTutoria.length > 0 && (
          <div className="px-1 border-t border-gray-800 pt-3">
            <button
              onClick={() => {
                const isOpen = tutOpen === actual.id
                setTutOpen(isOpen ? null : actual.id)
                setTutMsg(null)
                if (!isOpen) { setTutHor(''); setTutNota(''); setTutDate(todayStr()) }
              }}
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${tutOpen === actual.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Asignar tutoría
            </button>

            {tutOpen === actual.id && (
              <div className="mt-2 space-y-2">
                {tutMsg && (
                  <p className={`text-[11px] ${tutMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{tutMsg}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Horario</label>
                    <select
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      value={tutHor}
                      onChange={e => setTutHor(e.target.value)}
                    >
                      <option value="">— Seleccionar —</option>
                      {horariosTutoria.map(h => (
                        <option key={h.id} value={String(h.id)}>
                          {h.dia_semana} {fmt(h.hora_inicio)}–{fmt(h.hora_fin)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Fecha</label>
                    <input
                      type="date"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      value={tutDate}
                      min={todayStr()}
                      onChange={e => setTutDate(e.target.value)}
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Nota (opcional)"
                  value={tutNota}
                  maxLength={200}
                  onChange={e => setTutNota(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  onClick={() => asignarTutoria(actual)}
                  disabled={!tutHor || !tutDate || tutSaving || !actual.auth_user_id}
                  className="w-full py-1.5 text-xs rounded-lg bg-brand-700/40 border border-brand-700 text-brand-300 hover:bg-brand-700/60 disabled:opacity-40 transition-colors"
                >
                  {tutSaving ? 'Asignando...' : 'Confirmar tutoría'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Botones de asistencia ── */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
          {([
            { estado: 'Presente' as EstadoAsistencia, emoji: '✓', color: 'bg-emerald-900/40 border-emerald-800 hover:bg-emerald-900/70 text-emerald-400', active: 'ring-2 ring-emerald-500' },
            { estado: 'Atraso'   as EstadoAsistencia, emoji: '⏰', color: 'bg-yellow-900/40 border-yellow-800 hover:bg-yellow-900/70 text-yellow-400',   active: 'ring-2 ring-yellow-500' },
            { estado: 'Ausente'  as EstadoAsistencia, emoji: '✗', color: 'bg-red-900/40 border-red-800 hover:bg-red-900/70 text-red-400',             active: 'ring-2 ring-red-500' },
          ] as const).map(b => (
            <button key={b.estado} onClick={() => marcarAsistencia(b.estado)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all font-medium text-sm ${b.color} ${regActual?.estado === b.estado ? b.active : ''}`}>
              <span className="text-xl">{b.emoji}</span>
              {b.estado}
            </button>
          ))}
        </div>

        {/* ── Participación y observación (aparece al marcar Presente o Atraso) ── */}
        {puedeParticipacion && (
          <div className="border-t border-gray-800 pt-3 space-y-2">
            <p className="text-xs text-gray-400 font-medium">
              Participación <span className="text-gray-600">(opcional)</span>
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setParticipacion(n)}
                  title={ETIQUETAS[n]}
                  className={`flex-1 py-2 rounded-lg text-white text-sm font-bold transition-all ${
                    regActual?.participacion === n ? COLORES_BTN[n] : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            {regActual?.participacion != null && (
              <p className={`text-xs font-medium ${COLORES_TEXT[regActual.participacion]}`}>
                {ETIQUETAS[regActual.participacion]}
              </p>
            )}
            <input
              type="text"
              placeholder="Observación de participación (opcional)"
              value={regActual?.observacion_part ?? ''}
              onChange={e => setObservacion(e.target.value)}
              maxLength={200}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="flex gap-3">
        <button onClick={() => setIndice(i => Math.max(0, i - 1))} disabled={indice === 0}
          className="btn-ghost flex-1 disabled:opacity-30">← Anterior</button>
        <button onClick={siguiente} className="btn-primary flex-1">
          {indice === total - 1 ? 'Finalizar →' : 'Siguiente →'}
        </button>
      </div>

      {/* Panel de Edición de Trabajo Integrado */}
      {selectedTrabajo && (
        <TrabajoEditPanel
          cursoId={cursoId}
          estudianteNombre={actual.nombre}
          estudianteId={actual.id}
          trabajo={selectedTrabajo}
          onClose={() => setSelectedTrabajo(null)}
          onSaved={() => {
            router.refresh()
          }}
        />
      )}
      {/* Panel de Perfil del Estudiante */}
      {isProfileOpen && (
        <StudentProfilePanel
          estudianteNombre={actual.nombre}
          encuesta={perfiles[actual.id]?.encuesta}
          onClose={() => setIsProfileOpen(false)}
        />
      )}
    </div>
  )
}
