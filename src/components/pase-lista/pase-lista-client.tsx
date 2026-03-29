'use client'

import { useState, useTransition } from 'react'
import { registrarAsistenciaMasiva, type RegistroAsistenciaInput } from '@/lib/actions/asistencia'
import { guardarBitacoraData } from '@/lib/actions/bitacora'
import { useRouter } from 'next/navigation'
import type { EstudiantePerfil } from '@/app/dashboard/cursos/[cursoId]/pase-lista/page'

type EstadoAsistencia = 'Presente' | 'Ausente' | 'Atraso'
type Paso = 'bitacora' | 'lista' | 'resumen'

interface Estudiante {
  id: string
  nombre: string
  email: string
  tutoria: boolean
}

interface RegistroLocal {
  estado: EstadoAsistencia
  atraso: boolean
  horas: number
  participacion: number | null
  observacion_part: string
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

export function PaseListaClient({ cursoId, estudiantes, fecha, horasSesion, perfiles }: Props) {
  const [paso, setPaso] = useState<Paso>('bitacora')
  const [bitacora, setBitacora] = useState<BitacoraLocal>({ tema: '', actividades: '', materiales: '', observaciones: '' })
  const [indice, setIndice] = useState(0)
  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
        horas: estado === 'Ausente' ? 0 : horas,
        participacion: prev[actual.id]?.participacion ?? null,
        observacion_part: prev[actual.id]?.observacion_part ?? '',
      },
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

  function siguiente() {
    if (indice < total - 1) setIndice(i => i + 1)
    else setPaso('resumen')
  }

  function guardar() {
    setError(null)
    const inputs: RegistroAsistenciaInput[] = estudiantes.map(est => {
      const reg = registros[est.id]
      return {
        estudiante_id: est.id,
        estado: reg?.estado ?? 'Ausente',
        atraso: reg?.atraso ?? false,
        horas: reg?.horas ?? 0,
        participacion: reg?.participacion ?? null,
        observacion_part: reg?.observacion_part?.trim() || null,
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
  const puedeParticipacion = regActual?.estado === 'Presente' || regActual?.estado === 'Atraso'

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <button onClick={() => setPaso('bitacora')} className="text-xs text-gray-500 hover:text-gray-300">← Bitácora</button>
        <span className="text-xs text-gray-500">Paso 2 de 3</span>
      </div>

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
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-300 truncate"><span className="font-medium">{t.tipo}</span>{t.tema ? ` · ${t.tema}` : ''}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${c}`}>{t.estado}</span>
              </div>
            </div>
          )
        })()}

        {/* Última observación */}
        {perfiles[actual.id]?.ultima_observacion && (
          <div className="px-1 border-l-2 border-gray-700">
            <p className="text-xs text-gray-500 mb-0.5">Última observación</p>
            <p className="text-xs text-gray-400 italic line-clamp-2">&ldquo;{perfiles[actual.id].ultima_observacion}&rdquo;</p>
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

        {/* ── Participación (aparece al marcar Presente o Atraso) ── */}
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
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium flex-shrink-0 ${COLORES_TEXT[regActual.participacion]}`}>
                  {ETIQUETAS[regActual.participacion]}
                </span>
                <input
                  type="text"
                  placeholder="Observación (opcional)"
                  value={regActual.observacion_part ?? ''}
                  onChange={e => setObservacion(e.target.value)}
                  maxLength={200}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}
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
    </div>
  )
}
