import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TutoriaToggle } from '@/components/cursos/tutoria-toggle'
import { HorariosEditor } from '@/components/cursos/horarios-editor'
import type { Tables } from '@/types/database.types'

type Curso = Tables<'cursos'>
type Estudiante = Tables<'estudiantes'>

export default async function CursoDetailPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, clasesRes] = await Promise.all([
    db.from('cursos').select('*').eq('id', cursoId).single(),
    db.from('estudiantes').select('*').eq('curso_id', cursoId).order('nombre'),
    db.from('horarios_clases').select('*').eq('curso_id', cursoId).order('dia_semana').order('hora_inicio'),
  ])

  const curso = cursoRes.data as Curso | null
  if (!curso) notFound()

  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const clases = clasesRes.data ?? []

  const semanaRes = await db.rpc('calcular_semana', { p_curso_id: cursoId })
  const semana: string | null = semanaRes.data

  const modules = [
    { href: `/dashboard/cursos/${cursoId}/pase-lista`,  label: 'Bitácora y Lista', icon: '✅', desc: 'Bitácora + asistencia' },
    { href: `/dashboard/cursos/${cursoId}/asistencia`,  label: 'Reporte de Asistencia', icon: '📊', desc: 'Reporte completo' },
    { href: `/dashboard/cursos/${cursoId}/calificaciones`, label: 'Calificaciones',   icon: '📝', desc: 'Notas por parcial' },
    { href: `/dashboard/cursos/${cursoId}/trabajos`,    label: 'Trabajos',            icon: '📋', desc: 'Asignar y monitorear' },
    { href: `/dashboard/cursos/${cursoId}/estudiantes/importar`, label: 'Importar',   icon: '📥', desc: 'Carga masiva' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/cursos" className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{curso.codigo}</span>
            <span className="text-xs text-gray-500">{curso.periodo}</span>
            {semana && <span className="badge-azul">{semana}</span>}
          </div>
          <h1 className="text-2xl font-bold text-white">{curso.asignatura}</h1>
          {curso.fecha_inicio && (
            <p className="text-sm text-gray-500 mt-1">
              {new Date(curso.fecha_inicio).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}
              {curso.fecha_fin && <> → {new Date(curso.fecha_fin).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}</>}
            </p>
          )}

          {/* Horarios de Clase */}
          <HorariosEditor cursoId={cursoId} initialClases={clases as any} />
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{estudiantes.length}</p>
          <p className="text-xs text-gray-500">estudiantes</p>
        </div>
      </div>

      {/* Módulos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {modules.map(m => (
          <Link key={m.href} href={m.href}
            className="card hover:border-gray-700 transition-colors text-center group p-4">
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{m.label}</p>
            <p className="text-xs text-gray-500 mt-1 hidden md:block">{m.desc}</p>
          </Link>
        ))}
      </div>

      {/* Lista de estudiantes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Estudiantes</h2>
          <Link href={`/dashboard/cursos/${cursoId}/estudiantes/importar`}
            className="text-sm text-brand-400 hover:text-brand-300">
            + Importar
          </Link>
        </div>

        {estudiantes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-3">No hay estudiantes en este curso</p>
            <Link href={`/dashboard/cursos/${cursoId}/estudiantes/importar`} className="btn-primary text-sm">
              Importar estudiantes
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {estudiantes.map(est => (
              <div key={est.id} className="flex items-center justify-between py-3 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center
                                  text-gray-400 text-sm font-medium flex-shrink-0">
                    {est.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/dashboard/estudiantes/${est.id}`}
                      className="font-medium text-gray-200 hover:text-white transition-colors text-sm">
                      {est.nombre}
                    </Link>
                    <p className="text-xs text-gray-500">{est.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {est.tutoria && <span className="badge-azul">Tutoría</span>}
                  <TutoriaToggle estudianteId={est.id} tutoria={est.tutoria} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
