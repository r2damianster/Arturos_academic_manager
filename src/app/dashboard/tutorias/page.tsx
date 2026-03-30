import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TutoriasManager } from './tutorias-manager'

export default async function TutoriasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  await db.rpc('inicializar_horarios_profesor', { p_id: user.id })

  const { data: horariosData } = await db
    .from('horarios')
    .select('*')
    .eq('profesor_id', user.id)
    .order('dia_semana')
    .order('hora_inicio')

  const horarios = horariosData ?? []
  const horarioIds: number[] = horarios.map((h: { id: number }) => h.id)

  // Fetch ALL reservas (all states) for historial + date-aware grid
  let reservas = []
  if (horarioIds.length > 0) {
    const { data } = await db
      .from('reservas')
      .select('*')
      .in('horario_id', horarioIds)
      .order('fecha', { ascending: false })
    reservas = data ?? []
  }

  const nDisp    = horarios.filter((h: { estado: string }) => h.estado === 'disponible').length
  const nNoDisp  = horarios.filter((h: { estado: string }) => h.estado === 'no_disponible').length
  const nPending = reservas.filter((r: { estado: string }) => r.estado === 'pendiente').length

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">Mis Tutorías</h1>
          <p className="text-gray-500 text-xs">Disponibilidad y gestión de reservas</p>
        </div>

        {/* Compact stats inline */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-emerald-400">{nDisp}</span>
            <span className="text-gray-400 ml-1">dispon.</span>
          </span>
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-blue-400">{nPending}</span>
            <span className="text-gray-400 ml-1">pendientes</span>
          </span>
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-gray-400">{nNoDisp}</span>
            <span className="text-gray-400 ml-1">no dispon.</span>
          </span>
        </div>
      </div>

      <TutoriasManager horarios={horarios} reservas={reservas} />
    </div>
  )
}
