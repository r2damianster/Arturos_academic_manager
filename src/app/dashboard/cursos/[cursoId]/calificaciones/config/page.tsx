import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

async function guardarConfigCalificaciones(cursoId: string, formData: FormData) {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const numParciales = parseInt(formData.get('num_parciales') as string) || 2
  const t1 = (formData.get('tarea1') as string)?.trim() || 'ACD'
  const t2 = (formData.get('tarea2') as string)?.trim() || 'TA'
  const t3 = (formData.get('tarea3') as string)?.trim() || 'PE'
  const t4 = (formData.get('tarea4') as string)?.trim() || 'EX'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('cursos')
    .update({ num_parciales: numParciales, nombres_tareas: [t1, t2, t3, t4] })
    .eq('id', cursoId)
    .eq('profesor_id', user.id)

  redirect(`/dashboard/cursos/${cursoId}/calificaciones`)
}

export default async function ConfigCalificacionesPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: curso } = await db.from('cursos')
    .select('id, asignatura, num_parciales, nombres_tareas')
    .eq('id', cursoId).single()

  if (!curso) notFound()

  const numParciales: number = curso.num_parciales ?? 2
  const tareas: string[] = Array.isArray(curso.nombres_tareas)
    ? curso.nombres_tareas
    : ['ACD', 'TA', 'PE', 'EX']

  const action = guardarConfigCalificaciones.bind(null, cursoId)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}/calificaciones`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Configurar calificaciones</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura}</p>
        </div>
      </div>

      <form action={action} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Número de parciales</h2>
          <div className="flex gap-3">
            {[2, 3, 4].map(n => (
              <label key={n} className="flex-1 cursor-pointer">
                <input type="radio" name="num_parciales" value={n} defaultChecked={numParciales === n} className="sr-only peer" />
                <div className="text-center py-3 rounded-lg border border-gray-700 peer-checked:border-brand-500 peer-checked:bg-brand-600/20 peer-checked:text-brand-400 text-gray-400 transition-colors hover:border-gray-600">
                  <span className="text-xl font-bold block">{n}</span>
                  <span className="text-xs">parciales</span>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Al cambiar el número de parciales, las calificaciones ya guardadas se conservan.
          </p>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Nombres de las tareas</h2>
          <p className="text-xs text-gray-400">
            Cada parcial tiene 4 componentes de calificación. Puedes personalizar sus nombres.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'tarea1', label: 'Componente 1', default: tareas[0] ?? 'ACD' },
              { name: 'tarea2', label: 'Componente 2', default: tareas[1] ?? 'TA' },
              { name: 'tarea3', label: 'Componente 3', default: tareas[2] ?? 'PE' },
              { name: 'tarea4', label: 'Componente 4', default: tareas[3] ?? 'EX' },
            ].map(t => (
              <div key={t.name}>
                <label className="label">{t.label}</label>
                <input name={t.name} className="input" defaultValue={t.default}
                  maxLength={8} placeholder="ej: ACD, TA..." required />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Ejemplos: ACD (Actividades), TA (Trabajos), PE (Prueba escrita), EX (Examen)
          </p>
        </div>

        <div className="flex gap-3">
          <Link href={`/dashboard/cursos/${cursoId}/calificaciones`} className="btn-ghost flex-1 text-center">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary flex-1">
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  )
}
