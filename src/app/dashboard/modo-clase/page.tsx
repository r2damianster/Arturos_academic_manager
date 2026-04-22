import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type Bitacora = {
  id: string
  fecha: string
  tema: string
  estado: string | null
  hora_inicio_real: string | null
  cursos: { asignatura: string; codigo: string } | null
}

function EstadoBadge({ b }: { b: Bitacora }) {
  if (b.estado === 'cumplido') {
    return <span className="badge-verde">Finalizada</span>
  }
  if (b.hora_inicio_real) {
    return <span className="badge-amarillo">En progreso</span>
  }
  return <span className="badge-azul">Planificada</span>
}

function BotonAccion({ b }: { b: Bitacora }) {
  const label =
    b.estado === 'cumplido'
      ? 'Ver resumen'
      : b.hora_inicio_real
      ? 'Continuar clase'
      : 'Iniciar clase'

  const color =
    b.hora_inicio_real && b.estado !== 'cumplido'
      ? 'bg-amber-600 hover:bg-amber-500'
      : b.estado === 'cumplido'
      ? 'bg-gray-700 hover:bg-gray-600'
      : 'bg-brand-600 hover:bg-brand-500'

  return (
    <Link
      href={`/dashboard/modo-clase/${b.id}`}
      className={`${color} text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap`}
    >
      {label}
    </Link>
  )
}

export default async function ModoClasePage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const hoy = new Date().toISOString().split('T')[0]
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data } = await db
    .from('bitacora_clase')
    .select('id, fecha, tema, estado, hora_inicio_real, cursos(asignatura, codigo)')
    .eq('profesor_id', user.id)
    .gte('fecha', hace7)
    .lte('fecha', hoy)
    .order('fecha', { ascending: false })

  const bitacoras: Bitacora[] = (data ?? []).sort((a: Bitacora, b: Bitacora) => {
    // En progreso primero
    const aProgress = a.hora_inicio_real && a.estado !== 'cumplido' ? 0 : 1
    const bProgress = b.hora_inicio_real && b.estado !== 'cumplido' ? 0 : 1
    return aProgress - bProgress
  })

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Modo Clase</h1>
        <p className="text-gray-400 text-sm mt-1">
          Selecciona una clase planificada para iniciarla
        </p>
      </div>

      {bitacoras.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No hay clases planificadas en los últimos 7 días.</p>
          <Link
            href="/dashboard/agenda"
            className="btn-primary inline-block mt-4 px-6 py-2"
          >
            Ir a la Agenda
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bitacoras.map(b => (
            <div
              key={b.id}
              className="card flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <EstadoBadge b={b} />
                  <span className="text-xs text-gray-500">{b.fecha}</span>
                </div>
                <p className="font-semibold text-gray-100 truncate">
                  {b.cursos?.asignatura ?? 'Curso'}{' '}
                  <span className="text-gray-500 font-normal text-sm">· {b.cursos?.codigo}</span>
                </p>
                <p className="text-sm text-gray-400 truncate mt-0.5">{b.tema}</p>
              </div>
              <BotonAccion b={b} />
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-800">
        <Link
          href="/dashboard/herramientas"
          className="btn-ghost flex items-center gap-2 w-fit text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M11.049 2.927c.3-1.102 1.603-1.102 1.902 0a1.724 1.724 0 002.573 1.066c.966-.587 2.067.47 1.48 1.437a1.724 1.724 0 001.065 2.572c1.102.3 1.102 1.603 0 1.902a1.724 1.724 0 00-1.065 2.573c.587.966-.47 2.067-1.437 1.48a1.724 1.724 0 00-2.573 1.065c-.3 1.102-1.603 1.102-1.902 0a1.724 1.724 0 00-2.572-1.065c-.967.587-2.067-.47-1.48-1.437a1.724 1.724 0 00-1.066-2.573c-1.102-.3-1.102-1.603 0-1.902a1.724 1.724 0 001.066-2.572c-.587-.966.47-2.067 1.437-1.48a1.724 1.724 0 002.572-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Usar herramientas sin clase activa
        </Link>
      </div>
    </main>
  )
}
