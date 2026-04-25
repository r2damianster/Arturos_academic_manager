import { createClient } from '@/lib/supabase/server'
import { SummaryPanel } from '@/components/dashboard/SummaryPanel'
import { TodayPanel, type TodayItem } from '@/components/dashboard/TodayPanel'
import { AgendaSection } from '@/components/dashboard/AgendaSection'

const DOW_MAP   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const DIAS_LONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function normalizeDia(d: string) { return d.normalize('NFD').replace(/[̀-ͯ]/g, '') }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eventOccursOnDay(ev: any, dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow  = date.getDay()
  const [sy, sm, sd] = (ev.fecha_inicio as string).split('-').map(Number)
  const [ey, em, ed] = (ev.fecha_fin   as string).split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)
  if (!ev.recurrente) return date >= start && date <= end
  const hastaStr = (ev.recurrencia_hasta ?? ev.fecha_fin) as string
  const [hy, hm, hd] = hastaStr.split('-').map(Number)
  const hasta = new Date(hy, hm - 1, hd)
  if (date < start || date > hasta) return false
  if (ev.recurrencia === 'diaria')  return true
  if (ev.recurrencia === 'semanal') return ((ev.recurrencia_dias ?? []) as number[]).includes(dow)
  if (ev.recurrencia === 'mensual') return date.getDate() === start.getDate()
  return false
}

const EVENTO_COLOR: Record<string, TodayItem['colorKey']> = {
  personal: 'purple', académico: 'teal', laboral: 'amber', social: 'pink', otro: 'gray',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  await db.rpc('inicializar_horarios_profesor', { p_id: user.id })

  const hoyDate = new Date()
  const hoy     = hoyDate.toISOString().split('T')[0]
  const hoyDow  = normalizeDia(DOW_MAP[hoyDate.getDay()] ?? 'lunes')
  const labelDia = `${DIAS_LONG[hoyDate.getDay()]} ${hoyDate.getDate()} de ${MESES_LONG[hoyDate.getMonth()]}`

  const [
    cursosCountRes,
    estudiantesCountRes,
    cursosRes,
    asistenciaRes,
    eventosRes,
    clasesRes,
    horariosRes,
    profesorRes,
  ] = await Promise.all([
    db.from('cursos').select('id', { count: 'exact', head: true }),
    db.from('estudiantes').select('id', { count: 'exact', head: true }),
    db.from('cursos').select('id, asignatura, codigo, periodo').order('created_at', { ascending: false }).limit(5),
    db.from('asistencia').select('id', { count: 'exact', head: true }).eq('fecha', hoy),
    db.from('eventos_profesor').select('*').eq('profesor_id', user.id).order('fecha_inicio'),
    db.from('horarios_clases').select('id, dia_semana, hora_inicio, hora_fin, tipo, centro_computo, cursos(id, asignatura)').eq('profesor_id', user.id),
    db.from('horarios').select('*').eq('profesor_id', user.id).order('dia_semana').order('hora_inicio'),
    db.from('profesores').select('nombre').eq('id', user.id).maybeSingle(),
  ])

  // Reservas de tutorías
  const horariosBase = horariosRes.data ?? []
  const horarioIds: number[] = horariosBase.map((h: { id: number }) => h.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reservas: any[] = []
  if (horarioIds.length > 0) {
    const { data } = await db.from('reservas').select('*').in('horario_id', horarioIds).order('fecha', { ascending: false })
    reservas = data ?? []
  }

  // Estudiantes del profesor (deduplicados por auth_user_id)
  const { data: estudiantesData } = await db
    .from('estudiantes').select('id, nombre, email, auth_user_id, curso_id').eq('profesor_id', user.id).order('nombre')
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

  // Anuncios tutoría de curso ("Asistiré")
  const clasesBase = clasesRes.data ?? []
  const claseIds = clasesBase.map((c: { id: string }) => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anunciosData: any[] = []
  if (claseIds.length > 0) {
    const { data: anRes } = await db.from('anuncios_tutoria_curso')
      .select('horario_clase_id, estudiante_id, fecha, estudiantes(nombre, carrera, email)')
      .in('horario_clase_id', claseIds)
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

  // ── Construir items de hoy ────────────────────────────────────────────────
  const todayItems: TodayItem[] = []

  // Clases de hoy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of clases as any[]) {
    if (normalizeDia(c.dia_semana ?? '') !== hoyDow) continue
    const confirmaciones: number = (anunciosPorClase[c.id] ?? [])
      .filter((a: { fecha: string }) => a.fecha === hoy).length
    const esTutoriaCurso = c.tipo === 'tutoria_curso'
    const detalles: string[] = []
    if (c.centro_computo) detalles.push('Centro cómputo')
    if (confirmaciones > 0) detalles.push(`${confirmaciones} confirma${confirmaciones > 1 ? 'ron' : 'ó'} asistencia`)
    todayItems.push({
      id: `clase-${c.id}`,
      hora:    (c.hora_inicio as string)?.slice(0, 5) ?? null,
      horaFin: (c.hora_fin   as string)?.slice(0, 5) ?? null,
      titulo: c.cursos?.asignatura ?? 'Clase',
      detalle: detalles.join(' · ') || null,
      tipo: 'clase',
      colorKey: esTutoriaCurso ? 'teal' : 'blue',
    })
  }

  // Slots de tutoría disponibles hoy + sus reservas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const h of horariosBase as any[]) {
    if (normalizeDia(h.dia_semana ?? '') !== hoyDow) continue
    if (h.estado !== 'disponible') continue
    if (h.disponible_hasta && hoy > h.disponible_hasta) continue
    const hReservas = reservas.filter(r => r.horario_id === h.id && r.fecha === hoy)
    const nombresReservas = hReservas
      .map((r: { estudiante_nombre: string; estado: string }) => `${r.estudiante_nombre} (${r.estado})`)
      .join(' · ')
    todayItems.push({
      id: `tutoria-${h.id}`,
      hora:    (h.hora_inicio as string)?.slice(0, 5) ?? null,
      horaFin: (h.hora_fin   as string)?.slice(0, 5) ?? null,
      titulo: hReservas.length > 0 ? `Tutoría · ${hReservas.length} reserva${hReservas.length > 1 ? 's' : ''}` : 'Tutoría disponible',
      detalle: nombresReservas || null,
      tipo: 'tutoria',
      colorKey: hReservas.length > 0 ? 'emerald' : 'gray',
    })
  }

  // Eventos de hoy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of (eventosRes.data ?? []) as any[]) {
    if (!eventOccursOnDay(ev, hoy)) continue
    todayItems.push({
      id: `evento-${ev.id}`,
      hora:    ev.todo_el_dia ? null : (ev.hora_inicio as string | null)?.slice(0, 5) ?? null,
      horaFin: ev.todo_el_dia ? null : (ev.hora_fin   as string | null)?.slice(0, 5) ?? null,
      titulo: ev.titulo as string,
      detalle: (ev.descripcion as string | null) || null,
      tipo: 'evento',
      colorKey: EVENTO_COLOR[ev.tipo as string] ?? 'gray',
    })
  }

  // Ordenar: todo-el-día primero, luego por hora
  todayItems.sort((a, b) => {
    if (!a.hora && !b.hora) return 0
    if (!a.hora) return -1
    if (!b.hora) return 1
    return a.hora.localeCompare(b.hora)
  })

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <SummaryPanel
        totalCursos={cursosCountRes.count ?? 0}
        totalEstudiantes={estudiantesCountRes.count ?? 0}
        asistenciaHoy={asistenciaRes.count ?? 0}
        cursosRecientes={cursosRes.data ?? []}
      />
      <TodayPanel items={todayItems} labelDia={labelDia} />
      <AgendaSection
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
