import { createClient } from '@/lib/supabase/server'
import { PrintButton } from './print-button'
import type { ActividadPlanificada } from '@/types/domain'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DIAS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmt2(n: number) { return String(n).padStart(2, '0') }

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`
}

function getMondayOf(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = DIAS_LONG[date.getDay()]
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d} de ${MESES[m - 1]} de ${y}`
}

function fmtTime(t: string): string {
  return t?.slice(0, 5) ?? ''
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HorarioClase {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  tipo: string
  centro_computo: boolean
  cursos: { id: string; asignatura: string } | null
}

interface BitacoraRow {
  id: string
  curso_id: string
  fecha: string
  tema: string
  actividades_json: ActividadPlanificada[] | null
  observaciones: string | null
  estado: string | null
}

// dia_semana values stored in DB (match agenda-client.tsx usage)
const DIA_SEMANA_MAP: Record<string, number> = {
  lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ImprimirAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; modo?: string }>
}) {
  const params = await searchParams
  const modo = params.modo === 'dia' ? 'dia' : 'semana'
  const rawFecha = params.fecha ?? dateToStr(new Date())

  // Build the date range to display
  let fechas: string[] = []

  if (modo === 'dia') {
    fechas = [rawFecha]
  } else {
    // semana: lunes a sábado
    const monday = getMondayOf(rawFecha)
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      fechas.push(dateToStr(d))
    }
  }

  const fechaMin = fechas[0]
  const fechaMax = fechas[fechas.length - 1]

  // ─── Supabase fetch ────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8 text-center text-gray-500">
        No autorizado. Por favor inicia sesión.
      </div>
    )
  }

  const [horariosRes, bitacoraRes] = await Promise.all([
    supabase
      .from('horarios_clases')
      .select('id, dia_semana, hora_inicio, hora_fin, tipo, centro_computo, cursos(id, asignatura)')
      .eq('profesor_id', user.id),
    supabase
      .from('bitacora_clase')
      .select('id, curso_id, fecha, tema, actividades_json, observaciones, estado')
      .eq('profesor_id', user.id)
      .gte('fecha', fechaMin)
      .lte('fecha', fechaMax),
  ])

  const horarios: HorarioClase[] = (horariosRes.data ?? []).map(h => ({
    ...h,
    cursos: Array.isArray(h.cursos) ? h.cursos[0] ?? null : (h.cursos as { id: string; asignatura: string } | null),
  }))
  const bitacoras: BitacoraRow[] = (bitacoraRes.data ?? []).map(b => ({
    ...b,
    actividades_json: Array.isArray(b.actividades_json) ? b.actividades_json as ActividadPlanificada[] : null,
  }))

  // Index bitácoras by curso_id|fecha for fast lookup
  const bitacoraMap = new Map<string, BitacoraRow>()
  for (const b of bitacoras) {
    bitacoraMap.set(`${b.curso_id}|${b.fecha}`, b)
  }

  // Build days with their scheduled classes
  type DiaData = {
    fecha: string
    clases: { horario: HorarioClase; bitacora: BitacoraRow | null }[]
  }

  const dias: DiaData[] = []

  for (const fecha of fechas) {
    const [y, m, d] = fecha.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const dowIndex = date.getDay() // 0=dom

    // Filter horarios that correspond to this weekday
    const clasesDelDia = horarios.filter((h) => {
      const horarioDow = DIA_SEMANA_MAP[h.dia_semana.toLowerCase()] ?? -1
      return horarioDow === dowIndex
    })

    // Sort by hora_inicio
    clasesDelDia.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

    const clasesConBitacora = clasesDelDia.map((h) => ({
      horario: h,
      bitacora: h.cursos ? (bitacoraMap.get(`${h.cursos.id}|${fecha}`) ?? null) : null,
    }))

    // Only include days that have at least one class (or include all if modo=dia)
    if (modo === 'dia' || clasesConBitacora.length > 0) {
      dias.push({ fecha, clases: clasesConBitacora })
    }
  }

  // Title string
  const titulo =
    modo === 'dia'
      ? `Plan de Clases — ${fmtDateLong(rawFecha)}`
      : (() => {
          const [y1, m1, d1] = fechaMin.split('-').map(Number)
          const [y2, m2, d2] = fechaMax.split('-').map(Number)
          if (m1 === m2) return `Plan de Clases — ${d1}–${d2} de ${MESES[m1 - 1]} de ${y1}`
          return `Plan de Clases — ${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]} ${y2}`
        })()

  const generadoEn = new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; }
          .print-hidden { display: none !important; }
        }
        body { background: white; color: #111; font-family: system-ui, sans-serif; }
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-8 bg-white text-gray-900 min-h-screen">
        {/* Top bar — visible on screen only */}
        <div className="print:hidden flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <a
            href="/dashboard/agenda"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Volver a la agenda
          </a>
          <PrintButton />
        </div>

        {/* Document title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{titulo}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Generado el {generadoEn}
        </p>

        {dias.length === 0 && (
          <p className="text-gray-500 italic">
            No hay clases programadas para este período.
          </p>
        )}

        {dias.map(({ fecha, clases }) => (
          <section key={fecha} className="mb-8 break-inside-avoid">
            {/* Day header */}
            <h2 className="text-base font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded mb-3 border border-gray-200">
              {fmtDateLong(fecha)}
            </h2>

            {clases.length === 0 ? (
              <p className="text-gray-400 italic text-sm pl-3">Sin clases programadas.</p>
            ) : (
              <div className="space-y-4">
                {clases.map(({ horario, bitacora }) => (
                  <div
                    key={horario.id}
                    className="border border-gray-200 rounded-lg px-4 py-3 break-inside-avoid"
                  >
                    {/* Class header row */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {horario.cursos?.asignatura ?? 'Sin asignatura'}
                        </span>
                        {horario.centro_computo && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Centro Cómputo
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {fmtTime(horario.hora_inicio)} – {fmtTime(horario.hora_fin)}
                      </span>
                    </div>

                    {bitacora ? (
                      <>
                        {/* Tema */}
                        <p className="text-sm text-gray-800 mb-2">
                          <span className="font-medium">Tema:</span> {bitacora.tema}
                        </p>

                        {/* Actividades */}
                        {bitacora.actividades_json && bitacora.actividades_json.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
                              Actividades
                            </p>
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="text-left px-2 py-1 border border-gray-200 text-gray-600 font-medium w-1/2">
                                    Actividad
                                  </th>
                                  <th className="text-left px-2 py-1 border border-gray-200 text-gray-600 font-medium w-1/2">
                                    Recurso
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {bitacora.actividades_json.map((act, idx) => (
                                  <tr key={idx} className="even:bg-gray-50">
                                    <td className="px-2 py-1 border border-gray-200 text-gray-800">
                                      {act.actividad}
                                    </td>
                                    <td className="px-2 py-1 border border-gray-200 text-gray-600">
                                      {act.recurso}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Observaciones */}
                        {bitacora.observaciones && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Observaciones:</span>{' '}
                            {bitacora.observaciones}
                          </p>
                        )}

                        {/* Estado badge */}
                        {bitacora.estado && (
                          <p className="mt-1 text-xs text-gray-400 capitalize">
                            Estado: {bitacora.estado}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Sin planificación</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {/* Footer */}
        <footer className="mt-12 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          Generado el {generadoEn}
        </footer>
      </div>
    </>
  )
}
