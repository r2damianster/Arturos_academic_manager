'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCursoParaDuplicar, duplicarCurso, type EstudianteParaMatricular } from '@/lib/actions/duplicar-curso'

type Paso = 'datos' | 'matricular'

export function DuplicarCursoModal({ cursoId, codigoActual, periodoActual }: {
  cursoId: string
  codigoActual: string
  periodoActual: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [paso, setPaso] = useState<Paso>('datos')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  const [tipoCurso, setTipoCurso] = useState<string>('regular')
  const [roster, setRoster] = useState<EstudianteParaMatricular[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [nuevos, setNuevos] = useState<{ nombre: string; email: string }[]>([])

  function abrir() {
    setAbierto(true)
    setPaso('datos')
    setError(null)
    setCodigo(codigoActual)
    setPeriodo(periodoActual)
    setFechaInicio('')
    setFechaFin('')
    setNuevos([])
  }

  async function irAMatricular() {
    if (!codigo.trim() || !periodo.trim()) {
      setError('Código y periodo son requeridos')
      return
    }
    setCargando(true)
    setError(null)
    const { curso, estudiantes, error: fetchError } = await getCursoParaDuplicar(cursoId)
    setCargando(false)
    if (fetchError || !curso) {
      setError(fetchError ?? 'No se pudo cargar el curso')
      return
    }
    setTipoCurso(curso.tipo)
    setRoster(estudiantes ?? [])
    setSeleccionados(new Set((estudiantes ?? []).map(e => e.id)))
    setPaso('matricular')
  }

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function agregarNuevo() {
    setNuevos(prev => [...prev, { nombre: '', email: '' }])
  }

  function actualizarNuevo(index: number, campo: 'nombre' | 'email', valor: string) {
    setNuevos(prev => prev.map((n, i) => i === index ? { ...n, [campo]: valor } : n))
  }

  function quitarNuevo(index: number) {
    setNuevos(prev => prev.filter((_, i) => i !== index))
  }

  async function confirmar() {
    setCargando(true)
    setError(null)
    const { cursoId: nuevoCursoId, error: dupError } = await duplicarCurso({
      cursoOrigenId: cursoId,
      codigo,
      periodo,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
      estudianteIdsContinuar: Array.from(seleccionados),
      estudiantesNuevos: nuevos,
    })
    setCargando(false)
    if (dupError || !nuevoCursoId) {
      setError(dupError ?? 'Error al duplicar el curso')
      return
    }
    setAbierto(false)
    const destino = tipoCurso === 'tutorados' ? 'tutorados' : ''
    router.push(`/dashboard/cursos/${nuevoCursoId}${destino ? `/${destino}` : ''}`)
  }

  if (!abierto) {
    return (
      <button
        onClick={abrir}
        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:border-emerald-600/60 hover:text-emerald-400 hover:bg-emerald-900/10 transition-colors"
      >
        <span>🔁</span>
        Duplicar curso
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Duplicar curso</h2>
          <button onClick={() => setAbierto(false)} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/50 text-sm text-red-400">
            {error}
          </div>
        )}

        {paso === 'datos' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Clona la configuración del curso (horarios, evaluación, logros). Los datos operativos (asistencia, calificaciones, bitácoras) no se copian — empiezan en blanco en el nuevo periodo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Código nuevo</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Periodo nuevo</label>
                <input value={periodo} onChange={e => setPeriodo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={irAMatricular} disabled={cargando}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50">
                {cargando ? 'Cargando...' : 'Siguiente: matricular →'}
              </button>
            </div>
          </div>
        )}

        {paso === 'matricular' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              {roster.length} estudiante{roster.length === 1 ? '' : 's'} del periodo anterior. Desmarca quienes no continúan.
            </p>
            <div className="border border-gray-800 rounded-lg divide-y divide-gray-800 max-h-64 overflow-y-auto">
              {roster.map(e => (
                <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 cursor-pointer">
                  <input type="checkbox" checked={seleccionados.has(e.id)} onChange={() => toggleSeleccion(e.id)}
                    className="w-4 h-4 accent-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{e.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{e.email}</p>
                  </div>
                  {tipoCurso === 'tutorados' && e.tutorado?.etapa && (
                    <span className="text-xs text-gray-500 flex-shrink-0">{e.tutorado.etapa}</span>
                  )}
                </label>
              ))}
              {roster.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-500 text-center">Sin estudiantes activos en el curso origen.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Estudiantes nuevos (sin historial previo)</p>
                <button onClick={agregarNuevo} className="text-xs text-brand-400 hover:text-brand-300">+ Agregar</button>
              </div>
              {nuevos.length > 0 && (
                <div className="space-y-2">
                  {nuevos.map((n, i) => (
                    <div key={i} className="flex gap-2">
                      <input placeholder="Nombre" value={n.nombre} onChange={e => actualizarNuevo(i, 'nombre', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
                      <input placeholder="Email" value={n.email} onChange={e => actualizarNuevo(i, 'email', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
                      <button onClick={() => quitarNuevo(i)} className="text-gray-500 hover:text-red-400 px-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setPaso('datos')} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">
                ← Atrás
              </button>
              <button onClick={confirmar} disabled={cargando}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">
                {cargando ? 'Creando...' : `Crear curso con ${seleccionados.size + nuevos.filter(n => n.nombre.trim() && n.email.trim()).length} estudiantes`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
