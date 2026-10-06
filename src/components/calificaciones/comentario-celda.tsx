'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, X } from 'lucide-react'
import { guardarComentarioItem } from '@/lib/actions/calificaciones-items'

const LIMITE_CARACTERES = 1000

interface ComentarioCeldaProps {
  cursoId: string
  estudianteId: string
  estudianteNombre: string
  parcial: number
  nombreItem: string
  comentarioInicial: string | null
  /** Solo en columnas de rúbrica: texto generado desde el desglose, para insertarlo y editarlo. */
  borradorSugerido?: string
  onClose: () => void
}

/** Popover para registrar "qué falta" en una celda estudiante × columna. Texto pensado para pegar en Moodle. */
export function ComentarioCelda({
  cursoId, estudianteId, estudianteNombre, parcial, nombreItem, comentarioInicial, borradorSugerido, onClose,
}: ComentarioCeldaProps) {
  const [texto, setTexto] = useState(comentarioInicial ?? '')
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleGuardar = () => {
    startTransition(async () => {
      const resultado = await guardarComentarioItem({
        cursoId, estudianteId, parcial, nombreItem, comentario: texto,
      })
      if (resultado.error) {
        setErrorMensaje(resultado.error)
        return
      }
      onClose()
    })
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      setErrorMensaje('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div
      className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-72 text-left rounded-xl border border-gray-700 bg-gray-900 shadow-xl p-3"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate">{estudianteNombre}</p>
          <p className="text-[11px] text-gray-400 truncate">{nombreItem} · Parcial {parcial}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value.slice(0, LIMITE_CARACTERES))}
        placeholder="Qué falta / retroalimentación…"
        rows={5}
        autoFocus
        className="w-full text-xs rounded-lg border border-gray-600 bg-gray-800 p-2 resize-none"
      />

      <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
        <span>{texto.length}/{LIMITE_CARACTERES}</span>
        {errorMensaje && <span className="text-red-500">{errorMensaje}</span>}
      </div>

      {borradorSugerido !== undefined && (
        <button
          onClick={() =>
            setTexto(actual =>
              (actual.trim() === '' ? borradorSugerido : `${actual.trim()}\n${borradorSugerido}`).slice(0, LIMITE_CARACTERES)
            )
          }
          disabled={borradorSugerido === ''}
          title={borradorSugerido === '' ? 'Todos los criterios están completos' : 'Insertar los criterios que no llegaron al máximo'}
          className="mt-1 text-xs text-teal-300 hover:text-teal-200 disabled:opacity-40"
        >
          ✦ Generar borrador desde la rúbrica
        </button>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <button
          onClick={handleCopiar}
          disabled={texto.trim() === ''}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-40"
        >
          {copiado ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

interface FilaComentario {
  estudianteNombre: string
  comentario: string
}

interface CopiarComentariosModalProps {
  nombreItem: string
  parcial: number
  filas: FilaComentario[]
  onClose: () => void
}

/** Vista previa + copia en bloque de los comentarios de una columna: una línea por estudiante. */
export function CopiarComentariosModal({ nombreItem, parcial, filas, onClose }: CopiarComentariosModalProps) {
  const [copiado, setCopiado] = useState(false)
  const textoCompleto = filas.map(fila => `${fila.estudianteNombre}: ${fila.comentario}`).join('\n')

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* el textarea sigue seleccionable manualmente */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Comentarios de {nombreItem}</h3>
            <p className="text-xs text-gray-400">Parcial {parcial} · {filas.length} estudiante{filas.length === 1 ? '' : 's'} con comentario</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        {filas.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Esta columna aún no tiene comentarios.</p>
        ) : (
          <textarea
            readOnly
            value={textoCompleto}
            rows={12}
            className="w-full text-xs rounded-lg border border-gray-600 bg-gray-800 p-3 font-mono"
          />
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg text-gray-500 hover:bg-gray-800">
            Cerrar
          </button>
          <button
            onClick={handleCopiar}
            disabled={filas.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
          >
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar todo'}
          </button>
        </div>
      </div>
    </div>
  )
}
