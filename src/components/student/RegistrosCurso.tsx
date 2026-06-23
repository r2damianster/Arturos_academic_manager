'use client'

import { useState } from 'react'
import { RegistroModal } from './RegistroModal'
import type { RegistroTrabajo, EnvioRegistro } from '@/lib/actions/registros-trabajo'

interface Props {
  cursoId: string
  estudianteId: string
  registros: RegistroTrabajo[]
  misEnvios: Record<string, EnvioRegistro>
}

export function RegistrosCurso({ estudianteId, registros, misEnvios }: Props) {
  const [abierto, setAbierto] = useState<RegistroTrabajo | null>(null)
  const [exitoMsg, setExitoMsg] = useState<Record<string, string>>({})

  if (registros.length === 0) return null

  function handleEnviado(registroId: string, autoAprobado: boolean) {
    setAbierto(null)
    setExitoMsg(prev => ({
      ...prev,
      [registroId]: autoAprobado
        ? '✓ Aprobado automáticamente — el trabajo ya figura como Pendiente'
        : '✓ Enviado — el profesor revisará tu registro',
    }))
  }

  return (
    <>
      <div className="space-y-2">
        {registros.map(reg => {
          const envio = misEnvios[reg.id] ?? null
          const exito = exitoMsg[reg.id]
          const yaEnvio = !!envio && envio.estado !== 'rechazado'

          return (
            <div key={reg.id} className={`rounded-xl border p-3 transition-all ${
              envio?.estado === 'aprobado'
                ? 'bg-emerald-900/10 border-emerald-800/40'
                : 'bg-amber-900/10 border-amber-800/40'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded-full">{reg.tipo}</span>
                    <span className="text-[10px] text-amber-400">📋 Registro abierto</span>
                  </div>
                  <p className="text-sm font-medium text-white leading-snug">{reg.titulo}</p>
                  {envio && (
                    <p className="text-xs text-gray-400 mt-0.5">Tu tema: <span className="text-gray-200 line-clamp-2 break-words">{envio.titulo}</span></p>
                  )}
                </div>

                {envio?.estado === 'aprobado' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 text-emerald-400 bg-emerald-900/20 border-emerald-800">
                    ✓ Aprobado
                  </span>
                )}
                {envio?.estado === 'pendiente' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 text-yellow-400 bg-yellow-900/20 border-yellow-800">
                    En revisión
                  </span>
                )}
                {envio?.estado === 'rechazado' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 text-red-400 bg-red-900/20 border-red-800">
                    ✕ Rechazado
                  </span>
                )}
              </div>

              {envio?.estado === 'rechazado' && envio.comentario_profesor && (
                <p className="text-xs text-red-300 mt-1.5 bg-red-900/10 border border-red-800/30 rounded-lg px-2 py-1">
                  💬 {envio.comentario_profesor}
                </p>
              )}
              {exito ? (
                <p className="text-xs text-emerald-400 mt-2">{exito}</p>
              ) : !yaEnvio && (
                <button
                  onClick={() => setAbierto(reg)}
                  className="mt-2 w-full text-xs py-1.5 rounded-lg font-medium transition-colors bg-amber-800/40 hover:bg-amber-800/70 text-amber-300 border border-amber-800"
                >
                  Registrar mi tema
                </button>
              )}
            </div>
          )
        })}
      </div>

      {abierto && (
        <RegistroModal
          registro={abierto}
          estudianteId={estudianteId}
          onClose={() => setAbierto(null)}
          onEnviado={(autoAprobado) => handleEnviado(abierto.id, autoAprobado)}
        />
      )}
    </>
  )
}
