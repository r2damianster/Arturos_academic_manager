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

  // All student records (may be enrolled in multiple courses)
  const { data: estudiantesData } = await db
    .from('estudiantes')
    .select('id, nombre, email, curso_id, profesor_id')
    .eq('auth_user_id', user.id)

  const estudiantes = estudiantesData ?? []
  if (estudiantes.length === 0) redirect('/auth/login')

  // Student survey data for carrera & telefono
  const { data: encuesta } = await db
    .from('encuesta_estudiante')
    .select('carrera, telefono')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // Collect unique profesor_ids from all student records
  const profesorIds: string[] = [
    ...new Set<string>(
      estudiantes
        .map((e: { profesor_id: string | null }) => e.profesor_id)
        .filter(Boolean) as string[]
    ),
  ]

  // Fetch horarios for those professors (with professor name)
  const { data: horariosData } = profesorIds.length > 0
    ? await db
        .from('horarios')
        .select('*, profesores(nombre)')
        .in('profesor_id', profesorIds)
        .order('dia_semana')
        .order('hora_inicio')
    : { data: [] }

  // Fetch student's pending reservas
  const { data: misReservasData } = await db
    .from('reservas')
    .select('*, horarios(dia_semana, hora_inicio, hora_fin)')
    .eq('auth_user_id', user.id)
    .eq('estado', 'pendiente')

  const horarios = horariosData ?? []
  const misReservas = misReservasData ?? []

  const primerEstudiante = estudiantes[0]

  const studentInfo = {
    nombre: primerEstudiante.nombre as string,
    email: primerEstudiante.email as string,
    carrera: encuesta?.carrera ?? null,
    telefono: encuesta?.telefono ?? null,
    auth_user_id: user.id,
    estudiante_ids: estudiantes.map((e: { id: string }) => e.id) as string[],
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="btn-ghost p-2"
            aria-label="Volver"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Tutorías</h1>
            <p className="text-gray-400 text-sm">Agenda una sesión con tu profesor</p>
          </div>
        </div>

        <TutoriasBooking
          horarios={horarios}
          misReservas={misReservas}
          studentInfo={studentInfo}
        />
      </div>
    </div>
  )
}
