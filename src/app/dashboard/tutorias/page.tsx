import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TutoriasManager } from './tutorias-manager'

interface Horario {
  id: number
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  estado: string
  profesor_id: string
}

interface Reserva {
  id: number
  estudiante_nombre: string
  estudiante_carrera: string
  email: string
  telefono: string
  fecha: string
  horario_id: number
  estado: string
  notas?: string | null
}

export default async function TutoriasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Initialize professor slots if they don't exist yet (no-op if already created)
  await db.rpc('inicializar_horarios_profesor', { p_id: user.id })

  // Fetch all horarios for this professor
  const { data: horariosData } = await db
    .from('horarios')
    .select('*')
    .eq('profesor_id', user.id)
    .order('dia_semana')
    .order('hora_inicio')

  const horarios: Horario[] = horariosData ?? []

  // Fetch reservas: first get horario ids, then fetch matching reservas
  const horarioIds: number[] = horarios.map((h: Horario) => h.id)

  let reservas: Reserva[] = []
  if (horarioIds.length > 0) {
    const { data: reservasData } = await db
      .from('reservas')
      .select('*')
      .in('horario_id', horarioIds)
      .neq('estado', 'cancelado')
    reservas = reservasData ?? []
  }

  // Compute stats
  const totalDisponibles = horarios.filter((h: Horario) => h.estado === 'disponible').length
  const totalReservados = horarios.filter((h: Horario) => h.estado === 'reservado').length
  const totalNoDisponibles = horarios.filter((h: Horario) => h.estado === 'no_disponible').length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Tutorías</h1>
          <p className="text-gray-400 text-sm">Configura tu disponibilidad y gestiona reservas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-value">{horarios.length}</span>
          <span className="stat-label">Total slots</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-green-400">{totalDisponibles}</span>
          <span className="stat-label">Disponibles</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-blue-400">{totalReservados}</span>
          <span className="stat-label">Reservados</span>
        </div>
        <div className="stat-card col-span-3 md:col-span-1">
          <span className="stat-value text-gray-400">{totalNoDisponibles}</span>
          <span className="stat-label">No disponibles</span>
        </div>
      </div>

      {/* Interactive manager (client component) */}
      <TutoriasManager horarios={horarios} reservas={reservas} />
    </div>
  )
}
