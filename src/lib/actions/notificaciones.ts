'use server'

import { createClient, getAuthUser } from '@/lib/supabase/server'

export type Notificacion = {
  id: string
  tipo: 'riesgo_critico' | 'encuesta_pendiente' | 'citacion_sin_respuesta' | 'trabajos_vencidos'
  nivel: 'critica' | 'advertencia' | 'info'
  titulo: string
  descripcion: string
  link?: string
}

type CursoNotificable = {
  id: string
  asignatura: string
  fecha_inicio: string | null
  fecha_fin: string | null
  encuesta_parcial_habilitada: boolean | null
  alertas_silenciadas?: Record<string, unknown> | null
}

export async function getNotificacionesProactivas(): Promise<Notificacion[]> {
  try {
    const user = await getAuthUser()
    if (!user) return []
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const hoy = new Date().toISOString().split('T')[0]
    const hace3dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    // Una sola consulta de cursos activos para las 4 reglas (antes: 3 consultas)
    const { data: cursosData } = await db
      .from('cursos')
      .select('id, asignatura, fecha_inicio, fecha_fin, encuesta_parcial_habilitada, alertas_silenciadas')
      .eq('profesor_id', user.id)
      .eq('estado', 'activo')
    const cursos: CursoNotificable[] = cursosData ?? []
    const cursoIds = cursos.map(curso => curso.id)

    // Las 4 reglas son independientes → se ejecutan en paralelo.
    // Cada una captura sus propios errores (tabla/columna puede no existir aún).
    const [riesgo, encuesta, citaciones, trabajos] = await Promise.all([
      reglaRiesgoCritico(db, cursos),
      reglaEncuestaPendiente(db, cursos),
      reglaCitacionesSinRespuesta(db, user.id, hace3dias),
      reglaTrabajosVencidos(db, cursoIds, hoy),
    ])

    return [...riesgo, ...encuesta, ...citaciones, ...trabajos]
  } catch {
    return []
  }
}

// ── 1. Riesgo crítico: estudiantes con asistencia < 60% sin citación ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reglaRiesgoCritico(db: any, cursos: CursoNotificable[]): Promise<Notificacion[]> {
  try {
    const cursosActivos = cursos.filter(curso => !curso.alertas_silenciadas?.riesgo)
    if (cursosActivos.length === 0) return []
    const cursoIds = cursosActivos.map(curso => curso.id)

    // La asistencia se agrega en la base de datos (RPC con GROUP BY): evita
    // descargar todas las filas y el tope de 1000 filas de PostgREST.
    const [resumenRes, citadosRes, estudiantesRes] = await Promise.all([
      db.rpc('get_asistencia_resumen', { p_curso_ids: cursoIds }),
      db.from('citaciones_tutoria')
        .select('curso_id, estudiante_id')
        .in('curso_id', cursoIds)
        .in('estado', ['pendiente', 'agendada']),
      db.from('estudiantes').select('id, curso_id').in('curso_id', cursoIds).eq('estado', 'activo'),
    ])

    const resumenPorClave = new Map<string, { presentes: number; total: number }>()
    for (const fila of (resumenRes.data ?? []) as { curso_id: string; estudiante_id: string; presentes: number; total: number }[]) {
      resumenPorClave.set(`${fila.curso_id}:${fila.estudiante_id}`, { presentes: Number(fila.presentes), total: Number(fila.total) })
    }
    const citadosPorClave = new Set<string>(
      ((citadosRes.data ?? []) as { curso_id: string; estudiante_id: string }[])
        .map(citacion => `${citacion.curso_id}:${citacion.estudiante_id}`),
    )
    const estudiantesPorCurso = new Map<string, string[]>()
    for (const estudiante of (estudiantesRes.data ?? []) as { id: string; curso_id: string }[]) {
      const lista = estudiantesPorCurso.get(estudiante.curso_id) ?? []
      lista.push(estudiante.id)
      estudiantesPorCurso.set(estudiante.curso_id, lista)
    }

    const resultado: Notificacion[] = []
    for (const curso of cursosActivos) {
      const enRiesgoCritico = (estudiantesPorCurso.get(curso.id) ?? []).filter(estudianteId => {
        const clave = `${curso.id}:${estudianteId}`
        if (citadosPorClave.has(clave)) return false
        const asistencia = resumenPorClave.get(clave)
        if (!asistencia || asistencia.total === 0) return false
        return Math.round((asistencia.presentes / asistencia.total) * 100) < 60
      })

      if (enRiesgoCritico.length > 0) {
        resultado.push({
          id: `riesgo_${curso.id}`,
          tipo: 'riesgo_critico',
          nivel: 'critica',
          titulo: `${enRiesgoCritico.length} estudiante${enRiesgoCritico.length > 1 ? 's' : ''} en riesgo crítico`,
          descripcion: `${curso.asignatura}: asistencia < 60% sin citación a tutoría`,
          link: `/dashboard/cursos/${curso.id}`,
        })
      }
    }
    return resultado
  } catch {
    return []
  }
}

// ── 2. Encuesta parcial activa con < 50% respuestas ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reglaEncuestaPendiente(db: any, cursos: CursoNotificable[]): Promise<Notificacion[]> {
  try {
    const candidatos = cursos.filter(curso => {
      if (!curso.encuesta_parcial_habilitada || !curso.fecha_inicio || !curso.fecha_fin) return false
      if (curso.alertas_silenciadas?.encuesta_parcial) return false
      const inicio = new Date(curso.fecha_inicio).getTime()
      const fin = new Date(curso.fecha_fin).getTime()
      const avance = (Date.now() - inicio) / (fin - inicio)
      return avance >= 0.5 && avance <= 0.75
    })

    const resultados = await Promise.all(candidatos.map(async (curso): Promise<Notificacion | null> => {
      const [totalRes, respuestasRes] = await Promise.all([
        db.from('estudiantes').select('id', { count: 'exact', head: true }).eq('curso_id', curso.id).eq('estado', 'activo'),
        db.from('encuesta_parcial').select('id', { count: 'exact', head: true }).eq('curso_id', curso.id).eq('tipo', 'mitad'),
      ])
      const total = totalRes.count ?? 0
      const respondieron = respuestasRes.count ?? 0
      if (total > 0 && respondieron / total < 0.5) {
        return {
          id: `encuesta_${curso.id}`,
          tipo: 'encuesta_pendiente',
          nivel: 'advertencia',
          titulo: `Encuesta de progreso: ${respondieron}/${total} respuestas`,
          descripcion: `${curso.asignatura}: la encuesta está activa pero menos del 50% ha respondido`,
          link: `/dashboard/cursos/${curso.id}/encuesta-parcial`,
        }
      }
      return null
    }))
    return resultados.filter((notificacion): notificacion is Notificacion => notificacion !== null)
  } catch {
    return []
  }
}

// ── 3. Citaciones pendientes sin reserva (> 3 días) ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reglaCitacionesSinRespuesta(db: any, profesorId: string, hace3dias: string): Promise<Notificacion[]> {
  try {
    const { count } = await db
      .from('citaciones_tutoria')
      .select('id', { count: 'exact', head: true })
      .eq('profesor_id', profesorId)
      .eq('estado', 'pendiente')
      .is('reserva_id', null)
      .lt('created_at', hace3dias)

    if (count && count > 0) {
      return [{
        id: 'citaciones_sin_respuesta',
        tipo: 'citacion_sin_respuesta',
        nivel: 'advertencia',
        titulo: `${count} citación${count > 1 ? 'es' : ''} sin respuesta`,
        descripcion: `${count > 1 ? 'Estudiantes citados' : 'Un estudiante citado'} hace más de 3 días sin agendar tutoría`,
        link: '/dashboard/tutorias',
      }]
    }
    return []
  } catch {
    return []
  }
}

// ── 4. Trabajos vencidos sin entregar ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reglaTrabajosVencidos(db: any, cursoIds: string[], hoy: string): Promise<Notificacion[]> {
  try {
    if (cursoIds.length === 0) return []
    const { count } = await db
      .from('trabajos_asignados')
      .select('id', { count: 'exact', head: true })
      .in('curso_id', cursoIds)
      .not('fecha_entrega', 'is', null)
      .lt('fecha_entrega', hoy)
      .in('estado', ['Pendiente', 'En progreso'])

    if (count && count > 0) {
      return [{
        id: 'trabajos_vencidos',
        tipo: 'trabajos_vencidos',
        nivel: 'info',
        titulo: `${count} trabajo${count > 1 ? 's' : ''} vencido${count > 1 ? 's' : ''} sin entrega`,
        descripcion: 'Fecha de entrega pasada, estado aún pendiente o en progreso',
        link: undefined,
      }]
    }
    return []
  } catch {
    return []
  }
}
