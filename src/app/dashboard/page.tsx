import { Suspense } from 'react'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { SummaryPanel } from '@/components/dashboard/SummaryPanel'
import { TodayPanel } from '@/components/dashboard/TodayPanel'
import { AgendaSection } from '@/components/dashboard/AgendaSection'
import { NotificacionesLoader, TutoriasPendientesLoader } from '@/components/dashboard/DashboardAsyncPanels'
import { limpiarHorariosVencidos } from '@/lib/actions/tutorias'
import { finalizarCursosVencidos } from '@/lib/actions/cursos'

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Mantenimiento independiente entre sí → una sola ronda en paralelo
  // (antes: 3 await en serie antes de poder consultar nada)
  await Promise.all([
    db.rpc('inicializar_horarios_profesor', { p_id: user.id }),
    limpiarHorariosVencidos(),
    finalizarCursosVencidos(),
  ])

  const hoy = new Date().toISOString().split('T')[0]

  const [
    cursosCountRes,
    estudiantesCountRes,
    cursosRes,
    asistenciaRes,
    eventosRes,
    clasesRes,
    horariosRes,
    profesorRes,
    estudiantesRes,
    horariosTutoradosRes,
    suspendidasRes,
    reservasRes,
  ] = await Promise.all([
    db.from('cursos').select('id', { count: 'exact', head: true }),
    db.from('estudiantes').select('id', { count: 'exact', head: true }),
    db.from('cursos').select('id, asignatura, codigo, periodo, tipo, estado').eq('estado', 'activo').order('created_at', { ascending: false }).limit(5),
    db.from('asistencia').select('id', { count: 'exact', head: true }).eq('fecha', hoy),
    db.from('eventos_profesor').select('*').eq('profesor_id', user.id).order('fecha_inicio'),
    db.from('horarios_clases').select('id, dia_semana, hora_inicio, hora_fin, tipo, centro_computo, obligatoria, cursos(id, asignatura, fecha_inicio, fecha_fin)').eq('profesor_id', user.id),
    db.from('horarios').select('*').eq('profesor_id', user.id).order('dia_semana').order('hora_inicio'),
    db.from('profesores').select('nombre').eq('id', user.id).maybeSingle(),
    db.from('estudiantes').select('id, nombre, email, auth_user_id, curso_id').eq('profesor_id', user.id).order('nombre'),
    db.from('tutorado_perfil')
      .select('estudiante_id, dia_semana, hora_inicio, hora_fin, nota_horario, modalidad_trabajo')
      .eq('profesor_id', user.id)
      .not('dia_semana', 'is', null)
      .not('hora_inicio', 'is', null),
    db.from('bitacora_clase').select('curso_id, fecha').eq('profesor_id', user.id).eq('estado', 'suspendido'),
    db.from('reservas')
      .select('*, horarios!inner(profesor_id)')
      .eq('horarios.profesor_id', user.id)
      .order('fecha', { ascending: false }),
  ])

  // Reservas de tutorías del profesor (filtro en el join: no depende de ids previos)
  const horariosBase = horariosRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reservas: any[] = ((reservasRes.data ?? []) as any[]).map(({ horarios: _horarios, ...reserva }) => reserva)

  // Estudiantes del profesor (deduplicados por auth_user_id)
  const estudiantesData = estudiantesRes.data
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
  const clasesBase = clasesRes.data ?? []
  const claseIds = clasesBase.map((clase: { id: string }) => clase.id)

  // Encuestas y anuncios no dependen entre sí → en paralelo (antes: en serie)
  const [encuestasRes, anunciosRes] = await Promise.all([
    authIds.length > 0
      ? db.from('encuesta_estudiante').select('auth_user_id, carrera, telefono').in('auth_user_id', authIds)
      : null,
    claseIds.length > 0
      ? db.from('anuncios_tutoria_curso')
          .select('horario_clase_id, estudiante_id, fecha, estudiantes(nombre, carrera, email)')
          .in('horario_clase_id', claseIds)
      : null,
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const enc of (encuestasRes?.data ?? []) as any[]) encuestasMap[enc.auth_user_id] = { carrera: enc.carrera, telefono: enc.telefono }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantes = estudiantesArr.map((e: any) => ({
    id: e.id, nombre: e.nombre, email: e.email, auth_user_id: e.auth_user_id ?? null,
    carrera: e.auth_user_id ? encuestasMap[e.auth_user_id]?.carrera ?? null : null,
    telefono: e.auth_user_id ? encuestasMap[e.auth_user_id]?.telefono ?? null : null,
  }))

  // Anuncios tutoría de curso ("Asistiré")
  const anunciosData = anunciosRes?.data ?? []
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
    <div className="max-w-6xl mx-auto space-y-6">
      <Suspense fallback={null}>
        <NotificacionesLoader />
      </Suspense>
      <SummaryPanel
        totalCursos={cursosCountRes.count ?? 0}
        totalEstudiantes={estudiantesCountRes.count ?? 0}
        asistenciaHoy={asistenciaRes.count ?? 0}
        cursosRecientes={cursosRes.data ?? []}
      />
      <TodayPanel
        clases={clases}
        eventos={eventosRes.data ?? []}
        horarios={horariosBase}
        reservas={reservas}
        horariosTutorados={(horariosTutoradosRes.data ?? []).map((t: any) => ({
          estudiante_id: t.estudiante_id,
          dia_semana: t.dia_semana,
          hora_inicio: t.hora_inicio,
          hora_fin: t.hora_fin,
          nota_horario: t.nota_horario,
          nombre: (estudiantesRes.data as any[])?.find((e: any) => e.id === t.estudiante_id)?.nombre ?? '',
          nivel: t.modalidad_trabajo ?? null,
        }))}
        suspendidas={suspendidasRes.data ?? []}
        todayStr={hoy}
      />
      <AgendaSection
        eventos={eventosRes.data ?? []}
        clases={clases}
        horarios={horariosBase}
        reservas={reservas}
        estudiantes={estudiantes}
        horariosTutorados={(horariosTutoradosRes.data ?? []).map((t: any) => ({
          estudiante_id: t.estudiante_id,
          dia_semana: t.dia_semana,
          hora_inicio: t.hora_inicio,
          hora_fin: t.hora_fin,
          nota_horario: t.nota_horario,
          nombre: (estudiantesRes.data as any[])?.find((e: any) => e.id === t.estudiante_id)?.nombre ?? '',
          nivel: t.modalidad_trabajo ?? null,
        }))}
        profesorId={user.id}
        profesorNombre={profesorRes.data?.nombre ?? ''}
      />
      <Suspense fallback={null}>
        <TutoriasPendientesLoader />
      </Suspense>
    </div>
  )
}
