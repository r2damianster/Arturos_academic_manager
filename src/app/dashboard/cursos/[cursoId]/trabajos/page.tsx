import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TrabajosManager } from '@/components/trabajos/trabajos-manager'
import { EnviosRegistroPanel } from '@/components/trabajos/EnviosRegistroPanel'
import { AbrirRegistroButton } from '@/components/trabajos/AbrirRegistroButton'
import { getRegistrosPorCurso, getEnviosPorRegistro } from '@/lib/actions/registros-trabajo'
import type { Tables } from '@/types/database.types'

type Estudiante = Pick<Tables<'estudiantes'>, 'id' | 'nombre' | 'email'>

export default async function TrabajosPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes, trabajosRes, registros] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email').eq('curso_id', cursoId).order('nombre'),
    db.from('trabajos_asignados')
      .select('id, estudiante_id, tipo, tema, descripcion, estado, fecha_asignacion, observaciones_trabajo(id, observacion, fecha)')
      .eq('curso_id', cursoId),
    getRegistrosPorCurso(cursoId),
  ])

  if (!cursoRes.data) notFound()

  const curso = cursoRes.data as Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>
  const estudiantes: Estudiante[] = estudiantesRes.data ?? []
  const trabajos = trabajosRes.data ?? []

  const totalActivos = trabajos.filter((t: { estado: string }) =>
    t.estado === 'Pendiente' || t.estado === 'En progreso'
  ).length

  // Cargar envíos de todos los registros en paralelo
  const enviosPorRegistro: Record<string, Awaited<ReturnType<typeof getEnviosPorRegistro>>> = {}
  await Promise.all(
    registros.map(async reg => {
      enviosPorRegistro[reg.id] = await getEnviosPorRegistro(reg.id)
    })
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Trabajos</h1>
            <p className="text-gray-400 text-sm">{curso.asignatura} · {totalActivos} activos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AbrirRegistroButton cursoId={cursoId} />
          <Link href={`/dashboard/cursos/${cursoId}/trabajos/nuevo`} className="btn-primary">
            + Asignar
          </Link>
        </div>
      </div>

      {/* Registros de trabajo abiertos */}
      {registros.length > 0 && (
        <EnviosRegistroPanel
          cursoId={cursoId}
          registros={registros}
          enviosPorRegistro={enviosPorRegistro}
          totalEstudiantes={estudiantes.length}
        />
      )}

      {/* Trabajos asignados */}
      {estudiantes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay estudiantes en este curso</p>
        </div>
      ) : (
        <TrabajosManager
          cursoId={cursoId}
          estudiantes={estudiantes}
          trabajos={trabajos}
        />
      )}
    </div>
  )
}
