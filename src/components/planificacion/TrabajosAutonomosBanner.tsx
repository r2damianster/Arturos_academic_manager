import type { TrabajoAutonomoDeClase } from '@/lib/actions/trabajos-autonomos'

/** Aparece antes de las actividades de la clase. Se calcula al mostrar, así que siempre refleja el origen. */
export function TrabajosAutonomosBanner({ trabajos }: { trabajos: TrabajoAutonomoDeClase[] }) {
  if (trabajos.length === 0) return null
  return (
    <div className="flex-shrink-0 px-6 pt-4 space-y-2">
      {trabajos.map(trabajo => (
        <div key={trabajo.codigo} className="rounded-xl border border-violet-700/40 bg-violet-950/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-violet-400">
            Trabajo autónomo {trabajo.codigo} · {trabajo.semanaActual === 0 ? 'próxima clase' : `semana ${trabajo.semanaActual}/${trabajo.totalSemanas}`}
          </p>
          <p className="text-sm font-semibold text-white">{trabajo.titulo}</p>
          <p className="text-sm text-violet-200">{trabajo.faseTexto ?? 'Seguimiento del trabajo autónomo'}</p>
          {trabajo.descripcion && <p className="text-xs text-gray-400 mt-1">{trabajo.descripcion}</p>}
        </div>
      ))}
    </div>
  )
}
