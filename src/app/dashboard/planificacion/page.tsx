import { createClient } from '@/lib/supabase/server'
import { PlanificacionClient } from './planificacion-client'

export default async function PlanificacionPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: clases } = await db
    .from('horarios_clases')
    .select('id, dia_semana, hora_inicio, hora_fin, tipo, centro_computo, curso_id, cursos(id, asignatura, fecha_inicio, fecha_fin)')
    .eq('profesor_id', user.id)

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Clases</h1>
        <p className="text-gray-400 text-sm mt-1">Planifica, inicia y realiza seguimiento de tus clases</p>
      </div>
      <PlanificacionClient clases={clases ?? []} profesorId={user.id} />
    </div>
  )
}
