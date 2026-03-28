import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { guardarBitacora } from '@/lib/actions/bitacora'
import type { Tables } from '@/types/database.types'

type Curso = Pick<Tables<'cursos'>, 'id' | 'asignatura' | 'codigo'>

export default async function NuevaBitacoraPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const cursoRes = await db
    .from('cursos')
    .select('id, asignatura, codigo')
    .eq('id', cursoId)
    .single()

  if (!cursoRes.data) notFound()
  const curso = cursoRes.data as Curso

  const hoy = new Date().toISOString().split('T')[0]
  const action = guardarBitacora.bind(null, cursoId)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}/bitacora`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva entrada de bitácora</h1>
          <p className="text-gray-400 text-sm">{curso.asignatura}</p>
        </div>
      </div>

      <form action={action} className="card space-y-4">
        <div>
          <label className="label">Fecha *</label>
          <input name="fecha" type="date" className="input" defaultValue={hoy} required />
        </div>
        <div>
          <label className="label">Tema de la clase *</label>
          <input name="tema" className="input" placeholder="Introducción a la hoja de cálculo" required />
        </div>
        <div>
          <label className="label">Actividades realizadas</label>
          <textarea name="actividades" className="input h-24 resize-none"
            placeholder="Ejercicio práctico en Excel, trabajo grupal..." />
        </div>
        <div>
          <label className="label">Materiales utilizados</label>
          <input name="materiales" className="input" placeholder="Diapositivas Cap. 3, dataset ventas_2024.xlsx..." />
        </div>
        <div>
          <label className="label">Observaciones generales</label>
          <textarea name="observaciones" className="input h-20 resize-none"
            placeholder="Grupo participativo. Varios estudiantes con dudas..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">Guardar entrada</button>
          <Link href={`/dashboard/cursos/${cursoId}/bitacora`} className="btn-ghost flex-1 text-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
