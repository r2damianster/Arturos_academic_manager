import { createClient } from '@/lib/supabase/server'
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
      <div>
        <h1 className="text-2xl font-bold text-white">Agenda</h1>
        <p className="text-gray-400 text-sm mt-1">Eventos personales, académicos y laborales</p>
      </div>
      <AgendaClient eventos={eventos} />
    </div>
  )
}
