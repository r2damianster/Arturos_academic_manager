'use client'

import { useState, useTransition } from 'react'
import { agregarReemplazante, eliminarReemplazante, toggleReemplazante } from '@/lib/actions/reemplazantes'
import type { Reemplazante } from '@/lib/actions/reemplazantes'

interface Props {
  reemplazantes: Reemplazante[]
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isVigente(r: Reemplazante) {
  const hoy = new Date().toISOString().slice(0, 10)
  return r.activo && r.fecha_inicio <= hoy && r.fecha_fin >= hoy
}

function isFuturo(r: Reemplazante) {
  const hoy = new Date().toISOString().slice(0, 10)
  return r.activo && r.fecha_inicio > hoy
}

export function ReemplazantesPanel({ reemplazantes }: Props) {
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [elimConfirm, setElimConfirm] = useState<string | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)

  function handleAdd(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await agregarReemplazante(formData)
      if (res.error) {
        setError(res.error)
      } else {
        setShowForm(false)
      }
    })
  }

  function handleToggle(id: string, activo: boolean) {
    startTransition(async () => {
      await toggleReemplazante(id, activo)
    })
  }

  function handleEliminar(id: string) {
    setElimConfirm(null)
    startTransition(async () => {
      await eliminarReemplazante(id)
    })
  }

  const vigentes = reemplazantes.filter(isVigente)
  const futuros = reemplazantes.filter(isFuturo)

  return (
    <div className="card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🔄</span>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Reemplazantes temporales</p>
            <p className="text-xs text-gray-500">
              {vigentes.length > 0
                ? `${vigentes.length} acceso(s) activo(s) ahora`
                : reemplazantes.length > 0
                  ? `${reemplazantes.length} reemplazante(s) registrado(s)`
                  : 'Sin reemplazantes configurados'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vigentes.length > 0 && (
            <span className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 px-2 py-1 rounded">
              Activo ahora
            </span>
          )}
          {futuros.length > 0 && (
            <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-700/30 px-2 py-1 rounded">
              {futuros.length} próximo(s)
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Info */}
          <div className="bg-blue-900/10 border border-blue-700/30 rounded-xl p-3 text-xs text-blue-300 space-y-1">
            <p className="font-medium">¿Cómo funciona el acceso de reemplazante?</p>
            <p className="text-blue-400/80">
              El reemplazante inicia sesión con su propio correo. Durante el período indicado,
              puede acceder a bitácora y planificación, pero no puede editar el curso ni exportar datos.
            </p>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Lista */}
          {reemplazantes.length > 0 && (
            <div className="space-y-2">
              {reemplazantes.map(r => {
                const vigente = isVigente(r)
                const futuro = isFuturo(r)
                const vencido = !vigente && !futuro

                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      vigente ? 'border-emerald-700/40 bg-emerald-900/10'
                      : futuro ? 'border-blue-700/30 bg-blue-900/10'
                      : 'border-gray-700/40 bg-gray-800/20 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white">{r.nombre}</p>
                        {vigente && <span className="text-xs text-emerald-400">● Activo</span>}
                        {futuro && <span className="text-xs text-blue-400">● Próximo</span>}
                        {vencido && <span className="text-xs text-gray-500">Vencido</span>}
                      </div>
                      <p className="text-xs text-gray-400">{r.email_reemplazante}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(r.fecha_inicio)} → {fmtDate(r.fecha_fin)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle activo */}
                      <button
                        onClick={() => handleToggle(r.id, !r.activo)}
                        disabled={pending}
                        className={`relative w-9 h-5 rounded-full transition-colors ${r.activo ? 'bg-brand-600' : 'bg-gray-700'}`}
                        title={r.activo ? 'Desactivar' : 'Activar'}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${r.activo ? 'translate-x-4' : ''}`} />
                      </button>
                      {/* Eliminar */}
                      {elimConfirm === r.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleEliminar(r.id)} disabled={pending}
                            className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                          <button onClick={() => setElimConfirm(null)}
                            className="text-xs text-gray-500 hover:text-gray-400">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setElimConfirm(r.id)}
                          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Formulario de agregar */}
          {showForm ? (
            <form action={handleAdd} className="space-y-3 p-4 border border-gray-700/50 rounded-xl bg-gray-800/20">
              <p className="text-sm font-medium text-white">Agregar reemplazante</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input name="nombre" className="input" placeholder="Ej. María Torres" required />
                </div>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input name="email_reemplazante" type="email" className="input" placeholder="reemplazante@email.com" required />
                </div>
                <div>
                  <label className="label">Fecha inicio</label>
                  <input name="fecha_inicio" type="date" className="input" defaultValue={hoy} required />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input name="fecha_fin" type="date" className="input" required />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                El reemplazante debe tener una cuenta registrada en el sistema con ese correo.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={pending}
                  className="btn-primary text-sm py-2 disabled:opacity-50">
                  {pending ? 'Guardando…' : 'Agregar'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                  className="px-3 py-2 border border-gray-600 text-gray-400 text-sm rounded-lg hover:border-gray-500 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 text-sm rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar reemplazante
            </button>
          )}
        </div>
      )}
    </div>
  )
}
