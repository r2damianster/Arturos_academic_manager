'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImprimirPlanButtonProps {
  /** Imprime un solo plan */
  bitacoraId?: string
  /** Imprime todos los planes de un día (YYYY-MM-DD). Se ignora si hay `bitacoraId`. */
  fecha?: string
  label?: string
  size?: 'xs' | 'sm'
}

function PrinterIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

/**
 * Botón que abre el plan de clase en una ventana emergente (modal con vista previa).
 * Desde ahí se imprime o se guarda como PDF con el diálogo de impresión del navegador.
 */
export function ImprimirPlanButton({ bitacoraId, fecha, label = 'Imprimir', size = 'xs' }: ImprimirPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const previewFrameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => setIsMounted(true), [])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const query = bitacoraId ? `id=${bitacoraId}` : `fecha=${fecha ?? ''}`
  const previewUrl = `/imprimir/plan?${query}&embed=1`

  function handlePrint() {
    const previewWindow = previewFrameRef.current?.contentWindow
    previewWindow?.focus()
    previewWindow?.print()
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-1.5 gap-1.5' : 'text-[10px] px-1.5 py-0.5 gap-1'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'

  return (
    <>
      <button
        type="button"
        onClick={clickEvent => { clickEvent.stopPropagation(); setIsOpen(true) }}
        className={`inline-flex items-center rounded border border-sky-500/50 bg-sky-500/10 text-sky-300 font-medium hover:bg-sky-500/20 hover:text-sky-200 transition-colors whitespace-nowrap ${sizeClasses}`}
        title="Ver plan para imprimir o guardar como PDF"
      >
        <PrinterIcon className={iconSize} />
        {label}
      </button>

      {isOpen && isMounted && createPortal(
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
          onClick={clickEvent => { clickEvent.stopPropagation(); if (clickEvent.target === clickEvent.currentTarget) setIsOpen(false) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">Plan de clase</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white text-xl leading-none px-2"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe
              ref={previewFrameRef}
              src={previewUrl}
              title="Vista previa del plan de clase"
              className="flex-1 w-full bg-white rounded-b-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
