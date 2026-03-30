import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ accion?: string }>
}

// Use service-role key — this page is called from email links (no user session)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// ─── Tiny UI components ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center shadow-2xl">
        {children}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      </div>
      <span className="text-white font-semibold text-sm">Gestor Universitario</span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default async function TutoriaActionPage({ params, searchParams }: Props) {
  const { token } = await params
  const { accion } = await searchParams

  // Validate token format (UUID)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(token)) {
    return (
      <Card>
        <Logo />
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-lg font-semibold text-white mb-2">Enlace inválido</h1>
        <p className="text-gray-400 text-sm mb-6">El formato del enlace no es válido.</p>
        <Link href="/dashboard/tutorias" className="btn-primary text-sm">
          Ir al panel
        </Link>
      </Card>
    )
  }

  // We need to know the action — it's embedded in the token row itself,
  // so we can fetch it first and confirm before executing
  const db = getServiceClient()

  // Fetch token row to get the accion (don't rely solely on query param)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRow, error: tokenErr } = await (db as any)
    .from('email_action_tokens')
    .select('id, accion, reserva_id, used_at, expires_at')
    .eq('id', token)
    .single()

  if (tokenErr || !tokenRow) {
    return (
      <Card>
        <Logo />
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-lg font-semibold text-white mb-2">Enlace no encontrado</h1>
        <p className="text-gray-400 text-sm mb-6">Este enlace no existe o ya fue eliminado.</p>
        <Link href="/dashboard/tutorias" className="btn-primary text-sm">
          Ir al panel
        </Link>
      </Card>
    )
  }

  // Already used?
  if (tokenRow.used_at) {
    return (
      <Card>
        <Logo />
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-lg font-semibold text-white mb-2">Ya reportada</h1>
        <p className="text-gray-400 text-sm mb-2">
          Esta tutoría ya fue reportada anteriormente.
        </p>
        <p className="text-gray-600 text-xs mb-6">
          Enlace utilizado el {new Date(tokenRow.used_at).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>
        <Link href="/dashboard/tutorias" className="btn-primary text-sm">
          Ver historial
        </Link>
      </Card>
    )
  }

  // Expired?
  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <Card>
        <Logo />
        <div className="text-4xl mb-3">⏰</div>
        <h1 className="text-lg font-semibold text-white mb-2">Enlace expirado</h1>
        <p className="text-gray-400 text-sm mb-6">
          Este enlace expiró. Puedes reportar la tutoría directamente desde el panel.
        </p>
        <Link href="/dashboard/tutorias" className="btn-primary text-sm">
          Ir al panel
        </Link>
      </Card>
    )
  }

  // ── Execute the action ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error: rpcErr } = await (db as any)
    .rpc('consume_action_token', {
      p_token_id: token,
      p_accion:   tokenRow.accion,
    })

  if (rpcErr || !result?.ok) {
    const msg = rpcErr?.message ?? result?.error ?? 'Error desconocido'
    return (
      <Card>
        <Logo />
        <div className="text-4xl mb-3">❌</div>
        <h1 className="text-lg font-semibold text-white mb-2">No se pudo procesar</h1>
        <p className="text-gray-400 text-sm mb-6">{msg}</p>
        <Link href="/dashboard/tutorias" className="btn-primary text-sm">
          Ir al panel
        </Link>
      </Card>
    )
  }

  // ── Success ─────────────────────────────────────────────────────────────
  const LABELS: Record<string, { emoji: string; title: string; desc: string; color: string }> = {
    asistio:    { emoji: '✅', title: '¡Registrado!',           desc: 'La tutoría fue marcada como realizada.',          color: 'text-emerald-400' },
    no_asistio: { emoji: '📋', title: 'Ausencia registrada',    desc: 'Se registró que el estudiante no asistió.',       color: 'text-amber-400'   },
    cancelar:   { emoji: '🚫', title: 'Tutoría cancelada',      desc: 'La tutoría quedó registrada como cancelada.',     color: 'text-gray-400'    },
  }

  const ui = LABELS[tokenRow.accion] ?? LABELS['cancelar']

  return (
    <Card>
      <Logo />
      <div className="text-5xl mb-4">{ui.emoji}</div>
      <h1 className={`text-xl font-bold mb-2 ${ui.color}`}>{ui.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{ui.desc}</p>
      <Link
        href="/dashboard/tutorias"
        className="btn-primary text-sm w-full block"
      >
        Ver historial completo
      </Link>
      <p className="text-gray-600 text-xs mt-4">
        Puedes cerrar esta pestaña.
      </p>
    </Card>
  )
}
