'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarRegistroTrabajo, revisarEnvio, type RegistroTrabajo, type EnvioRegistro } from '@/lib/actions/registros-trabajo'

type EnvioConNombre = EnvioRegistro & { estudiante: { nombre: string } | null }

interface Props {
  cursoId: string
  registros: RegistroTrabajo[]
  enviosPorRegistro: Record<string, EnvioConNombre[]>
  totalEstudiantes: number
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'text-yellow-400 bg-yellow-900/30 border-yellow-800',
  aprobado:  'text-emerald-400 bg-emerald-900/30 border-emerald-800',
}

export function EnviosRegistroPanel({ cursoId, registros, enviosPorRegistro, totalEstudiantes }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(registros.find(r => r.activo)?.id ?? null)
  const [comentarios, setComentarios] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [accionEnvio, setAccionEnvio] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  function handleRevisar(envioId: string, estado: 'aprobado' | 'rechazado') {
    setAccionEnvio(envioId)
    startTransition(async () => {
      await revisarEnvio(envioId, cursoId, estado, comentarios[envioId])
      setAccionEnvio(null)
      router.refresh()
    })
  }

  function handleCerrar(registroId: string) {
    startTransition(async () => {
      await actualizarRegistroTrabajo(registroId, cursoId, { activo: false })
      router.refresh()
    })
  }

  function handleReabrir(registroId: string) {
    startTransition(async () => {
      await actualizarRegistroTrabajo(registroId, cursoId, { activo: true })
      router.refresh()
    })
  }

  if (registros.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">Registros de trabajo</h2>

      {registros.map(reg => {
        const envios = enviosPorRegistro[reg.id] ?? []
        const pendientes = envios.filter(e => e.estado === 'pendiente').length
        const aprobados = envios.filter(e => e.estado === 'aprobado').length
        const isOpen = expanded === reg.id

        return (
          <div key={reg.id} className={`card border transition-colors ${reg.activo ? 'border-gray-700' : 'border-gray-800 opacity-70'}`}>
            {/* Header del registro */}
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => toggleExpanded(reg.id)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    reg.activo ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800' : 'text-gray-500 bg-gray-800 border-gray-700'
                  }`}>
                    {reg.activo ? '● Activo' : '○ Cerrado'}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">{reg.tipo}</span>
                  {reg.validacion_automatica && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-900/20 border border-emerald-900 px-2 py-0.5 rounded-full">Auto-aprobado</span>
                  )}
                </div>
                <p className="text-sm font-medium text-white mt-1.5">{reg.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {envios.length} de {totalEstudiantes} enviaron
                  {pendientes > 0 && <span className="text-yellow-400 ml-1.5">· {pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
                  {aprobados > 0 && <span className="text-emerald-400 ml-1.5">· {aprobados} aprobado{aprobados !== 1 ? 's' : ''}</span>}
                </p>
              </button>

              <div className="flex items-center gap-2 flex-shrink-0">
                {reg.activo ? (
                  <button
                    onClick={() => handleCerrar(reg.id)}
                    disabled={pending}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-900/10"
                  >
                    Cerrar
                  </button>
                ) : (
                  <button
                    onClick={() => handleReabrir(reg.id)}
                    disabled={pending}
                    className="text-xs text-gray-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-emerald-900/10"
                  >
                    Reabrir
                  </button>
                )}
                <button onClick={() => toggleExpanded(reg.id)} className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                  <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Criterios e instrucciones */}
            {isOpen && (reg.instrucciones || reg.criterios?.length > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                {reg.instrucciones && (
                  <p className="text-xs text-gray-400 leading-relaxed">{reg.instrucciones}</p>
                )}
                {reg.criterios?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reg.criterios.map((c, i) => (
                      <span key={i} className="text-[11px] bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded">
                        {c.texto}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lista de envíos */}
            {isOpen && (
              <div className="mt-3 space-y-2">
                {envios.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-3">Ningún estudiante ha enviado aún</p>
                ) : (
                  envios.map(envio => (
                    <div key={envio.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">{envio.estudiante?.nombre ?? '—'}</p>
                          <p className="text-sm font-medium text-white mt-0.5 leading-snug">{envio.titulo}</p>
                          {envio.descripcion && (
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed whitespace-pre-line">{envio.descripcion}</p>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${ESTADO_COLOR[envio.estado]}`}>
                          {envio.estado}
                        </span>
                      </div>

                      {envio.estado === 'pendiente' && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={comentarios[envio.id] ?? ''}
                            onChange={e => setComentarios(prev => ({ ...prev, [envio.id]: e.target.value }))}
                            placeholder="Comentario al estudiante (opcional)"
                            className="input w-full text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRevisar(envio.id, 'aprobado')}
                              disabled={pending && accionEnvio === envio.id}
                              className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                              {pending && accionEnvio === envio.id ? '...' : '✓ Aprobar'}
                            </button>
                            <button
                              onClick={() => handleRevisar(envio.id, 'rechazado')}
                              disabled={pending && accionEnvio === envio.id}
                              className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 border border-red-800 text-red-300 font-medium transition-colors disabled:opacity-50"
                            >
                              {pending && accionEnvio === envio.id ? '...' : '✕ Rechazar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {envio.comentario_profesor && (
                        <p className="text-xs text-gray-500 italic border-l-2 border-gray-700 pl-2">{envio.comentario_profesor}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
