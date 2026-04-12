import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TutoriasBooking } from './tutorias-booking'

export default async function TutoriasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: estudiantesData } = await db
    .from('estudiantes')
    .select('id, nombre, email, curso_id, profesor_id')
    .eq('auth_user_id', user.id)

  const estudiantes = estudiantesData ?? []
  if (estudiantes.length === 0) redirect('/auth/login')

  const { data: encuesta } = await db
    .from('encuesta_estudiante')
    .select('carrera, telefono')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profesorIds: string[] = [
    ...new Set<string>(
      estudiantes
        .map((e: { profesor_id: string | null }) => e.profesor_id)
        .filter(Boolean) as string[]
    ),
  ]

  // Fetch horarios (disponible, not yet expired)
  const hoy = new Date().toISOString().split('T')[0]
  const { data: horariosData } = profesorIds.length > 0
    ? await db
        .from('horarios')
        .select('*, profesores(nombre)')
        .in('profesor_id', profesorIds)
        .eq('estado', 'disponible')
        .or(`disponible_hasta.is.null,disponible_hasta.gte.${hoy}`)
        .order('dia_semana')
        .order('hora_inicio')
    : { data: [] }

  const horarios = horariosData ?? []
  const horarioIds: number[] = horarios.map((h: { id: number }) => h.id)

  // Fetch ALL pending reservas for these slots (to show occupancy per date)
  // Uses SECURITY DEFINER function to bypass RLS — only returns horario_id + fecha,
  // no private data from other students is exposed.
  let occupiedSlots: { horario_id: number; fecha: string }[] = []
  if (horarioIds.length > 0) {
    const { data: occData } = await db
      .rpc('get_occupied_slots', { p_horario_ids: horarioIds })
    occupiedSlots = occData ?? []
  }

  // IDs de cursos del estudiante (para filtrar tutorías de curso abiertas)
  const estudianteCursoIds: string[] = estudiantes
    .map((e: { curso_id: string | null }) => e.curso_id)
    .filter(Boolean) as string[]

  // Mapa curso_id → estudiante_id para atribuir anuncios al registro correcto
  const estudianteByCurso: Record<string, string> = Object.fromEntries(
    estudiantes
      .filter((e: { curso_id: string | null; id: string }) => e.curso_id)
      .map((e: { curso_id: string; id: string }) => [e.curso_id, e.id])
  )

  // Fetch clases con tipo y curso_id
  const { data: clasesData } = profesorIds.length > 0
    ? await db
        .from('horarios_clases')
        .select('id, dia_semana, hora_inicio, hora_fin, profesor_id, tipo, curso_id, centro_computo')
        .in('profesor_id', profesorIds)
    : { data: [] }
  const clases = clasesData ?? []

  // IDs de horarios_clases tipo tutoria_curso del estudiante (para cargar anuncios previos)
  const tutoriaCursoIds: string[] = clases
    .filter((c: { tipo: string; curso_id: string | null }) =>
      c.tipo === 'tutoria_curso' && estudianteCursoIds.includes(c.curso_id ?? ''))
    .map((c: { id: string }) => c.id)

  // Anuncios ya realizados por el estudiante (todos sus registros)
  const todosEstudianteIds = Object.values(estudianteByCurso)
  const { data: misAnunciosData } = tutoriaCursoIds.length > 0 && todosEstudianteIds.length > 0
    ? await db
        .from('anuncios_tutoria_curso')
        .select('horario_clase_id, fecha, estudiante_id')
        .in('estudiante_id', todosEstudianteIds)
        .in('horario_clase_id', tutoriaCursoIds)
    : { data: [] }
  const misAnuncios: { horario_clase_id: string; fecha: string; estudiante_id: string }[] = misAnunciosData ?? []

  // Fetch student's own pending reservas (with full details)
  const { data: misReservasData } = await db
    .from('reservas')
    .select('id, horario_id, fecha, estado, notas, horarios(dia_semana, hora_inicio, hora_fin)')
    .eq('auth_user_id', user.id)
    .eq('estado', 'pendiente')

  const misReservas = misReservasData ?? []
  const primerEstudiante = estudiantes[0]

  const studentInfo = {
    nombre: primerEstudiante.nombre as string,
    email: primerEstudiante.email as string,
    carrera: encuesta?.carrera ?? null,
    telefono: encuesta?.telefono ?? null,
    auth_user_id: user.id,
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/student" className="btn-ghost p-2" aria-label="Volver">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Tutorías</h1>
            <p className="text-gray-400 text-sm">Agenda una sesión con tu profesor</p>
          </div>
        </div>

        <TutoriasBooking
          horarios={horarios}
          clases={clases}
          occupiedSlots={occupiedSlots}
          misReservas={misReservas}
          studentInfo={studentInfo}
          estudianteCursoIds={estudianteCursoIds}
          estudianteByCurso={estudianteByCurso}
          misAnuncios={misAnuncios}
        />
      </div>
    </div>
  )
}
