import { getTodosTutorados } from '@/lib/actions/tutorados'
import { createClient } from '@/lib/supabase/server'
import { TutoradosPanel } from '@/components/tutorados/TutoradosPanel'
import Link from 'next/link'

export default async function TodosTutoradosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  // Cursos tipo 'tutorados' del profesor — para el selector de "agregar grupo"
  const { data: cursosTutorados } = await db
    .from('cursos')
    .select('id, asignatura, periodo')
    .eq('tipo', 'tutorados')
    .order('created_at', { ascending: false })

  const { data: tutorados } = await getTodosTutorados()

  const total = tutorados.length
  const conSesion = tutorados.filter(t => t.ultima_sesion).length
  const sinSesion = total - conSesion

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-ghost p-2 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Tutorados</h1>
            <p className="text-gray-400 text-sm">
              {total} tutorado{total !== 1 ? 's' : ''} en {cursosTutorados?.length ?? 0} grupo{(cursosTutorados?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <Link href="/dashboard/cursos/nuevo"
          className="px-4 py-2 rounded-lg bg-brand-600/20 border border-brand-600/40 text-brand-300 text-sm hover:bg-brand-600/30 transition-colors">
          + Nuevo grupo de tutorados
        </Link>
      </div>

      {/* KPIs */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className="text-gray-500 text-xs mt-1">Total tutorados</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-emerald-400">{conSesion}</p>
            <p className="text-gray-500 text-xs mt-1">Con sesión registrada</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${sinSesion > 0 ? 'text-amber-400' : 'text-gray-500'}`}>{sinSesion}</p>
            <p className="text-gray-500 text-xs mt-1">Sin sesiones aún</p>
          </div>
        </div>
      )}

      {/* Grupos de tutorados */}
      {(cursosTutorados?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {cursosTutorados.map((c: { id: string; asignatura: string; periodo: string }) => (
            <Link key={c.id} href={`/dashboard/cursos/${c.id}/tutorados`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 text-sm transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              {c.asignatura}
              <span className="text-gray-600 text-xs">{c.periodo}</span>
            </Link>
          ))}
        </div>
      )}

      {total === 0 && (cursosTutorados?.length ?? 0) === 0 ? (
        <div className="card text-center py-12 space-y-4">
          <p className="text-gray-400">No tienes grupos de tutorados todavía.</p>
          <p className="text-gray-600 text-sm">
            Crea un curso y márcalo como &quot;Grupo de tutorados&quot; para empezar.
          </p>
          <Link href="/dashboard/cursos/nuevo" className="btn-primary inline-block">
            Crear primer grupo
          </Link>
        </div>
      ) : (
        <TutoradosPanel
          tutorados={tutorados}
          showCurso={true}
        />
      )}
    </div>
  )
}
