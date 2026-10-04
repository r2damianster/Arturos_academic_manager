import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/app/dashboard/agenda/imprimir/print-button'
import type { ActividadPlanificada } from '@/types/domain'

// Vista de impresión de planes de clase (un plan por `id`, o todos los de un día por `fecha`).
// Vive fuera de /dashboard a propósito: así no hereda sidebar/header y imprime limpio.

const DIAS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  planificado: 'Planificado',
  cumplido: 'Cumplido',
  suspendido: 'Suspendido',
}

function formatFechaLarga(fechaIso: string): string {
  const [year, month, day] = fechaIso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayName = DIAS_LONG[date.getDay()]
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${day} de ${MESES[month - 1]} de ${year}`
}

function formatHora(hora: string | null | undefined): string {
  return hora?.slice(0, 5) ?? ''
}

function hoyIso(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

interface PlanParaImprimir {
  id: string
  fecha: string
  semana: string | null
  tema: string
  actividades: ActividadPlanificada[]
  observaciones: string | null
  estado: string | null
  asignatura: string
  institucion: string | null
  horario: { horaInicio: string; horaFin: string; centroComputo: boolean } | null
}

export default async function ImprimirPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; fecha?: string; embed?: string }>
}) {
  const { id: bitacoraId, fecha: fechaParam, embed } = await searchParams
  const isEmbedded = embed === '1' // dentro del modal: el botón de imprimir vive en el modal

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const columnasBitacora =
    'id, curso_id, fecha, semana, tema, actividades_json, observaciones, estado, cursos(asignatura, institucion, estado)'

  let query = db.from('bitacora_clase').select(columnasBitacora).eq('profesor_id', user.id)
  let fechaDia: string | null = null

  if (bitacoraId) {
    query = query.eq('id', bitacoraId)
  } else {
    fechaDia = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyIso()
    query = query.eq('fecha', fechaDia)
  }

  const [{ data: bitacoraRows }, { data: profesor }, { data: horariosRows }] = await Promise.all([
    query,
    db.from('profesores').select('nombre').eq('id', user.id).maybeSingle(),
    db.from('horarios_clases')
      .select('curso_id, dia_semana, hora_inicio, hora_fin, centro_computo')
      .eq('profesor_id', user.id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planes: PlanParaImprimir[] = ((bitacoraRows ?? []) as any[])
    // En modo día solo cursos activos (mismo criterio que /dashboard/planificacion)
    .filter(row => bitacoraId || !row.cursos?.estado || row.cursos.estado === 'activo')
    .map(row => {
      const [year, month, day] = String(row.fecha).split('-').map(Number)
      const dayName = DIAS_LONG[new Date(year, month - 1, day).getDay()]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const horario = ((horariosRows ?? []) as any[]).find(
        h => h.curso_id === row.curso_id && String(h.dia_semana).toLowerCase() === dayName
      )
      return {
        id: row.id,
        fecha: row.fecha,
        semana: row.semana ?? null,
        tema: row.tema,
        actividades: Array.isArray(row.actividades_json) ? (row.actividades_json as ActividadPlanificada[]) : [],
        observaciones: row.observaciones ?? null,
        estado: row.estado ?? null,
        asignatura: row.cursos?.asignatura ?? 'Sin asignatura',
        institucion: row.cursos?.institucion ?? null,
        horario: horario
          ? { horaInicio: horario.hora_inicio, horaFin: horario.hora_fin, centroComputo: !!horario.centro_computo }
          : null,
      }
    })
    .sort((a, b) => (a.horario?.horaInicio ?? '').localeCompare(b.horario?.horaInicio ?? ''))

  const nombreProfesor: string = profesor?.nombre ?? ''
  const generadoEn = new Date().toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })
  const volverHref = '/dashboard/planificacion'

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; }
        }
        body { background: white; color: #111; font-family: system-ui, sans-serif; }
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-8 bg-white text-gray-900 min-h-screen">
        {!isEmbedded && (
          <div className="print:hidden flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <a href={volverHref} className="text-sm text-blue-600 hover:underline">
              &larr; Volver a Mis Clases
            </a>
            <PrintButton />
          </div>
        )}

        {planes.length === 0 && (
          <p className="text-gray-500 italic">
            {bitacoraId ? 'No se encontró el plan solicitado.' : `No hay planes de clase para ${formatFechaLarga(fechaDia!)}.`}
          </p>
        )}

        {planes.map((plan, planIndex) => (
          <article
            key={plan.id}
            className={`mb-10 ${planIndex < planes.length - 1 ? 'break-after-page' : ''}`}
            style={planIndex < planes.length - 1 ? { breakAfter: 'page' } : undefined}
          >
            <header className="border-b-2 border-gray-800 pb-3 mb-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Plan de clase{plan.institucion ? ` · ${plan.institucion}` : ''}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{plan.asignatura}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>{formatFechaLarga(plan.fecha)}</span>
                {plan.horario && (
                  <span>{formatHora(plan.horario.horaInicio)} – {formatHora(plan.horario.horaFin)}</span>
                )}
                {plan.semana && <span>{plan.semana}</span>}
                {plan.horario?.centroComputo && <span>Centro de Cómputo</span>}
              </div>
              {nombreProfesor && <p className="text-sm text-gray-600 mt-1">Docente: {nombreProfesor}</p>}
            </header>

            <section className="mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Tema</h2>
              <p className="text-base text-gray-900">{plan.tema}</p>
            </section>

            {plan.actividades.length > 0 && (
              <section className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Actividades</h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-2 py-1 border border-gray-300 text-gray-600 font-medium w-8">#</th>
                      <th className="text-left px-2 py-1 border border-gray-300 text-gray-600 font-medium">Actividad</th>
                      <th className="text-left px-2 py-1 border border-gray-300 text-gray-600 font-medium w-2/5">Recurso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.actividades.map((activity, activityIndex) => (
                      <tr key={activityIndex} className="break-inside-avoid">
                        <td className="px-2 py-1 border border-gray-300 text-gray-500">{activityIndex + 1}</td>
                        <td className="px-2 py-1 border border-gray-300 text-gray-800">{activity.actividad}</td>
                        <td className="px-2 py-1 border border-gray-300 text-gray-600 break-words">{activity.recurso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {plan.observaciones && (
              <section className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Observaciones</h2>
                <p className="text-sm text-gray-800 whitespace-pre-line">{plan.observaciones}</p>
              </section>
            )}

            {plan.estado && (
              <p className="text-xs text-gray-400">Estado: {ETIQUETA_ESTADO[plan.estado] ?? plan.estado}</p>
            )}
          </article>
        ))}

        <footer className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          Generado el {generadoEn}
        </footer>
      </div>
    </>
  )
}
