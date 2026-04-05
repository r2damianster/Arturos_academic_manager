'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Tab = 'profesor' | 'estudiante'
type StudentStep = 1 | 2

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // --- Shared ---
  const [activeTab, setActiveTab] = useState<Tab>('estudiante')

  // --- Profesor state ---
  const [profEmail, setProfEmail] = useState('')
  const [profPassword, setProfPassword] = useState('')
  const [profNombre, setProfNombre] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [profLoading, setProfLoading] = useState(false)
  const [profError, setProfError] = useState<string | null>(null)
  const [profMessage, setProfMessage] = useState<string | null>(null)

  // --- Estudiante state ---
  const [studEmail, setStudEmail] = useState('')
  const [studPassword, setStudPassword] = useState('')
  const [studStep, setStudStep] = useState<StudentStep>(1)
  const [studLoading, setStudLoading] = useState(false)
  const [studError, setStudError] = useState<string | null>(null)

  // ----------------------------------------------------------------
  // PROFESOR: sign-in or sign-up
  // ----------------------------------------------------------------
  async function handleProfSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfLoading(true)
    setProfError(null)
    setProfMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: profEmail,
        password: profPassword,
        options: { data: { full_name: profNombre } },
      })
      if (error) {
        setProfError(error.message)
      } else {
        setProfMessage('Revisa tu correo para confirmar tu cuenta.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: profEmail,
        password: profPassword,
      })
      if (error) {
        setProfError('Credenciales incorrectas. Verifica tu email y contraseña.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    }

    setProfLoading(false)
  }

  // ----------------------------------------------------------------
  // ESTUDIANTE: step 1 — verify email
  // ----------------------------------------------------------------
  async function handleStudVerify(e: React.FormEvent) {
    e.preventDefault()
    setStudLoading(true)
    setStudError(null)

    const { data, error } = await supabase.rpc('check_student_email', {
      check_email: studEmail,
    })

    if (error) {
      setStudError('Ocurrió un error al verificar tu correo. Intenta de nuevo.')
      setStudLoading(false)
      return
    }

    const result = data as { exists: boolean; has_account: boolean }

    if (!result.exists) {
      setStudError(
        'Tu correo no está registrado en la plataforma. Si crees que es un error, contacta a tu profesor o al administrador del curso.'
      )
    } else if (!result.has_account) {
      router.push(`/auth/setup?email=${encodeURIComponent(studEmail)}`)
    } else {
      setStudStep(2)
    }

    setStudLoading(false)
  }

  // ----------------------------------------------------------------
  // ESTUDIANTE: step 2 — sign in
  // ----------------------------------------------------------------
  async function handleStudLogin(e: React.FormEvent) {
    e.preventDefault()
    setStudLoading(true)
    setStudError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: studEmail,
      password: studPassword,
    })

    if (error) {
      setStudError('Contraseña incorrecta.')
    } else {
      router.push('/student')
      router.refresh()
    }

    setStudLoading(false)
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    // Reset both sides when switching tabs
    setProfError(null)
    setProfMessage(null)
    setStudError(null)
    setStudStep(1)
    setStudPassword('')
  }

  // ----------------------------------------------------------------
  // Tab button classes
  // ----------------------------------------------------------------
  const tabActive =
    'flex-1 py-2.5 text-sm font-medium transition-colors bg-brand-600/20 text-brand-400 border-b-2 border-brand-500'
  const tabInactive =
    'flex-1 py-2.5 text-sm font-medium transition-colors text-gray-500 hover:text-gray-300 border-b-2 border-transparent'

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
          <p className="text-gray-400 mt-1 text-xs">Derechos reservados Profesor Arturo Rodríguez</p>
          <p className="text-gray-400 mt-1 text-sm">Ingresa a tu cuenta</p>
        </div>

        {/* Card */}
        <div className="card overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800 -mx-6 -mt-6 mb-6 px-0">
            <button
              type="button"
              onClick={() => handleTabChange('estudiante')}
              className={activeTab === 'estudiante' ? tabActive : tabInactive}
            >
              Estudiantes
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('profesor')}
              className={activeTab === 'profesor' ? tabActive : tabInactive}
            >
              Profesores
            </button>
          </div>

          {/* ── PROFESOR TAB ── */}
          {activeTab === 'profesor' && (
            <>
              <form onSubmit={handleProfSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="label">Nombre completo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Prof. Juan García"
                      value={profNombre}
                      onChange={e => setProfNombre(e.target.value)}
                      required={isSignUp}
                    />
                  </div>
                )}

                <div>
                  <label className="label">Correo electrónico</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="profesor@universidad.edu"
                    value={profEmail}
                    onChange={e => setProfEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label">Contraseña</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={profPassword}
                    onChange={e => setProfPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {!isSignUp && (
                  <div className="text-right -mt-1">
                    <Link
                      href="/auth/reset"
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                )}

                {profError && (
                  <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                    {profError}
                  </div>
                )}
                {profMessage && (
                  <div className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm px-4 py-3 rounded-lg">
                    {profMessage}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full" disabled={profLoading}>
                  {profLoading
                    ? 'Procesando...'
                    : isSignUp
                    ? 'Crear cuenta'
                    : 'Ingresar'}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-gray-800 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setProfError(null)
                    setProfMessage(null)
                  }}
                  className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {isSignUp
                    ? '¿Ya tienes cuenta? Inicia sesión'
                    : 'Crear cuenta de profesor'}
                </button>
              </div>
            </>
          )}

          {/* ── ESTUDIANTE TAB ── */}
          {activeTab === 'estudiante' && (
            <>
              {/* Step 1: email verification */}
              {studStep === 1 && (
                <form onSubmit={handleStudVerify} className="space-y-4">
                  <div>
                    <label className="label">Correo electrónico</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="estudiante@universidad.edu"
                      value={studEmail}
                      onChange={e => setStudEmail(e.target.value)}
                      required
                    />
                  </div>

                  {studError && (
                    <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                      {studError}
                    </div>
                  )}

                  <button type="submit" className="btn-primary w-full" disabled={studLoading}>
                    {studLoading ? 'Verificando...' : 'Verificar'}
                  </button>
                </form>
              )}

              {/* Step 2: password login */}
              {studStep === 2 && (
                <form onSubmit={handleStudLogin} className="space-y-4">
                  <div>
                    <label className="label">Correo electrónico</label>
                    <input
                      type="email"
                      className="input opacity-60 cursor-not-allowed"
                      value={studEmail}
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
                      value={studPassword}
                      onChange={e => setStudPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>

                  <div className="text-right -mt-1">
                    <Link
                      href="/auth/reset"
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  {studError && (
                    <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                      {studError}
                    </div>
                  )}

                  <button type="submit" className="btn-primary w-full" disabled={studLoading}>
                    {studLoading ? 'Ingresando...' : 'Ingresar'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setStudStep(1)
                        setStudPassword('')
                        setStudError(null)
                      }}
                      className="btn-ghost text-sm"
                    >
                      ← Cambiar correo
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
