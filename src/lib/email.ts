/**
 * Helper de envío de email via Resend.
 * Único punto de integración con la API de Resend — usar desde cualquier server action.
 */
export async function enviarEmail({ to, subject, html }: {
  to: string
  subject: string
  html: string
}): Promise<{ error?: string; success?: boolean }> {
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@tutor.app'

  if (!resendKey || resendKey === 'TU_RESEND_API_KEY') {
    return { error: 'Email no configurado' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) return { error: 'Error al enviar el correo' }
  return { success: true }
}
