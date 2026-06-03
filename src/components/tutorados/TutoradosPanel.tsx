'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type TutoradoItem, type SesionItem, reactivarTutorado } from '@/lib/actions/tutorados'
import { getSesionesTutorado } from '@/lib/actions/tutorados'
import { RegistrarSesionModal } from './RegistrarSesionModal'
import { EditarPerfilTutorado } from './EditarPerfilTutorado'
import { SesionesTimeline } from './SesionesTimeline'
import { FinalizarTutoradoModal } from './FinalizarTutoradoModal'

const MODAL_EMOJI: Record<string, string> = {
  presencial: '🏫', virtual: '💻', whatsapp: '💬', telefono: '📞', otro: '📝',
}
const MOD_TRABAJO_LABEL: Record<string, string> = {
  maestria: 'Maestría', pregrado: 'Pregrado', articulo: 'Artículo', otro: 'Otro',
}
const RESULTADO_LABEL: Record<string, string> = {
  graduado: 'Graduado/a', aprobado: 'Aprobado/a', abandono: 'Abandonó', otro: 'Otro',
}
const RESULTADO_COLOR: Record<string, string> = {
  graduado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  aprobado: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  abandono: 'bg-red-500/20 text-red-300 border-red-500/30',
  otro:     'bg-gray-700 text-gray-400 border-gray-600',
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function diasDesdeFecha(fecha: string) {
  const diff = Math.floor((Date.now() - new Date(fecha + 'T12:00:00').getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff} días`
  if (diff < 30) return `Hace ${Math.floor(diff / 7)} sem`
  return `Hace ${Math.floor(diff / 30)} mes${Math.floor(diff / 30) > 1 ? 'es' : ''}`
}

function formatHora(t: string) {
  return t ? t.slice(0, 5) : ''
}

interface TutoradoCardProps {
  t: TutoradoItem
  showCurso: boolean
  historico?: boolean
}

function TutoradoCard({ t, showCurso, historico = false }: TutoradoCardProps) {
  const router = useRouter()
  const [registrando, setRegistrando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [sesiones, setSesiones] = useState<SesionItem[] | null>(null)
  const [loadingSesiones, setLoadingSesiones] = useState(false)
  const [confirmarReactivar, setConfirmarReactivar] = useState(false)
  const [reactivando, startReactivar] = useTransition()

  const p = t.perfil

  async function toggleSesiones() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (sesiones === null) {
      setLoadingSesiones(true)
      const res = await getSesionesTutorado(t.id, t.curso_id)
      setSesiones(res.data)
      setLoadingSesiones(false)
    }
  }

  function handleReactivar() {
    startReactivar(async () => {
      await reactivarTutorado(t.id, t.curso_id)
      router.refresh()
    })
  }

  const horarioStr = p?.dia_semana
    ? `${p.dia_semana.charAt(0).toUpperCase() + p.dia_semana.slice(1)} ${formatHora(p.hora_inicio ?? '')}${p.hora_fin ? '–' + formatHora(p.hora_fin) : ''}`
    : null

  return (
    <>
      <div className={`card space-y-4 ${historico ? 'opacity-75' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold truncate">{t.nombre}</h3>
              {p?.modalidad_trabajo && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {MOD_TRABAJO_LABEL[p.modalidad_trabajo] ?? p.modalidad_trabajo}
                </span>
              )}
              {historico && p?.resultado && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${RESULTADO_COLOR[p.resultado] ?? RESULTADO_COLOR.otro}`}>
                  {RESULTADO_LABEL[p.resultado] ?? p.resultado}
                </span>
              )}
              {p?.publicado && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  📄 Publicado
                </span>
              )}
              {showCurso && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                  {t.asignatura}
                </span>
              )}
            </div>
            {p?.titulo_trabajo && (
              <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{p.titulo_trabajo}</p>
            )}
            {(p?.universidad || p?.carrera_tutorado || p?.asignatura_tutorado) && (
              <p className="text-gray-500 text-xs mt-0.5">
                {[p.universidad, p.facultad, p.carrera_tutorado, p.asignatura_tutorado].filter(Boolean).join(' · ')}
              </p>
            )}
            {t.email && <p className="text-gray-600 text-xs mt-0.5">{t.email}</p>}
            {historico && p?.finalizado_at && (
              <p className="text-gray-500 text-xs mt-0.5">
                Finalizado: {new Date(p.finalizado_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="flex gap-1.5 flex-shrink-0">
            {!historico && (
              <>
                <button onClick={() => setEditando(true)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors">
                  ✏️ Perfil
                </button>
                <button onClick={() => setRegistrando(true)}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-brand-600/20 border border-brand-600/40 text-brand-300 hover:bg-brand-600/30 transition-colors">
                  + Sesión
                </button>
                <button onClick={() => setFinalizando(true)}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-emerald-700/20 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-700/30 transition-colors">
                  ✓ Finalizar
                </button>
              </>
            )}
            {historico && (
              confirmarReactivar ? (
                <div className="flex gap-1.5">
                  <button onClick={() => setConfirmarReactivar(false)}
                    className="px-2 py-1 text-xs rounded-lg border border-gray-700 text-gray-400 transition-colors">
                    No
                  </button>
                  <button onClick={handleReactivar} disabled={reactivando}
                    className="px-2 py-1 text-xs rounded-lg bg-brand-600/20 border border-brand-600/40 text-brand-300 hover:bg-brand-600/30 transition-colors disabled:opacity-50">
                    {reactivando ? '…' : 'Sí'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmarReactivar(true)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors">
                  ↻ Reactivar
                </button>
              )
            )}
          </div>
        </div>

        {/* Publicación */}
        {p?.publicado && (p?.fecha_publicacion || p?.referencia_publicacion) && (
          <div className="bg-teal-900/20 border border-teal-700/30 rounded-md px-3 py-2 space-y-0.5">
            {p.fecha_publicacion && (
              <p className="text-xs text-teal-500">
                📅 {new Date(p.fecha_publicacion + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            {p.referencia_publicacion && (
              <p className="text-xs text-teal-300">{p.referencia_publicacion}</p>
            )}
          </div>
        )}

        {/* Nota final (modo histórico) */}
        {historico && p?.nota_final && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">Nota de cierre</p>
            <p className="text-sm text-gray-300">{p.nota_final}</p>
          </div>
        )}

        {/* Progreso (solo activos) */}
        {!historico && p && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{p.etapa || 'Sin etapa definida'}</span>
              <span className="font-medium">{p.progreso_pct}%</span>
            </div>
            <ProgressBar pct={p.progreso_pct} />
          </div>
        )}

        {/* Metadatos admin */}
        {p && (p.fecha_asignacion || p.fecha_proyectada_fin || p.numero_oficio) && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {p.fecha_asignacion && (
              <span>📅 Asignado: {new Date(p.fecha_asignacion + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {p.num_periodos && p.num_periodos > 1 && (
              <span>🔁 {p.num_periodos} períodos</span>
            )}
            {p.fecha_proyectada_fin && (
              <span>🎯 Meta: {new Date(p.fecha_proyectada_fin + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {p.numero_oficio && (
              <span>📄 {p.numero_oficio}</span>
            )}
          </div>
        )}

        {/* Horario + última sesión (solo activos) */}
        {!historico && (
          <div className="flex flex-wrap gap-4 text-sm">
            {horarioStr ? (
              <span className="text-gray-400">
                {MODAL_EMOJI[p?.modalidad_sesion ?? ''] ?? '📅'} {horarioStr}
                {p?.nota_horario && <span className="text-gray-600 text-xs ml-1">({p.nota_horario})</span>}
              </span>
            ) : (
              <span className="text-gray-600 text-xs italic">Sin horario fijo</span>
            )}

            {t.ultima_sesion && (
              <span className="text-gray-500 text-xs">
                Última sesión: {diasDesdeFecha(t.ultima_sesion.fecha)}
              </span>
            )}
            {!t.ultima_sesion && (
              <span className="text-gray-600 text-xs italic">Sin sesiones aún</span>
            )}
          </div>
        )}

        {/* Próximo paso destacado (solo activos) */}
        {!historico && t.ultima_sesion?.proximo_paso && (
          <div className="bg-brand-600/10 border border-brand-600/20 rounded-md px-3 py-2">
            <p className="text-xs text-brand-400 mb-0.5">Próxima sesión →</p>
            <p className="text-sm text-brand-300">{t.ultima_sesion.proximo_paso}</p>
          </div>
        )}

        {/* Footer: sesiones toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-800">
          <button onClick={toggleSesiones}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {expanded ? '▲ Ocultar sesiones' : `▼ Ver sesiones (${t.total_sesiones})`}
          </button>
          <Link href={`/dashboard/cursos/${t.curso_id}/tutorados`}
            className="text-xs text-gray-600 hover:text-brand-400 transition-colors">
            Ver curso →
          </Link>
        </div>

        {/* Sesiones expandibles */}
        {expanded && (
          <div className="pt-2">
            {loadingSesiones
              ? <p className="text-gray-500 text-sm text-center py-4">Cargando…</p>
              : <SesionesTimeline
                  sesiones={sesiones ?? []}
                  cursoId={t.curso_id}
                  estudianteId={t.id}
                />
            }
          </div>
        )}
      </div>

      {registrando && (
        <RegistrarSesionModal
          estudianteId={t.id}
          cursoId={t.curso_id}
          estudianteNombre={t.nombre}
          onClose={() => { setRegistrando(false); setSesiones(null) }}
        />
      )}
      {editando && (
        <EditarPerfilTutorado
          tutorado={t}
          onClose={() => setEditando(false)}
        />
      )}
      {finalizando && (
        <FinalizarTutoradoModal
          estudianteId={t.id}
          cursoId={t.curso_id}
          estudianteNombre={t.nombre}
          onClose={() => setFinalizando(false)}
        />
      )}
    </>
  )
}

interface Props {
  tutorados: TutoradoItem[]
  cursoId?: string
  showCurso?: boolean
  importarHref?: string
}

export function TutoradosPanel({ tutorados, cursoId, showCurso = false, importarHref }: Props) {
  const [filtro, setFiltro] = useState('')
  const [tab, setTab] = useState<'activos' | 'historial'>('activos')

  const activos   = tutorados.filter(t => t.perfil?.estado !== 'finalizado')
  const finalizados = tutorados.filter(t => t.perfil?.estado === 'finalizado')

  const fuente = tab === 'activos' ? activos : finalizados
  const filtered = filtro
    ? fuente.filter(t =>
        t.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        t.perfil?.titulo_trabajo?.toLowerCase().includes(filtro.toLowerCase()) ||
        t.asignatura.toLowerCase().includes(filtro.toLowerCase())
      )
    : fuente

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {(['activos', 'historial'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t
                ? 'bg-gray-800 text-white border border-b-transparent border-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}>
            {t === 'activos' ? `Activos (${activos.length})` : `Historial (${finalizados.length})`}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          placeholder="Buscar tutorado o trabajo…"
          className="input flex-1 min-w-[200px] text-sm" />
        {tab === 'activos' && importarHref && (
          <Link href={importarHref}
            className="px-4 py-2 rounded-lg bg-brand-600/20 border border-brand-600/40 text-brand-300 text-sm hover:bg-brand-600/30 transition-colors whitespace-nowrap">
            + Agregar tutorado
          </Link>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          {tab === 'activos' && tutorados.length === 0
            ? 'Aún no hay tutorados en este grupo. Agrega el primer estudiante.'
            : tab === 'activos'
              ? 'Sin resultados para el filtro actual.'
              : finalizados.length === 0
                ? 'Ningún tutorado finalizado todavía.'
                : 'Sin resultados para el filtro actual.'}
        </div>
      )}

      <div className="grid gap-4">
        {filtered.map(t => (
          <TutoradoCard
            key={`${t.id}:${t.curso_id}`}
            t={t}
            showCurso={showCurso}
            historico={tab === 'historial'}
          />
        ))}
      </div>
    </div>
  )
}
