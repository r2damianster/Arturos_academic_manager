import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AgendaClient } from './agenda-client'
import type { Evento } from '@/lib/actions/eventos'

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('eventos_profesor')
    .select('*')
    .eq('profesor_id', user!.id)
    .order('fecha_inicio')

  const eventos: Evento[] = data ?? []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="text-gray-400 text-sm mt-1">Eventos personales, académicos y laborales</p>
        </div>
        <Link
          href="/dashboard/tutorias"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors border border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Tutorías
        </Link>
      </div>
      <AgendaClient eventos={eventos} />
    </div>
  )
}
