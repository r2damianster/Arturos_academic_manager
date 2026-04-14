import { createClient } from '@/lib/supabase/server'
import { AgendaClient } from './agenda-client'

export default async function AgendaPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Inicializar horarios del profesor si no existen
  await db.rpc('inicializar_horarios_profesor', { p_id: user.id })

  const [eventosRes, clasesRes, horariosRes, profesorRes] = await Promise.all([
    db.from('eventos_profesor').select('*').eq('profesor_id', user.id).order('fecha_inicio'),
    db.from('horarios_clases').select('id, dia_semana, hora_inicio, hora_fin, tipo, centro_computo, cursos(id, asignatura)').eq('profesor_id', user.id),
    db.from('horarios').select('*').eq('profesor_id', user.id).order('dia_semana').order('hora_inicio'),
    db.from('profesores').select('nombre').eq('id', user.id).maybeSingle(),
  ])

  const horariosBase = horariosRes.data ?? []
  const horarioIds: number[] = horariosBase.map((h: { id: number }) => h.id)

  let reservas = []
  if (horarioIds.length > 0) {
    const { data } = await db.from('reservas').select('*').in('horario_id', horarioIds).order('fecha', { ascending: false })
    reservas = data ?? []
  }

  // Estudiantes del profesor (deduplicados)
  const { data: estudiantesData } = await db.from('estudiantes').select('id, nombre, email, auth_user_id, curso_id').eq('profesor_id', user.id).order('nombre')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantesMap = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (estudiantesData ?? []) as any[]) {
    const key = e.auth_user_id ?? e.id
    if (!estudiantesMap.has(key)) estudiantesMap.set(key, e)
  }
  const estudiantesArr = Array.from(estudiantesMap.values())
  const authIds = estudiantesArr.map((e: { auth_user_id: string }) => e.auth_user_id).filter(Boolean)
  const encuestasMap: Record<string, { carrera: string | null; telefono: string | null }> = {}
  if (authIds.length > 0) {
    const { data: encuestas } = await db.from('encuesta_estudiante').select('auth_user_id, carrera, telefono').in('auth_user_id', authIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const enc of (encuestas ?? []) as any[]) encuestasMap[enc.auth_user_id] = { carrera: enc.carrera, telefono: enc.telefono }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantes = estudiantesArr.map((e: any) => ({
    id: e.id, nombre: e.nombre, email: e.email, auth_user_id: e.auth_user_id ?? null,
    carrera: e.auth_user_id ? encuestasMap[e.auth_user_id]?.carrera ?? null : null,
    telefono: e.auth_user_id ? encuestasMap[e.auth_user_id]?.telefono ?? null : null,
  }))

  // Anuncios tutoria_curso (estudiantes que marcaron "Voy")
  const clasesBase = clasesRes.data ?? []
  const claseIds = clasesBase.map((c: { id: string }) => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anunciosData: any[] = []
  if (claseIds.length > 0) {
    const { data: anRes } = await db.from('anuncios_tutoria_curso').select('horario_clase_id, estudiante_id, fecha, estudiantes(nombre, carrera, email)').in('horario_clase_id', claseIds)
    anunciosData = anRes ?? []
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anunciosPorClase: Record<string, any[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of anunciosData as any[]) {
    if (!anunciosPorClase[a.horario_clase_id]) anunciosPorClase[a.horario_clase_id] = []
    anunciosPorClase[a.horario_clase_id].push(a)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clases = clasesBase.map((c: any) => ({ ...c, anuncios_tutoria_curso: anunciosPorClase[c.id] ?? [] }))

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Agenda</h1>
        <p className="text-gray-400 text-sm mt-1">Clases, tutorías y eventos personales</p>
      </div>
      <AgendaClient
        eventos={eventosRes.data ?? []}
        clases={clases}
        horarios={horariosBase}
        reservas={reservas}
        estudiantes={estudiantes}
        profesorId={user.id}
        profesorNombre={profesorRes.data?.nombre ?? ''}
      />
    </div>
  )
}
