import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TutoriasPageClient } from './tutorias-page-client'
import { getHistorialTutorias, getTiposTutoria } from '@/lib/actions/tutorias'

export default async function TutoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [
    { data: horarios },
    { data: reservas },
    { data: clases },
    { data: estudiantes },
    { data: cursos },
    { data: profesor },
    historial,
    { data: citaciones },
    tiposTutoriaResult,
  ] = await Promise.all([
    db.from('horarios')
      .select('*')
      .eq('profesor_id', user.id)
      .order('dia_semana'),

    db.from('reservas')
      .select('*')
      .order('fecha', { ascending: false }),

    db.from('horarios_clases')
      .select(`
        id, dia_semana, hora_inicio, hora_fin, tipo,
        cursos ( id, asignatura ),
        anuncios_tutoria_curso (
          estudiante_id, fecha,
          estudiantes ( nombre, carrera, email )
        )
      `)
      .eq('profesor_id', user.id),

    db.from('estudiantes')
      .select('id, nombre, email, auth_user_id, curso_id')
      .eq('profesor_id', user.id)
      .eq('estado', 'activo')
      .order('nombre'),

    db.from('cursos')
      .select('id, asignatura, institucion, codigo')
      .eq('profesor_id', user.id)
      .order('asignatura'),

    db.from('profesores')
      .select('nombre')
      .eq('id', user.id)
      .single(),

    getHistorialTutorias(),

    db.from('citaciones_tutoria')
      .select(`
        id, fecha_citacion, razon, detalle_razon, estado,
        cursos ( id, asignatura, institucion ),
        estudiantes ( id, nombre, email )
      `)
      .eq('profesor_id', user.id)
      .order('fecha_citacion', { ascending: false }),

    getTiposTutoria(),
  ])

  return (
    <TutoriasPageClient
      horarios={horarios ?? []}
      reservas={reservas ?? []}
      clases={clases ?? []}
      estudiantes={estudiantes ?? []}
      cursos={cursos ?? []}
      profesorNombre={profesor?.nombre ?? ''}
      historial={historial}
      citaciones={citaciones ?? []}
      tiposTutoria={tiposTutoriaResult.tipos}
    />
  )
}
