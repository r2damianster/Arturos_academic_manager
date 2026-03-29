'use server'

import { createClient } from '@/lib/supabase/server'

export async function guardarEncuesta(
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  function num(key: string): number | null {
    const v = formData.get(key)
    if (!v || v === '') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }
  function str(key: string): string | null {
    const v = formData.get(key) as string | null
    return v?.trim() || null
  }
  function bool(key: string): boolean {
    return formData.get(key) === 'true' || formData.get(key) === 'on'
  }
  function checkbox(key: string): boolean {
    return formData.get(key) === 'true'
  }

  const consentimiento = formData.get('consentimiento') === 'true'
  if (!consentimiento) return { error: 'Debes aceptar el consentimiento para continuar' }

  const payload = {
    auth_user_id:             user.id,
    genero:                   str('genero'),
    fecha_nac:                str('fecha_nac'),
    telefono:                 str('telefono'),
    gmail:                    str('gmail'),
    carrera:                  str('carrera'),
    institucion:              str('institucion'),
    carrera_inicio_deseada:   num('carrera_inicio_deseada'),
    carrera_actual_deseada:   num('carrera_actual_deseada'),
    nivel_tecnologia:         num('nivel_tecnologia'),
    tiene_laptop:             checkbox('tiene_laptop'),
    tiene_pc_escritorio:      checkbox('tiene_pc_escritorio'),
    comparte_pc:              checkbox('comparte_pc'),
    dispositivo_movil:        str('dispositivo_movil'),
    trabaja:                  bool('trabaja'),
    tipo_trabajo:             str('tipo_trabajo'),
    libros_anio:              num('libros_anio'),
    gusto_escritura:          num('gusto_escritura'),
    uso_ia_comprension:       num('uso_ia_comprension'),
    uso_ia_resumen:            num('uso_ia_resumen'),
    uso_ia_ideas:             num('uso_ia_ideas'),
    uso_ia_redaccion:         num('uso_ia_redaccion'),
    uso_ia_tareas:            num('uso_ia_tareas'),
    uso_ia_verificacion:      num('uso_ia_verificacion'),
    uso_ia_critico:           num('uso_ia_critico'),
    problemas_reportados:     str('problemas_reportados'),
    consentimiento:           true,
  }

  const { error } = await db
    .from('encuesta_estudiante')
    .upsert(payload, { onConflict: 'auth_user_id' })

  if (error) {
    console.error('Error guardando encuesta:', error)
    return { error: 'Error al guardar. Intenta de nuevo.' }
  }

  return null
}
