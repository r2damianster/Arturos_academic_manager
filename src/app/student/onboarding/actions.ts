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
    return formData.get(key) === 'true'
  }
  function checkbox(key: string): boolean {
    return formData.get(key) === 'true'
  }

  const consentimiento = formData.get('consentimiento') === 'true'
  if (!consentimiento) return { error: 'Debes aceptar el consentimiento para continuar' }

  // Resolve carrera: if "Otra", use the custom text
  const carreraSeleccionada = str('carrera')
  const carreraPersonalizada = str('carrera_personalizada')
  const carreraFinal = carreraSeleccionada === 'Otra' ? carreraPersonalizada : carreraSeleccionada

  const payload = {
    auth_user_id:             user.id,
    // Step 1
    genero:                   str('genero'),
    fecha_nac:                str('fecha_nac'),
    telefono:                 str('telefono'),
    gmail:                    str('gmail'),
    // Step 2
    nivel_estudio:            str('nivel_estudio'),
    carrera:                  carreraFinal,
    institucion:              str('institucion'),
    carrera_inicio_deseada:   num('carrera_inicio_deseada'),
    carrera_actual_deseada:   num('carrera_actual_deseada'),
    modalidad_carrera:        str('modalidad_carrera'),
    situacion_vivienda:       str('situacion_vivienda'),
    es_foraneo:               bool('es_foraneo'),
    // Step 3
    nivel_tecnologia:         num('nivel_tecnologia'),
    tiene_laptop:             checkbox('tiene_laptop'),
    tiene_pc_escritorio:      checkbox('tiene_pc_escritorio'),
    comparte_pc:              checkbox('comparte_pc'),
    sin_computadora:          checkbox('sin_computadora'),
    dispositivo_movil:        str('dispositivo_movil'),
    trabaja:                  bool('trabaja'),
    tipo_trabajo:             str('tipo_trabajo'),
    horas_trabajo_diarias:    num('horas_trabajo_diarias'),
    // Step 4
    libros_anio:              num('libros_anio'),
    gusto_escritura:          num('gusto_escritura'),
    uso_ia_comprension:       num('uso_ia_comprension'),
    uso_ia_resumen:           num('uso_ia_resumen'),
    uso_ia_ideas:             num('uso_ia_ideas'),
    uso_ia_redaccion:         num('uso_ia_redaccion'),
    uso_ia_tareas:            num('uso_ia_tareas'),
    uso_ia_verificacion:      num('uso_ia_verificacion'),
    uso_ia_critico:           num('uso_ia_critico'),
    uso_ia_traduccion:        num('uso_ia_traduccion'),
    uso_ia_idiomas:           num('uso_ia_idiomas'),
    // Step 5
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

  // Sincronizar la información base con la tabla 'perfiles_estudiante'
  const { data: estudiantesList } = await db
    .from('estudiantes')
    .select('id, profesor_id')
    .eq('auth_user_id', user.id)

  if (estudiantesList && estudiantesList.length > 0) {
    let edad: number | null = null
    const fnac = str('fecha_nac')
    if (fnac) {
      const d = new Date(fnac)
      if (!isNaN(d.getTime())) {
        const today = new Date()
        edad = today.getFullYear() - d.getFullYear()
        const m = today.getMonth() - d.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
          edad--
        }
      }
    }

    const perfilesData = estudiantesList.map((est: any) => ({
      profesor_id: est.profesor_id,
      estudiante_id: est.id,
      carrera: carreraFinal,
      trabaja: bool('trabaja'),
      laptop: checkbox('tiene_laptop'),
      genero: str('genero'),
      edad: edad
    }))

    const { error: errorPerfiles } = await db
      .from('perfiles_estudiante')
      .upsert(perfilesData, { onConflict: 'estudiante_id' })

    if (errorPerfiles) {
      console.error('Error sincronizando perfiles_estudiante:', errorPerfiles)
    }
  }

  return null
}
