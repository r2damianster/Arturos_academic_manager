'use client'

import { useState, useTransition } from 'react'
import { citarEstudiante } from '@/lib/actions/citaciones'
import { silenciarAlerta, restaurarAlerta, excluirEstudianteDeRiesgo } from '@/lib/actions/cursos'
import { describirNotaBaja, type NotaBaja } from '@/lib/riesgo-notas'
import {
  construirEnlacesCorreo,
  redactarCorreoBloque,
  redactarCorreoIndividual,
} from '@/lib/correo-citacion'

export interface EstudianteEnRiesgo {
  id: string
  nombre: string
  email: string
  pctAsistencia: number | null
  trabajosActivos: number
  participacionPromedio: number | null
  notasEnCursoPct: number | null
  notasBajas: NotaBaja[]
  factoresRiesgo: number
}

interface Props {
  cursoId: string
  estudiantes: EstudianteEnRiesgo[]
  silenciado?: boolean
  asignatura: string
  nombreProfesor: string
  /** Va en "Para" del correo en bloque: con "Para" vacío algunos clientes ignoran la copia oculta. */
  emailProfesor: string
  horariosTutoria: string[]
}

function razonYDetalle(e: EstudianteEnRiesgo): { razon: string; detalleRazon: string } {
  const factores: string[] = e.notasBajas.map(describirNotaBaja)
  if (e.pctAsistencia !== null && e.pctAsistencia < 75)
    factores.push(`asistencia de ${e.pctAsistencia}%`)
  if (e.participacionPromedio !== null && e.participacionPromedio < 2.5)
    factores.push(`participación promedio de ${e.participacionPromedio}/5`)
  if (e.notasEnCursoPct !== null && e.notasEnCursoPct < 50)
    factores.push(`${e.notasEnCursoPct}% de actividades en curso calificadas`)
  if (e.trabajosActivos >= 3)
    factores.push(`${e.trabajosActivos} trabajos activos sin completar`)

  return {
    razon: e.notasBajas.length > 0 ? 'bajo_desempeño' : 'Seguimiento académico',
    detalleRazon: `Se detectaron los siguientes indicadores de atención: ${factores.join(', ')}. Se recomienda conversar sobre estrategias de mejora.`,
  }
}

type Estado = 'idle' | 'loading' | 'done' | 'error'

export function RiesgoPanel({ cursoId, estudiantes, silenciado = false, asignatura, nombreProfesor, emailProfesor, horariosTutoria }: Props) {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [citados,   setCitados]   = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [registrados, setRegistrados] = useState<Set<string>>(new Set())
  // Correo abierto pero aún sin confirmar que se envió: todavía NO es una citación
  const [correoAbierto, setCorreoAbierto] = useState<Set<string>>(new Set())
  const [bloqueAbierto, setBloqueAbierto] = useState(false)
  const [silPending, startSil]    = useTransition()
  const [excPending, startExc]    = useTransition()

  // ── Strip cuando panel completo está silenciado ───────────────────────────
  if (silenciado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/40 text-xs text-gray-500">
        <span>⚠ Panel de riesgo silenciado</span>
        <span className="text-gray-700">·</span>
        <button
          type="button"
          disabled={silPending}
          onClick={() => startSil(() => { restaurarAlerta(cursoId, 'riesgo').then(() => {}) })}
          className="text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Mostrar de nuevo →
        </button>
      </div>
    )
  }

  // ── Sin estudiantes en riesgo (luego de filtrar excluidos) ────────────────
  if (estudiantes.length === 0) return null

  const maxFactores = Math.max(...estudiantes.map(e => e.factoresRiesgo))
  const esCritico = maxFactores >= 3
  const panelClasses = esCritico
    ? 'border border-red-700/40 bg-red-900/10 rounded-xl overflow-hidden'
    : 'border border-amber-700/40 bg-amber-900/10 rounded-xl overflow-hidden'
  const headerTextClass = esCritico ? 'text-red-300' : 'text-amber-300'
  const headerHoverClass = esCritico ? 'hover:bg-red-900/20' : 'hover:bg-amber-900/20'
  const arrowClass = esCritico ? 'text-red-600' : 'text-amber-600'
  const borderTopClass = esCritico ? 'border-t border-red-800/40' : 'border-t border-amber-800/40'
  const btnClass = esCritico
    ? 'w-full text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2'
    : 'w-full text-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2'

  const factoresDetectados: string[] = []
  if (estudiantes.some(e => e.pctAsistencia !== null && e.pctAsistencia < 75))           factoresDetectados.push('asistencia')
  if (estudiantes.some(e => e.participacionPromedio !== null && e.participacionPromedio < 2.5)) factoresDetectados.push('participación')
  if (estudiantes.some(e => e.notasEnCursoPct !== null && e.notasEnCursoPct < 50))       factoresDetectados.push('notas en curso')
  if (estudiantes.some(e => e.trabajosActivos >= 3))                                      factoresDetectados.push('trabajos')

  async function handleCitarTodos() {
    setEstado('loading')
    setCitados(0)
    let ok = 0
    for (const est of estudiantes.filter(e => !registrados.has(e.id))) {
      const { razon, detalleRazon } = razonYDetalle(est)
      const result = await citarEstudiante({ cursoId, estudianteId: est.id, razon, detalleRazon })
      if (!result.error) ok++
      setCitados(ok)
    }
    setEstado(ok > 0 ? 'done' : 'error')
  }

  const marcarCorreoAbierto = (ids: string[]) =>
    setCorreoAbierto(previos => new Set([...previos, ...ids]))
  const descartarCorreoAbierto = (ids: string[]) =>
    setCorreoAbierto(previos => new Set([...previos].filter(id => !ids.includes(id))))

  /** Solo se llama cuando el profesor confirma que el correo se envió. */
  function confirmarEnvio(destinatarios: EstudianteEnRiesgo[]) {
    registrarCitaciones(destinatarios)
    descartarCorreoAbierto(destinatarios.map(est => est.id))
    setBloqueAbierto(false)
  }

  /** Registra la citación una sola vez por estudiante. */
  function registrarCitaciones(destinatarios: EstudianteEnRiesgo[]) {
    const pendientes = destinatarios.filter(est => !registrados.has(est.id))
    if (pendientes.length === 0) return
    setRegistrados(previos => new Set([...previos, ...pendientes.map(est => est.id)]))
    for (const est of pendientes) {
      const { razon, detalleRazon } = razonYDetalle(est)
      void citarEstudiante({ cursoId, estudianteId: est.id, razon, detalleRazon })
    }
  }

  const enlaceIndividual = (est: EstudianteEnRiesgo) => {
    const motivos = est.notasBajas.length > 0
      ? est.notasBajas.map(describirNotaBaja)
      : [razonYDetalle(est).detalleRazon]
    return construirEnlacesCorreo({
      para: [est.email],
      correo: redactarCorreoIndividual({
        nombreEstudiante: est.nombre, asignatura, nombreProfesor, motivos, horarios: horariosTutoria,
      }),
    })
  }

  const conCorreo = estudiantes.filter(est => est.email)
  const enlacesBloque = construirEnlacesCorreo({
    para: [emailProfesor],
    cco: conCorreo.map(est => est.email),
    correo: redactarCorreoBloque({
      asignatura, nombreProfesor, horarios: horariosTutoria,
      correosDestinatarios: conCorreo.map(est => est.email),
    }),
  })
  const [correosCopiados, setCorreosCopiados] = useState(false)
  async function copiarCorreos() {
    try {
      await navigator.clipboard.writeText(conCorreo.map(est => est.email).join(', '))
      setCorreosCopiados(true)
      setTimeout(() => setCorreosCopiados(false), 2500)
    } catch {
      window.prompt('Copia los correos:', conCorreo.map(est => est.email).join(', '))
    }
  }
  const claseEnlace = 'text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors'

  return (
    <div className={panelClasses}>
      <div className={`w-full flex items-center justify-between px-4 py-3 text-sm ${headerTextClass}`}>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className={`flex-1 flex items-center gap-2 font-medium text-left ${headerHoverClass} transition-colors rounded-l`}
        >
          <span>⚠</span>
          {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} en riesgo
          {factoresDetectados.length > 0 && (
            <span className={`${arrowClass} font-normal text-xs`}>
              ({factoresDetectados.join(' · ')})
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={silPending}
            onClick={() => startSil(() => { silenciarAlerta(cursoId, 'riesgo').then(() => {}) })}
            className={`text-xs ${arrowClass} hover:opacity-70 transition-opacity disabled:opacity-30`}
            title="Silenciar este panel"
          >
            Silenciar
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className={`${arrowClass} text-xs px-1`}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={`px-4 pb-4 space-y-3 ${borderTopClass}`}>
          <div className="mt-3 space-y-2">
            {estudiantes.map(est => (
              <div key={est.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={excPending}
                    onClick={() => startExc(() => { excluirEstudianteDeRiesgo(cursoId, est.id).then(() => {}) })}
                    className="text-gray-600 hover:text-gray-400 transition-colors text-base leading-none flex-shrink-0 disabled:opacity-30"
                    title="Ocultar este estudiante del panel"
                  >
                    ×
                  </button>
                  <div className="min-w-0">
                    <span className="text-sm text-gray-200 truncate block">{est.nombre}</span>
                    {est.factoresRiesgo >= 3 && (
                      <span className="text-xs text-red-400 font-medium">{est.factoresRiesgo} factores</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                  {est.pctAsistencia !== null && est.pctAsistencia < 75 && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      est.pctAsistencia < 60
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-amber-900/40 text-amber-400'
                    }`}>
                      asist. {est.pctAsistencia}%
                    </span>
                  )}
                  {est.participacionPromedio !== null && est.participacionPromedio < 2.5 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">
                      part. {est.participacionPromedio}/5
                    </span>
                  )}
                  {est.notasEnCursoPct !== null && est.notasEnCursoPct < 50 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400">
                      notas {est.notasEnCursoPct}%
                    </span>
                  )}
                  {est.trabajosActivos >= 3 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
                      {est.trabajosActivos} trabajos
                    </span>
                  )}
                  {est.notasBajas.map(notaBaja => (
                    <span
                      key={`${notaBaja.parcial}|${notaBaja.columna}`}
                      title={describirNotaBaja(notaBaja)}
                      className="text-xs font-mono px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300"
                    >
                      {notaBaja.columna.length > 22 ? `${notaBaja.columna.slice(0, 22)}…` : notaBaja.columna} {notaBaja.nota}/{notaBaja.max}
                    </span>
                  ))}
                  {est.email ? (
                    <span className="flex items-center gap-1 ml-1">
                      {registrados.has(est.id) && <span className="text-xs text-emerald-400">✓</span>}
                      {correoAbierto.has(est.id) ? (
                        <>
                          <span className="text-xs text-amber-300">¿Enviaste el correo?</span>
                          <button type="button" onClick={() => confirmarEnvio([est])} className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">Sí, citar</button>
                          <button type="button" onClick={() => descartarCorreoAbierto([est.id])} className={claseEnlace}>No</button>
                        </>
                      ) : (() => {
                        const enlaces = enlaceIndividual(est)
                        return (
                          <>
                            <a href={enlaces.gmail} target="_blank" rel="noopener noreferrer" onClick={() => marcarCorreoAbierto([est.id])} className={claseEnlace} title="Redactar en Gmail">✉ Gmail</a>
                            <a href={enlaces.outlook} target="_blank" rel="noopener noreferrer" onClick={() => marcarCorreoAbierto([est.id])} className={claseEnlace} title="Redactar en Outlook">Outlook</a>
                            <a href={enlaces.mailto} onClick={() => marcarCorreoAbierto([est.id])} className={claseEnlace} title="Abrir la app de correo">App</a>
                          </>
                        )
                      })()}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 ml-1">sin correo</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {conCorreo.length > 1 && (
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 px-3 py-2 space-y-2">
              <p className="text-xs text-gray-400">
                Correo en bloque a {conCorreo.length} estudiantes (con copia oculta: no ven los correos de los demás). La citación se registra solo cuando confirmes el envío.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={enlacesBloque.gmail} target="_blank" rel="noopener noreferrer" onClick={() => setBloqueAbierto(true)} className={claseEnlace}>✉ Gmail</a>
                <a href={enlacesBloque.outlook} target="_blank" rel="noopener noreferrer" onClick={() => setBloqueAbierto(true)} className={claseEnlace}>Outlook</a>
                <a href={enlacesBloque.mailto} onClick={() => setBloqueAbierto(true)} className={claseEnlace}>App de correo</a>
                <button type="button" onClick={copiarCorreos} className={claseEnlace} title="Copia los correos para pegarlos en CCO">
                  {correosCopiados ? '✓ Copiados' : 'Copiar correos'}
                </button>
              </div>
              {bloqueAbierto && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-700/60">
                  <span className="text-xs text-amber-300">¿Enviaste el correo a los {conCorreo.length}?</span>
                  <button type="button" onClick={() => confirmarEnvio(conCorreo)} className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">Sí, registrar las {conCorreo.length} citaciones</button>
                  <button type="button" onClick={() => setBloqueAbierto(false)} className={claseEnlace}>No</button>
                </div>
              )}
            </div>
          )}

          {estado === 'done' ? (
            <p className="text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
              ✓ {citados} {citados === 1 ? 'citación registrada' : 'citaciones registradas'}
            </p>
          ) : estado === 'error' ? (
            <p className="text-sm text-red-400">Error al registrar citaciones. Intente de nuevo.</p>
          ) : (
            <button
              onClick={handleCitarTodos}
              disabled={estado === 'loading'}
              className={btnClass}
            >
              {estado === 'loading' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Citando… {citados}/{estudiantes.length}
                </>
              ) : (
                `Citar a ${estudiantes.length === 1 ? 'este estudiante' : `estos ${estudiantes.length} estudiantes`} a tutoría`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
