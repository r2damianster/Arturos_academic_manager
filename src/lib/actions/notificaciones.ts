'use server'

import { createClient } from '@/lib/supabase/server'

export type Notificacion = {
  id: string
  tipo: 'riesgo_critico' | 'encuesta_pendiente' | 'citacion_sin_respuesta' | 'trabajos_vencidos'
  nivel: 'critica' | 'advertencia' | 'info'
  titulo: string
  descripcion: string
  link?: string
}

export async function getNotificacionesProactivas(): Promise<Notificacion[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const hoy = new Date().toISOString().split('T')[0]
    const hace3dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const notificaciones: Notificacion[] = []

    // ── 1. Riesgo crítico: estudiantes con asistencia < 60% sin citación ──────
    try {
      const { data: cursos } = await db
        .from('cursos')
        .select('id, asignatura, alertas_silenciadas')
        .eq('profesor_id', user.id)
        .eq('estado', 'activo')

      for (const curso of (cursos ?? []) as { id: string; asignatura: string; alertas_silenciadas?: Record<string, unknown> | null }[]) {
        if (curso.alertas_silenciadas?.riesgo) continue
        const [asistRes, citadosRes, estudiantesRes] = await Promise.all([
          db.from('asistencia').select('estudiante_id, estado').eq('curso_id', curso.id),
          db.from('citaciones_tutoria')
            .select('estudiante_id')
            .eq('curso_id', curso.id)
            .in('estado', ['pendiente', 'agendada']),
          db.from('estudiantes').select('id').eq('curso_id', curso.id).eq('estado', 'activo'),
        ])

        const asistencias: { estudiante_id: string; estado: string }[] = asistRes.data ?? []
        const citadosSet = new Set<string>((citadosRes.data ?? []).map((c: any) => c.estudiante_id))
        const estudianteIds = new Set<string>((estudiantesRes.data ?? []).map((e: any) => e.id))

        // Calcular pct por estudiante
        const asistMap: Record<string, { presentes: number; total: number }> = {}
        for (const a of asistencias) {
          if (!asistMap[a.estudiante_id]) asistMap[a.estudiante_id] = { presentes: 0, total: 0 }
          asistMap[a.estudiante_id].total++
          if (a.estado === 'Presente') asistMap[a.estudiante_id].presentes++
        }

        const enRiesgoCritico = Array.from(estudianteIds).filter(id => {
          if (citadosSet.has(id)) return false
          const a = asistMap[id]
          if (!a || a.total === 0) return false
          return Math.round((a.presentes / a.total) * 100) < 60
        })

        if (enRiesgoCritico.length > 0) {
          notificaciones.push({
            id: `riesgo_${curso.id}`,
            tipo: 'riesgo_critico',
            nivel: 'critica',
            titulo: `${enRiesgoCritico.length} estudiante${enRiesgoCritico.length > 1 ? 's' : ''} en riesgo crítico`,
            descripcion: `${curso.asignatura}: asistencia < 60% sin citación a tutoría`,
            link: `/dashboard/cursos/${curso.id}`,
          })
        }
      }
    } catch { /* tabla puede no existir aún */ }

    // ── 2. Encuesta parcial activa con < 50% respuestas ───────────────────────
    try {
      const { data: cursosEncuesta } = await db
        .from('cursos')
        .select('id, asignatura, fecha_inicio, fecha_fin, encuesta_parcial_habilitada, alertas_silenciadas')
        .eq('profesor_id', user.id)
        .eq('estado', 'activo')

      for (const curso of (cursosEncuesta ?? []) as any[]) {
        if (!curso.encuesta_parcial_habilitada || !curso.fecha_inicio || !curso.fecha_fin) continue
        if (curso.alertas_silenciadas?.encuesta_parcial) continue
        const inicio = new Date(curso.fecha_inicio).getTime()
        const fin = new Date(curso.fecha_fin).getTime()
        const pct = (Date.now() - inicio) / (fin - inicio)
        if (pct < 0.5 || pct > 0.75) continue

        const [totalRes, respRes] = await Promise.all([
          db.from('estudiantes').select('id', { count: 'exact', head: true }).eq('curso_id', curso.id).eq('estado', 'activo'),
          db.from('encuesta_parcial').select('id', { count: 'exact', head: true }).eq('curso_id', curso.id).eq('tipo', 'mitad'),
        ])

        const total = totalRes.count ?? 0
        const respondieron = respRes.count ?? 0
        if (total > 0 && respondieron / total < 0.5) {
          notificaciones.push({
            id: `encuesta_${curso.id}`,
            tipo: 'encuesta_pendiente',
            nivel: 'advertencia',
            titulo: `Encuesta de progreso: ${respondieron}/${total} respuestas`,
            descripcion: `${curso.asignatura}: la encuesta está activa pero menos del 50% ha respondido`,
            link: `/dashboard/cursos/${curso.id}/encuesta-parcial`,
          })
        }
      }
    } catch { /* ok */ }

    // ── 3. Citaciones pendientes sin reserva (> 3 días) ───────────────────────
    try {
      const { count } = await db
        .from('citaciones_tutoria')
        .select('id', { count: 'exact', head: true })
        .eq('profesor_id', user.id)
        .eq('estado', 'pendiente')
        .is('reserva_id', null)
        .lt('created_at', hace3dias)

      if (count && count > 0) {
        notificaciones.push({
          id: 'citaciones_sin_respuesta',
          tipo: 'citacion_sin_respuesta',
          nivel: 'advertencia',
          titulo: `${count} citación${count > 1 ? 'es' : ''} sin respuesta`,
          descripcion: `${count > 1 ? 'Estudiantes citados' : 'Un estudiante citado'} hace más de 3 días sin agendar tutoría`,
          link: '/dashboard/tutorias',
        })
      }
    } catch { /* ok */ }

    // ── 4. Trabajos vencidos sin entregar ─────────────────────────────────────
    try {
      const { data: cursosP } = await db.from('cursos').select('id').eq('profesor_id', user.id).eq('estado', 'activo')
      const cursoIds = (cursosP ?? []).map((c: any) => c.id)
      if (cursoIds.length > 0) {
        const { count } = await db
          .from('trabajos_asignados')
          .select('id', { count: 'exact', head: true })
          .in('curso_id', cursoIds)
          .not('fecha_entrega', 'is', null)
          .lt('fecha_entrega', hoy)
          .in('estado', ['Pendiente', 'En progreso'])

        if (count && count > 0) {
          notificaciones.push({
            id: 'trabajos_vencidos',
            tipo: 'trabajos_vencidos',
            nivel: 'info',
            titulo: `${count} trabajo${count > 1 ? 's' : ''} vencido${count > 1 ? 's' : ''} sin entrega`,
            descripcion: 'Fecha de entrega pasada, estado aún pendiente o en progreso',
            link: undefined,
          })
        }
      }
    } catch { /* ok */ }

    return notificaciones
  } catch {
    return []
  }
}
