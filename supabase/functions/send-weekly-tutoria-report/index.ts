import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY')!
const APP_URL             = Deno.env.get('APP_URL') ?? 'https://gestor-universitario.vercel.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types ─────────────────────────────────────────────────────────────────

interface UnreportedRow {
  reserva_id:        number
  profesor_id:       string
  profesor_nombre:   string
  profesor_email:    string
  estudiante_nombre: string
  dia_semana:        string
  hora_inicio:       string
  hora_fin:          string
  semana_label:      string
}

interface TokenRow {
  id:         string
  reserva_id: number
  accion:     string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(t: string) {
  return t?.slice(0, 5) ?? ''
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Create the 3 action tokens for a reserva and return them
async function createTokens(reserva_id: number, profesor_id: string): Promise<{
  asistio:    string
  no_asistio: string
  cancelar:   string
}> {
  const rows = [
    { reserva_id, accion: 'asistio',    profesor_id },
    { reserva_id, accion: 'no_asistio', profesor_id },
    { reserva_id, accion: 'cancelar',   profesor_id },
  ]

  const { data, error } = await supabase
    .from('email_action_tokens')
    .insert(rows)
    .select('id, accion')

  if (error) throw new Error(`Token creation failed: ${error.message}`)

  const tokens: Record<string, string> = {}
  for (const t of (data as TokenRow[])) {
    tokens[t.accion] = t.id
  }

  return {
    asistio:    tokens['asistio'],
    no_asistio: tokens['no_asistio'],
    cancelar:   tokens['cancelar'],
  }
}

// Build a single tutoria row HTML for the email table
function buildRowHtml(row: UnreportedRow, tokens: { asistio: string; no_asistio: string; cancelar: string }) {
  const btn = (token: string, label: string, color: string) =>
    `<a href="${APP_URL}/tutoria-action/${token}" style="display:inline-block;padding:5px 12px;border-radius:6px;background:${color};color:#fff;font-size:12px;font-weight:600;text-decoration:none;margin:0 3px;">${label}</a>`

  return `
    <tr style="border-bottom:1px solid #2d2d2d;">
      <td style="padding:10px 8px;color:#e2e8f0;font-size:13px;">
        <strong style="color:#fff;">${capitalize(row.dia_semana)}</strong>
        <span style="color:#94a3b8;margin-left:6px;">${fmt(row.hora_inicio)}–${fmt(row.hora_fin)}</span>
      </td>
      <td style="padding:10px 8px;color:#94a3b8;font-size:13px;">${row.estudiante_nombre}</td>
      <td style="padding:10px 8px;text-align:right;">
        ${btn(tokens.asistio,    '✓ Asistió',    '#059669')}
        ${btn(tokens.no_asistio, '✗ No asistió', '#d97706')}
        ${btn(tokens.cancelar,   'Cancelada',    '#6b7280')}
      </td>
    </tr>`
}

// Build full email HTML for one professor
function buildEmailHtml(
  nombreProfesor: string,
  semanaLabel: string,
  rows: { row: UnreportedRow; tokens: { asistio: string; no_asistio: string; cancelar: string } }[]
) {
  const tableRows = rows.map(({ row, tokens }) => buildRowHtml(row, tokens)).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e293b;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #334155;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:36px;height:36px;background:#4f46e5;border-radius:8px;display:inline-block;vertical-align:middle;text-align:center;line-height:36px;font-size:18px;">🎓</div>
              <span style="display:inline-block;vertical-align:middle;color:#fff;font-size:18px;font-weight:700;margin-left:10px;">Gestor Universitario</span>
            </div>
            <h1 style="color:#fff;font-size:20px;font-weight:600;margin:20px 0 4px;">Tutorías sin reportar</h1>
            <p style="color:#94a3b8;font-size:14px;margin:0;">Semana del ${semanaLabel} · Prof. ${nombreProfesor}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <p style="color:#cbd5e1;font-size:14px;margin:0 0 20px;">
              Hola <strong style="color:#fff;">${nombreProfesor}</strong>, las siguientes tutorías quedaron pendientes de reporte.
              Por favor indica el resultado de cada una con un solo clic:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#1e3a5f;">
                  <th style="padding:10px 8px;color:#93c5fd;font-size:12px;font-weight:600;text-align:left;">Horario</th>
                  <th style="padding:10px 8px;color:#93c5fd;font-size:12px;font-weight:600;text-align:left;">Estudiante</th>
                  <th style="padding:10px 8px;color:#93c5fd;font-size:12px;font-weight:600;text-align:right;">Acción</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>

            <p style="color:#64748b;font-size:12px;margin:20px 0 0;">
              Cada botón es de uso único. También puedes reportar desde el
              <a href="${APP_URL}/dashboard/tutorias" style="color:#818cf8;">panel de tutorías</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="color:#475569;font-size:11px;margin:0;">
              Este correo fue enviado automáticamente cada lunes.
              No respondas a este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Gestor Universitario <noreply@resend.dev>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }

  return res.json()
}

// ─── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Allow cron invocation (POST) and manual test (GET)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // 1. Fetch all unreported tutorías
    const { data: rows, error: fetchErr } = await supabase
      .rpc('get_unreported_tutorias')

    if (fetchErr) throw new Error(`RPC error: ${fetchErr.message}`)
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No unreported tutorias', sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Group by profesor
    const byProfesor = new Map<string, UnreportedRow[]>()
    for (const row of rows as UnreportedRow[]) {
      if (!byProfesor.has(row.profesor_id)) byProfesor.set(row.profesor_id, [])
      byProfesor.get(row.profesor_id)!.push(row)
    }

    // 3. For each professor: create tokens → build email → send
    const results: { profesor: string; sent: boolean; error?: string }[] = []

    for (const [, profRows] of byProfesor) {
      const { profesor_nombre, profesor_email, semana_label } = profRows[0]

      try {
        // Create tokens for all reservas of this professor
        const rowsWithTokens: { row: UnreportedRow; tokens: { asistio: string; no_asistio: string; cancelar: string } }[] = []

        for (const row of profRows) {
          const tokens = await createTokens(row.reserva_id, row.profesor_id)
          rowsWithTokens.push({ row, tokens })
        }

        // Build and send email
        const html = buildEmailHtml(profesor_nombre, semana_label, rowsWithTokens)
        const subject = `📋 ${profRows.length} tutoría${profRows.length > 1 ? 's' : ''} sin reportar — semana del ${semana_label}`

        await sendEmail(profesor_email, subject, html)
        results.push({ profesor: profesor_nombre, sent: true })

      } catch (err) {
        results.push({ profesor: profesor_nombre, sent: false, error: String(err) })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
