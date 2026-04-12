import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function actualizarPerfilEstudiante(formData: FormData) {
  'use server'

  const { createClient: createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const telefono = formData.get('telefono') as string
  const genero = formData.get('genero') as string
  const gmail = formData.get('gmail') as string
  const institucion = formData.get('institucion') as string

  await db
    .from('encuesta_estudiante')
    .update({ telefono, genero, gmail, institucion })
    .eq('auth_user_id', user.id)

  // Sincronizar genero en perfiles_estudiante para todos los registros del usuario
  if (genero) {
    const { data: estudiantesList } = await db
      .from('estudiantes')
      .select('id')
      .eq('auth_user_id', user.id)

    if (estudiantesList && estudiantesList.length > 0) {
      const estudianteIds = estudiantesList.map((e: { id: string }) => e.id)
      await db
        .from('perfiles_estudiante')
        .update({ genero })
        .in('estudiante_id', estudianteIds)
    }
  }

  redirect('/student')
}

export default async function PerfilPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: estudiante } = await db
    .from('estudiantes')
    .select('nombre, email')
    .eq('auth_user_id', user.id)
    .limit(1)
    .single()

  const { data: encuesta } = await db
    .from('encuesta_estudiante')
    .select('telefono, genero, gmail, carrera, nivel_estudio, institucion')
    .eq('auth_user_id', user.id)
    .single()

  const nombre: string = estudiante?.nombre ?? ''
  const email: string = estudiante?.email ?? user.email ?? ''
  const telefono: string = encuesta?.telefono ?? ''
  const genero: string = encuesta?.genero ?? ''
  const gmail: string = encuesta?.gmail ?? ''
  const carrera: string = encuesta?.carrera ?? ''
  const nivelEstudio: string = encuesta?.nivel_estudio ?? ''
  const institucion: string = encuesta?.institucion ?? ''

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Volver
          </Link>
          <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        </div>

        <form action={actualizarPerfilEstudiante} className="space-y-6">
          <div className="card space-y-5">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide text-gray-500">
              Información de cuenta
            </h2>

            {/* Nombre — readonly */}
            <div>
              <label className="label">Nombre</label>
              <input
                type="text"
                className="input opacity-60 cursor-not-allowed"
                value={nombre}
                readOnly
                disabled
              />
            </div>

            {/* Email — readonly */}
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

            {/* Carrera — readonly */}
            <div>
              <label className="label">Carrera</label>
              <input
                type="text"
                className="input opacity-60 cursor-not-allowed"
                value={carrera}
                readOnly
                disabled
              />
            </div>

            {/* Nivel de estudio — badge */}
            <div>
              <label className="label">Nivel de estudio</label>
              <div className="mt-1">
                {nivelEstudio ? (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    nivelEstudio === 'posgrado'
                      ? 'bg-purple-900/40 text-purple-300 border border-purple-700'
                      : 'bg-brand-900/40 text-brand-300 border border-brand-700'
                  }`}>
                    {nivelEstudio === 'posgrado' ? 'Posgrado' : 'Grado'}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">No especificado</span>
                )}
              </div>
            </div>
          </div>

          <div className="card space-y-5">
            <h2 className="font-semibold text-white text-sm uppercase tracking-wide text-gray-500">
              Información editable
            </h2>

            {/* Gmail */}
            <div>
              <label className="label" htmlFor="gmail">Gmail personal</label>
              <input
                id="gmail"
                type="email"
                name="gmail"
                className="input"
                placeholder="tucorreo@gmail.com"
                defaultValue={gmail}
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="label" htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                type="tel"
                name="telefono"
                className="input"
                placeholder="+593 99 000 0000"
                defaultValue={telefono}
              />
            </div>

            {/* Género */}
            <div>
              <label className="label" htmlFor="genero">Género</label>
              <select
                id="genero"
                name="genero"
                className="input"
                defaultValue={genero}
              >
                <option value="">Selecciona una opción</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
                <option value="prefiero_no_decir">Prefiero no decir</option>
              </select>
            </div>

            {/* Institución */}
            <div>
              <label className="label" htmlFor="institucion">Universidad / Institución</label>
              <input
                id="institucion"
                type="text"
                name="institucion"
                className="input"
                placeholder="Ej. ULEAM"
                defaultValue={institucion}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            Guardar cambios
          </button>
        </form>
      </div>
    </div>
  )
}
