'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { citarEstudiante } from '@/lib/actions/citaciones'

interface Props {
  estudianteId: string
  cursoId: string
  currentTutoria: boolean | null
}

export function CitarTutoriaButton({ estudianteId, cursoId, currentTutoria }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const razon = formData.get('razon') as string
    const detalleRazon = formData.get('detalle_razon') as string

    startTransition(async () => {
      const result = await citarEstudiante({ cursoId, estudianteId, razon, detalleRazon })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  // Si ya está citado, mostramos el botón pero como un link a la página de citaciones (o simplemente un botón visual).
  if (currentTutoria) {
    return (
      <Link href={`/dashboard/cursos/${cursoId}/citaciones`} className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-700 text-white hover:bg-teal-600 inline-block text-center whitespace-nowrap">
        Citado ✓
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 inline-block text-center whitespace-nowrap"
      >
        Citar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">Citar a Tutoría</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Razón de la citación</label>
                <select 
                  name="razon" 
                  required 
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
                >
                  <option value="">Selecciona una razón...</option>
                  <option value="inasistencia">Inasistencia</option>
                  <option value="bajo_desempeño">Bajo Desempeño</option>
                  <option value="asignacion_trabajo">Asignación de Trabajo</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Detalle (Opcional)</label>
                <textarea 
                  name="detalle_razon" 
                  rows={3} 
                  placeholder="Observaciones adicionales..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm resize-none"
                ></textarea>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-medium text-sm disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition font-medium text-sm disabled:opacity-50"
                >
                  {isPending ? 'Citando...' : 'Confirmar Citación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
