'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ruleta } from '@/components/herramientas/Ruleta'
import { Agrupacion } from '@/components/herramientas/Agrupacion'

type Curso = { id: string; asignatura: string; codigo: string }
type Student = { id: string; nombre: string; apellido: string }

type Tab = 'ruleta' | 'agrupacion'

export function HerramientasClient({
  cursos,
  estudiantesIniciales,
  cursoIdInicial,
}: {
  cursos: Curso[]
  estudiantesIniciales: Student[]
  cursoIdInicial: string | null
}) {
  const [cursoId, setCursoId] = useState(cursoIdInicial ?? '')
  const [students, setStudents] = useState<Student[]>(estudiantesIniciales)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('ruleta')

  async function handleCursoChange(newCursoId: string) {
    setCursoId(newCursoId)
    if (!newCursoId) {
      setStudents([])
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('estudiantes')
      .select('id, nombre, apellido')
      .eq('curso_id', newCursoId)
      .order('apellido')
    setStudents((data as Student[]) ?? [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Selector de curso */}
      <div className="card">
        <label className="label">Curso</label>
        <select
          className="input max-w-sm"
          value={cursoId}
          onChange={e => handleCursoChange(e.target.value)}
        >
          <option value="">— Selecciona un curso —</option>
          {cursos.map(c => (
            <option key={c.id} value={c.id}>
              {c.asignatura} ({c.codigo})
            </option>
          ))}
        </select>
        {cursoId && !loading && (
          <p className="text-xs text-gray-500 mt-1">{students.length} estudiantes</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
        {(['ruleta', 'agrupacion'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'ruleta' ? 'Ruleta' : 'Agrupación'}
          </button>
        ))}
      </div>

      {/* Herramienta */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Cargando estudiantes…
          </div>
        ) : tab === 'ruleta' ? (
          <Ruleta students={students} />
        ) : (
          <Agrupacion students={students} />
        )}
      </div>
    </div>
  )
}
