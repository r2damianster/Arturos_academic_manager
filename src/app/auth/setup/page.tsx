'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function SetupForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!email) {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-400 text-sm">
          Enlace inválido. Regresa a la página de ingreso.
        </p>
        <Link
          href="/auth/login"
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          ← Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (supabaseError) {
      setError(supabaseError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      router.push('/student/onboarding')
    }, 1500)
  }

  return (
    <div className="card space-y-4">
      {success ? (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm px-4 py-3 rounded-lg text-center">
          ¡Cuenta creada! Redirigiendo...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Correo electrónico</label>
            <input
              type="email"
              className="input opacity-60 cursor-not-allowed"
              value={email}
              readOnly
              disabled
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
      )}

      <p className="text-xs text-gray-500 text-center pt-2">
        Tu cuenta estará vinculada al correo con el que tu profesor te registró.
      </p>
    </div>
  )
}

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Gestor Universitario</h1>
          <p className="text-gray-400 mt-1 text-sm">Crea tu contraseña de acceso</p>
        </div>

        <Suspense fallback={
          <div className="card">
            <p className="text-gray-400 text-sm text-center">Cargando...</p>
          </div>
        }>
          <SetupForm />
        </Suspense>
      </div>
    </div>
  )
}
