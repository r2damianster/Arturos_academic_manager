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

  const [horariosRes, profesorRes, clasesRes] = await Promise.all([
    db.from('horarios')
      .select('*')
      .eq('profesor_id', user.id)
      .order('dia_semana')
      .order('hora_inicio'),
    db.from('profesores')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle(),
    db.from('horarios_clases')
      .select('id, dia_semana, hora_inicio, hora_fin, tipo, cursos(id, asignatura), anuncios_tutoria_curso(estudiante_id, fecha, estudiantes(nombre, carrera, email))')
      .eq('profesor_id', user.id)
  ])

  const horarios = horariosRes.data ?? []
  const profesorNombre: string = profesorRes.data?.nombre ?? ''
  const horarioIds: number[] = horarios.map((h: { id: number }) => h.id)

  // All reservas for historial + grid
  let reservas = []
  if (horarioIds.length > 0) {
    const { data } = await db
      .from('reservas')
      .select('*')
      .in('horario_id', horarioIds)
      .order('fecha', { ascending: false })
    reservas = data ?? []
  }

  // All students linked to this professor (across all courses)
  const { data: estudiantesData } = await db
    .from('estudiantes')
    .select('id, nombre, email, auth_user_id, curso_id')
    .eq('profesor_id', user.id)
    .order('nombre')

  // Deduplicate by auth_user_id (same student can be in multiple courses)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantesMap = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (estudiantesData ?? []) as any[]) {
    const key = e.auth_user_id ?? e.id
    if (!estudiantesMap.has(key)) estudiantesMap.set(key, e)
  }
  const estudiantes = Array.from(estudiantesMap.values())

  // Fetch carrera/telefono from encuesta_estudiante
  const authIds = estudiantes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => e.auth_user_id)
    .filter(Boolean)

  const encuestasMap: Record<string, { carrera: string | null; telefono: string | null }> = {}
  if (authIds.length > 0) {
    const { data: encuestas } = await db
      .from('encuesta_estudiante')
      .select('auth_user_id, carrera, telefono')
      .in('auth_user_id', authIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const enc of (encuestas ?? []) as any[]) {
      encuestasMap[enc.auth_user_id] = { carrera: enc.carrera, telefono: enc.telefono }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantesConDatos = estudiantes.map((e: any) => ({
    id:          e.id,
    nombre:      e.nombre,
    email:       e.email,
    auth_user_id: e.auth_user_id ?? null,
    carrera:     e.auth_user_id ? encuestasMap[e.auth_user_id]?.carrera ?? null : null,
    telefono:    e.auth_user_id ? encuestasMap[e.auth_user_id]?.telefono ?? null : null,
  }))

  const nDisp    = horarios.filter((h: { estado: string }) => h.estado === 'disponible').length
  const nNoDisp  = horarios.filter((h: { estado: string }) => h.estado === 'no_disponible').length
  const nPending = reservas.filter((r: { estado: string }) => r.estado === 'pendiente' || r.estado === 'confirmada').length
  
  const clases = clasesRes.data ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-4">

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

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-emerald-400">{nDisp}</span>
            <span className="text-gray-400 ml-1">dispon.</span>
          </span>
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-blue-400">{nPending}</span>
            <span className="text-gray-400 ml-1">activas</span>
          </span>
          <span className="bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs">
            <span className="font-semibold text-gray-400">{nNoDisp}</span>
            <span className="text-gray-400 ml-1">no disp.</span>
          </span>
        </div>
      </div>

      <TutoriasManager
        horarios={horarios}
        reservas={reservas}
        clases={clases}
        estudiantes={estudiantesConDatos}
        profesorNombre={profesorNombre}
      />
    </div>
  )
}
