import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EnsamblarEvidencias } from '@/components/student/EnsamblarEvidencias'

function getObservacionProceso(nota: number | null): string | null {
  if (nota === null) return null
  if (nota < 5.5) return 'Tu proceso formativo presenta aspectos que requieren mayor atencion y acompanamiento continuo.'
  if (nota < 6.5) return 'Se identifican oportunidades para fortalecer el rendimiento en los distintos componentes del curso.'
  if (nota < 7.5) return 'Tu trayectoria refleja avances progresivos con algunos aspectos que continuan en desarrollo.'
  if (nota < 8.5) return 'El desempeno evidenciado muestra un nivel adecuado de logro en los distintos componentes formativos.'
  return 'Tu rendimiento refleja consistencia y dedicacion en los diferentes ambitos del proceso formativo.'
}

export default async function EvidenciasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: estData } = await db
    .from('estudiantes')
    .select('id, nombre, curso_id, tutoria')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!estData) redirect('/auth/login')

  const { data: cursoData } = await db
    .from('cursos')
    .select('asignatura, profesor_id')
    .eq('id', estData.curso_id)
    .maybeSingle()

  // participacion y calificaciones no tienen RLS para estudiantes → admin client
  const admin = createAdminClient() as any

  const [profRes, asistenciaRes, participacionRes, calificacionesRes, trabajosRes, reservasRes] = await Promise.all([
    cursoData?.profesor_id
      ? db.from('profesores').select('nombre').eq('id', cursoData.profesor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('asistencia').select('estado').eq('estudiante_id', estData.id),
    admin.from('participacion').select('nivel').eq('estudiante_id', estData.id),
    admin.from('calificaciones')
      .select('acd1,ta1,pe1,ex1,acd2,ta2,pe2,ex2,acd3,ta3,pe3,ex3,acd4,ta4,pe4,ex4')
      .eq('estudiante_id', estData.id)
      .maybeSingle(),
    db.from('trabajos_asignados').select('estado').eq('estudiante_id', estData.id),
    db.from('reservas').select('asistio').eq('auth_user_id', user.id),
  ])

  const profData = profRes.data

  // Asistencia
  const asisArr: { estado: string }[] = asistenciaRes.data ?? []
  const presentes = asisArr.filter(r => r.estado === 'Presente').length
  const pctAsistencia = asisArr.length > 0 ? Math.round(presentes / asisArr.length * 100) : null

  // Participacion → barra disimulada "cohesion del proceso"
  const nivelesArr: number[] = (participacionRes.data ?? [])
    .map((r: { nivel: number | null }) => r.nivel)
    .filter((n: number | null): n is number => n !== null)
  const indiceFormativo = nivelesArr.length > 0
    ? Math.round((nivelesArr.reduce((s, n) => s + n, 0) / nivelesArr.length) * 10) / 10
    : null

  // Nota promedio → observacion disimulada (no pasa el numero al cliente)
  const cal = calificacionesRes.data as Record<string, number | null> | null
  const notaFields: number[] = cal
    ? ([
        cal.acd1, cal.ta1, cal.pe1, cal.ex1,
        cal.acd2, cal.ta2, cal.pe2, cal.ex2,
        cal.acd3, cal.ta3, cal.pe3, cal.ex3,
        cal.acd4, cal.ta4, cal.pe4, cal.ex4,
      ] as (number | null)[]).filter((v): v is number => v !== null)
    : []
  const notaPromedio = notaFields.length > 0
    ? notaFields.reduce((s, v) => s + v, 0) / notaFields.length
    : null

  // Compromisos activos (trabajos Pendiente + En progreso)
  const trabajosArr: { estado: string }[] = trabajosRes.data ?? []
  const compromisos = trabajosArr.filter(t => t.estado === 'Pendiente' || t.estado === 'En progreso').length

  // Tutorias
  const reservasArr: { asistio: boolean | null }[] = reservasRes.data ?? []
  const tutoriasAsistidas = reservasArr.filter(r => r.asistio === true).length
  const tutoriasFaltadas = reservasArr.filter(r => r.asistio === false).length

  const stats = {
    asistencia: pctAsistencia,
    indiceFormativo,
    observacionProceso: getObservacionProceso(notaPromedio),
    compromisos,
    citadoTutoria: !!estData.tutoria,
    tutoriasAsistidas,
    tutoriasFaltadas,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/student" className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Ensamblador de Evidencias</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Organiza tus archivos y genera un PDF maestro para entregar
          </p>
        </div>
      </div>

      {/* Info del PDF */}
      <div className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
        <span>👤 {estData.nombre}</span>
        {cursoData && <span>📚 {cursoData.asignatura}</span>}
        {profData && <span>🎓 {profData.nombre}</span>}
      </div>

      {/* Componente cliente */}
      <EnsamblarEvidencias
        estudiante={estData.nombre}
        curso={cursoData?.asignatura ?? ''}
        profesor={profData?.nombre ?? ''}
        stats={stats}
      />
    </div>
  )
}
