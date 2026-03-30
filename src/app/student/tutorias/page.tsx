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

  // Fetch horarios (only disponible slots)
  const { data: horariosData } = profesorIds.length > 0
    ? await db
        .from('horarios')
        .select('*, profesores(nombre)')
        .in('profesor_id', profesorIds)
        .eq('estado', 'disponible')
        .order('dia_semana')
        .order('hora_inicio')
    : { data: [] }

  const horarios = horariosData ?? []
  const horarioIds: number[] = horarios.map((h: { id: number }) => h.id)

  // Fetch ALL pending reservas for these slots (to show occupancy per date)
  // Only returns horario_id + fecha to respect privacy of other students
  let occupiedSlots: { horario_id: number; fecha: string }[] = []
  if (horarioIds.length > 0) {
    const { data: occData } = await db
      .from('reservas')
      .select('horario_id, fecha')
      .in('horario_id', horarioIds)
      .eq('estado', 'pendiente')
    occupiedSlots = occData ?? []
  }

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
          occupiedSlots={occupiedSlots}
          misReservas={misReservas}
          studentInfo={studentInfo}
        />
      </div>
    </div>
  )
}
